/**
 * Error Guard HTTP surface.
 *
 * Two very different endpoints live here on purpose:
 *  - `POST /api/telemetry/errors` — public, unauthenticated (like every error tracker),
 *    rate-limited per IP, always answers 204 so a broken client cannot retry-storm us;
 *  - `/api/admin/watch/*` — behind the existing `adminAuth` session middleware, because
 *    reading failure reports is an administrative act.
 */
import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { adminAuth } from '../adminAuth.js';
import type { GuardSummary } from '@shared/errorGuard/types';
import {
  enqueue,
  flush,
  getAggregatorStats,
  isIntakeAllowed,
  setAlertHandler,
  setNewGroupHandler,
  startErrorGuard,
  type AggregatorStats,
} from './aggregator';
import { analyzeGroup, getTriageStats, scheduleTriage } from './triage';
import { notifyCriticalProblems } from './alerts';
import {
  databaseSummary,
  getGroup,
  getSamples,
  listGroups,
  listJobRuns,
  recordJobRun,
  setStatus,
} from './store';

const MAX_BODY_BYTES = 48_000;
const MAX_EVENTS_PER_REQUEST = 50;

const kindEnum = z.enum(['exception', 'rejection', 'swallowed', 'http', 'invariant', 'job']);
const severityEnum = z.enum(['critical', 'error', 'warning', 'info']);
const sourceEnum = z.enum(['client', 'server', 'job']);

const eventSchema = z.object({
  kind: kindEnum,
  message: z.string().min(1).max(2_000),
  name: z.string().max(200).optional(),
  stack: z.string().max(20_000).optional(),
  route: z.string().max(400).optional(),
  method: z.string().max(12).optional(),
  status: z.number().int().min(100).max(599).optional(),
  durationMs: z.number().int().min(0).max(600_000).optional(),
  requestId: z.string().max(200).optional(),
  release: z.string().max(100).optional(),
  source: sourceEnum.optional(),
  platform: z.string().max(64).optional(),
  moneyPath: z.boolean().optional(),
  severity: severityEnum.optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  breadcrumbs: z
    .array(
      z.object({
        type: z.enum(['navigation', 'click', 'http', 'console', 'custom']),
        label: z.string().max(300),
        at: z.number().optional(),
      }),
    )
    .max(40)
    .optional(),
  count: z.number().int().min(1).max(10_000).optional(),
  occurredAt: z.string().max(40).optional(),
  sessionRef: z.string().max(64).optional(),
});

const ingestSchema = z.object({ events: z.array(eventSchema).max(MAX_EVENTS_PER_REQUEST) });

const statusBodySchema = z.object({ status: z.enum(['open', 'resolved', 'ignored']) });

const jobRunSchema = z.object({
  jobName: z.string().min(1).max(64),
  status: z.enum(['ok', 'failed', 'running']),
  errorCode: z.string().max(120).nullish(),
  durationMs: z.number().int().min(0).nullish(),
});

/**
 * Public ingest. Every failure mode answers 204 — an error reporter that can itself
 * return 4xx/5xx becomes a new source of retries.
 */
export function handleIngest(req: Request, res: Response): void {
  try {
    if (!isIntakeAllowed(req.ip ?? req.socket?.remoteAddress ?? 'unknown')) {
      res.status(204).end();
      return;
    }

    let bodySize = 0;
    try {
      bodySize = JSON.stringify(req.body ?? {}).length;
    } catch {
      bodySize = MAX_BODY_BYTES + 1;
    }
    if (bodySize > MAX_BODY_BYTES) {
      res.status(204).end();
      return;
    }

    const parsed = ingestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(204).end();
      return;
    }

    enqueue(parsed.data.events);
  } catch (error) {
    console.error('[errorGuard] ingest failed:', error instanceof Error ? error.message : error);
  }
  res.status(204).end();
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((error: unknown) => {
      console.error('[errorGuard] admin route failed:', error instanceof Error ? error.message : error);
      if (!res.headersSent) res.status(500).json({ message: 'Watch is unavailable right now' });
    });
  };
}

export function registerErrorGuardRoutes(app: Express): void {
  // ---- public ingest -------------------------------------------------------
  app.post('/api/telemetry/errors', handleIngest);

  // ---- admin --------------------------------------------------------------
  app.get(
    '/api/admin/watch/summary',
    adminAuth,
    asyncRoute(async (_req, res) => {
      const [db, agg, ai] = [await databaseSummary(), getAggregatorStats(), getTriageStats()];
      const summary: GuardSummary & { health: AggregatorStats } = {
        ...db,
        accepted: agg.accepted,
        dropped: agg.dropped,
        flushFailures: agg.flushFailures,
        aiCallsToday: ai.callsToday,
        aiCallsBudget: ai.budget,
        aiEnabled: ai.enabled,
        health: agg,
      };
      res.json(summary);
    }),
  );

  app.get(
    '/api/admin/watch/groups',
    adminAuth,
    asyncRoute(async (req, res) => {
      const status = statusBodySchema.shape.status.safeParse(req.query.status ?? 'open');
      const limit = Number(req.query.limit ?? 50);
      const groups = await listGroups(status.success ? status.data : 'open', Number.isFinite(limit) ? limit : 50);
      res.json(groups);
    }),
  );

  app.get(
    '/api/admin/watch/groups/:id',
    adminAuth,
    asyncRoute(async (req, res) => {
      const group = await getGroup(req.params.id);
      if (!group) {
        res.status(404).json({ message: 'This problem no longer exists' });
        return;
      }
      const samples = await getSamples(req.params.id, 10);
      res.json({ group, samples });
    }),
  );

  app.post(
    '/api/admin/watch/groups/:id/status',
    adminAuth,
    asyncRoute(async (req, res) => {
      const parsed = statusBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: 'Unknown status' });
        return;
      }
      const updated = await setStatus(req.params.id, parsed.data.status);
      if (!updated) {
        res.status(404).json({ message: 'This problem no longer exists' });
        return;
      }
      res.json({ ok: true, status: parsed.data.status });
    }),
  );

  app.post(
    '/api/admin/watch/groups/:id/analyze',
    adminAuth,
    asyncRoute(async (req, res) => {
      const outcome = await analyzeGroup(req.params.id);
      if (!outcome.ok) {
        const messages: Record<string, string> = {
          disabled: 'AI explanations are turned off',
          budget: 'The daily AI budget is used up — try again tomorrow',
          'in-flight': 'An explanation is already being written',
          missing: 'This problem no longer exists',
          invalid: 'The AI answer was unusable — nothing was saved',
          unavailable: 'The AI service is not answering right now — the problem list still works',
          failed: 'The AI could not be reached',
        };
        res.status(202).json({ ok: false, message: messages[outcome.reason] ?? 'No explanation available' });
        return;
      }
      const group = await getGroup(req.params.id);
      res.json({ ok: true, group });
    }),
  );

  app.get(
    '/api/admin/watch/jobs',
    adminAuth,
    asyncRoute(async (_req, res) => {
      res.json(await listJobRuns());
    }),
  );

  // For scripts and crons: POST {"jobName":"healthcheck","status":"ok"}
  app.post(
    '/api/admin/watch/job-run',
    adminAuth,
    asyncRoute(async (req, res) => {
      const parsed = jobRunSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: 'Invalid job run' });
        return;
      }
      await recordJobRun({
        jobName: parsed.data.jobName,
        status: parsed.data.status,
        errorCode: parsed.data.errorCode ?? null,
        durationMs: parsed.data.durationMs ?? null,
      });
      res.status(204).end();
    }),
  );

  // Force a flush — used by scripts and by the "Send a test problem" button.
  app.post(
    '/api/admin/watch/flush',
    adminAuth,
    asyncRoute(async (_req, res) => {
      await flush();
      res.json({ ok: true, health: getAggregatorStats() });
    }),
  );

  // Wire the aggregator to triage and to e-mail alerts, then start the flush timer once.
  setNewGroupHandler(scheduleTriage);
  setAlertHandler(notifyCriticalProblems);
  startErrorGuard();
}
