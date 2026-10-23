/**
 * Error Guard triage — a self-contained module for the standalone AI processor.
 *
 * WHY THIS FILE EXISTS
 * The Kaptia web app should not own AI prompts. This service already owns the provider
 * keys, the model router and the cost logging, so error triage lives here too.
 *
 * ISOLATION (deliberate):
 *  - this file is additive: it does not touch `/execute-gpt-task`, the task switch, or any
 *    existing prompt or specialist;
 *  - it has its own prompt, its own response shape and its own model choice;
 *  - it is mounted by a single `registerErrorGuardTriage(app)` call in `index.ts`;
 *  - auth is the service-wide `x-api-key` middleware that already protects every route.
 *
 * PRIVACY:
 *  - the caller sends metadata only (a scrubbed message, top stack frames, breadcrumb
 *    labels, context *keys*). No user data, no request bodies;
 *  - the payload is never logged; `providers.ts` logs model, tokens and cost only;
 *  - the response is plain JSON that the caller validates with zod before storing anything.
 */
import type { Express, Request, Response } from 'express';
import { DEFAULT_MODEL, createRoutedClient } from './providers';

const openai = createRoutedClient();

const MAX_MESSAGE = 500;
const MAX_FRAMES = 5;
const MAX_CONTEXT_KEYS = 15;
const MAX_BREADCRUMBS = 8;

const SYSTEM_PROMPT = `You are a senior engineer helping the owner of a small personal-finance app understand a failure report.

Rules:
- The report is metadata only. You will not see user data, and you must not ask for it.
- Write for a non-developer first, then give one technical pointer.
- Never invent file names. If the stack does not show a file, say "not in the report".
- Be concrete and short. No markdown, no code blocks, no bullet characters.
- Money matters: if an amount, balance, budget or export could be wrong, set moneyRisk to "possible" or "likely" and explain the consequence for the user.
- Answer with a single JSON object and nothing else.

Response shape:
{"plainSummary":string,"likelyCause":string,"whereToLook":string,"userImpact":string,
 "moneyRisk":"none"|"possible"|"likely","severity":"critical"|"error"|"warning"|"info",
 "confidence":number-between-0-and-1,"suggestedFix":string}`;

interface TriageRequest {
  title?: string;
  kind?: string;
  route?: string | null;
  release?: string | null;
  platform?: string | null;
  severity?: string;
  moneyPath?: boolean;
  eventCount?: number;
  message?: string;
  stackFrames?: string[];
  contextKeys?: string[];
  breadcrumbLabels?: string[];
}

function asStringArray(value: unknown, limit: number, fromEnd = false): string[] {
  if (!Array.isArray(value)) return [];
  const cleaned = value
    .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    .map((entry) => entry.slice(0, 300));
  // Breadcrumbs are "the last actions before it happened", so they keep the tail.
  return fromEnd ? cleaned.slice(-limit) : cleaned.slice(0, limit);
}

/** Prompt built from metadata only. Pure, so the same report always reads the same. */
export function buildUserPrompt(input: TriageRequest): string {
  const frames = asStringArray(input.stackFrames, MAX_FRAMES);
  const contextKeys = asStringArray(input.contextKeys, MAX_CONTEXT_KEYS);
  const breadcrumbs = asStringArray(input.breadcrumbLabels, MAX_BREADCRUMBS, true);

  const lines = [
    `Problem: ${String(input.title ?? 'Unknown problem').slice(0, 200)}`,
    `Type: ${String(input.kind ?? 'exception').slice(0, 24)}`,
    `Severity: ${String(input.severity ?? 'error').slice(0, 12)}`,
    `Touches money: ${input.moneyPath ? 'yes' : 'no'}`,
    `Times seen: ${Number.isFinite(input.eventCount) ? input.eventCount : 1}`,
    `Route: ${input.route ? String(input.route).slice(0, 200) : 'unknown'}`,
    `Release: ${input.release ? String(input.release).slice(0, 64) : 'unknown'}`,
    `Platform: ${input.platform ? String(input.platform).slice(0, 32) : 'unknown'}`,
    `Message: ${String(input.message ?? '').slice(0, MAX_MESSAGE)}`,
  ];

  if (frames.length > 0) lines.push('Top frames:', ...frames.map((frame) => `- ${frame}`));
  if (contextKeys.length > 0) lines.push(`Context keys present: ${contextKeys.join(', ')}`);
  if (breadcrumbs.length > 0) {
    lines.push('Last actions before it happened:', ...breadcrumbs.map((label) => `- ${label}`));
  }

  return lines.join('\n');
}

function parseJsonObject(text: unknown): Record<string, unknown> | null {
  if (typeof text !== 'string') return null;
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function handleTriage(req: Request, res: Response): Promise<void> {
  const input = (req.body ?? {}) as TriageRequest;

  if (!input.message || typeof input.message !== 'string') {
    res.status(400).json({ error: 'Missing required field: message' });
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(input) },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 600,
      temperature: 0.2,
    });

    const content = completion?.choices?.[0]?.message?.content;
    const analysis = parseJsonObject(content);
    if (!analysis) {
      // Do not echo the model output: it is derived from user-facing text.
      res.status(502).json({ error: 'invalid_json' });
      return;
    }

    res.json({
      analysis,
      model: completion?.model ?? DEFAULT_MODEL,
      usage: {
        inputTokens: completion?.usage?.prompt_tokens ?? null,
        outputTokens: completion?.usage?.completion_tokens ?? null,
      },
    });
  } catch (error: any) {
    console.error(
      '[error-triage] failed:',
      error?.status || 'network',
      String(error?.message ?? '').slice(0, 160),
    );
    res.status(502).json({ error: 'triage_failed' });
  }
}

/** Mount `/error-triage`. One call in `index.ts`; nothing else in this service changes. */
export function registerErrorGuardTriage(app: Express): void {
  app.post('/error-triage', (req, res) => {
    void handleTriage(req, res);
  });
}
