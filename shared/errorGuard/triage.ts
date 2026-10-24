/**
 * Error Guard triage — payload and answer contract.
 *
 * The prompt lives in `server/errorGuard/triagePrompt.ts`; the model call goes through
 * lib/aiProvider (ai-processor gateway first, direct providers behind it). This file's job is:
 *
 *   1. build a metadata-only payload (`buildTriagePayload`),
 *   2. validate the answer with `parseTriageResponse` before anything is stored.
 *
 * Pure and isomorphic, so it is unit-testable with no keys, no network and no database.
 */
import { z } from 'zod';
import type { GuardAnalysis, GuardGroup, GuardSeverity } from './types';

/** Legacy gateway path, kept only so the contract test keeps pinning it. */
export const TRIAGE_PATH = '/error-triage';

export const TRIAGE_MAX_FRAMES = 5;
export const TRIAGE_MAX_CONTEXT_KEYS = 15;
export const TRIAGE_MAX_BREADCRUMBS = 8;

/**
 * What the web app sends. Every field is metadata: no context *values*, no user identity,
 * no request body, no query string.
 */
export interface TriagePayload {
  title: string;
  kind: string;
  route?: string | null;
  release?: string | null;
  platform?: string | null;
  severity: GuardSeverity;
  moneyPath: boolean;
  eventCount: number;
  message: string;
  stackFrames?: string[];
  contextKeys?: string[];
  breadcrumbLabels?: string[];
}

/** Just enough of a stored sample to build the payload (keeps this module DB-free). */
export interface TriageSample {
  stack?: string | null;
  context?: Record<string, unknown> | null;
  breadcrumbs?: unknown;
}

/**
 * Build the payload for one group. Deterministic and defensive: it never throws, never
 * includes a context value, and truncates everything that could grow.
 */
export function buildTriagePayload(group: GuardGroup, samples: TriageSample[]): TriagePayload {
  const sample = samples[0];

  const stackFrames = String(sample?.stack ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at '))
    .slice(0, TRIAGE_MAX_FRAMES);

  const contextKeys =
    sample?.context && typeof sample.context === 'object'
      ? Object.keys(sample.context).slice(0, TRIAGE_MAX_CONTEXT_KEYS)
      : [];

  const breadcrumbLabels = Array.isArray(sample?.breadcrumbs)
    ? (sample.breadcrumbs as Array<{ label?: unknown }>)
        .map((crumb) => (typeof crumb?.label === 'string' ? crumb.label : null))
        .filter((label): label is string => Boolean(label))
        .slice(-TRIAGE_MAX_BREADCRUMBS)
    : [];

  return {
    title: group.title.slice(0, 200),
    kind: group.kind,
    route: group.route,
    release: group.release,
    platform: null,
    severity: group.severity,
    moneyPath: group.moneyPath,
    eventCount: group.eventCount,
    message: group.message.slice(0, 500),
    ...(stackFrames.length > 0 ? { stackFrames } : {}),
    ...(contextKeys.length > 0 ? { contextKeys } : {}),
    ...(breadcrumbLabels.length > 0 ? { breadcrumbLabels } : {}),
  };
}

const severityEnum = z.enum(['critical', 'error', 'warning', 'info']);

/**
 * Strict on purpose: an analysis that does not fit this shape is thrown away rather than
 * shown to a human as if it were fact.
 */
export const triageResponseSchema = z.object({
  plainSummary: z.string().min(10).max(400),
  likelyCause: z.string().min(10).max(600),
  whereToLook: z.string().min(3).max(400),
  userImpact: z.string().min(3).max(400),
  moneyRisk: z.enum(['none', 'possible', 'likely']),
  severity: severityEnum,
  confidence: z.number().min(0).max(1),
  suggestedFix: z.string().min(10).max(700),
});

export type TriageResponse = z.infer<typeof triageResponseSchema>;

/** Never trust a model with a shape the UI assumes. Returns null on any mismatch. */
export function parseTriageResponse(raw: unknown): TriageResponse | null {
  const parsed = triageResponseSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function toGuardAnalysis(response: TriageResponse): GuardAnalysis {
  return {
    plainSummary: response.plainSummary,
    likelyCause: response.likelyCause,
    whereToLook: response.whereToLook,
    userImpact: response.userImpact,
    moneyRisk: response.moneyRisk,
    severity: response.severity,
    confidence: response.confidence,
    suggestedFix: response.suggestedFix,
  };
}
