/**
 * Error Guard triage prompt and model call.
 *
 * The prompt lives here, in the app, like every other Kaptia prompt: the ai-processor gateway
 * is generic and holds no Kaptia text. The call goes through lib/aiProvider, so it reaches the
 * gateway first and falls back to calling a provider directly.
 *
 * PRIVACY:
 *  - the caller sends metadata only (a scrubbed message, top stack frames, breadcrumb labels,
 *    context *keys*). No user data, no request bodies;
 *  - nothing here logs the payload or the model output;
 *  - the answer is plain JSON that the caller validates with zod before storing anything.
 */
import { AI_MODELS, createRoutedClient } from '../../lib/aiProvider';

const openai = createRoutedClient();

const MAX_MESSAGE = 500;
const MAX_FRAMES = 5;
const MAX_CONTEXT_KEYS = 15;
const MAX_BREADCRUMBS = 8;

export const TRIAGE_SYSTEM_PROMPT = `You are a senior engineer helping the owner of a small personal-finance app understand a failure report.

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

export interface TriageRequest {
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

export function parseJsonObject(text: unknown): Record<string, unknown> | null {
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

export interface TriageModelResult {
  analysis: unknown;
  model: string;
}

/** Asks the model for one analysis. Throws on a provider failure (the caller handles cooldown). */
export async function runTriageModel(input: TriageRequest): Promise<TriageModelResult> {
  const completion = await openai.chat.completions.create({
    model: AI_MODELS.default,
    task: 'error-triage',
    messages: [
      { role: 'system', content: TRIAGE_SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(input) },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 600,
    temperature: 0.2,
  } as any);

  const analysis = parseJsonObject(completion?.choices?.[0]?.message?.content);
  return { analysis, model: completion?.model ?? AI_MODELS.default };
}
