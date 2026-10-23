/**
 * The AI triage prompt and response contract (blueprint 07 §9).
 *
 * This lives here — in a *new, independent* file — on purpose. The running
 * `ai-processor` service is not touched: the prompt is built and validated in the main
 * app, and the model call goes through `lib/aiProvider.createRoutedClient()` (the same
 * router `server/openai.ts` already uses). No new task, no redeploy of the processor.
 *
 * Pure: no SDK import, no network, so it is unit-testable without keys.
 */
import { z } from 'zod';
import type { GuardAnalysis, GuardSeverity } from './types';

export const TRIAGE_TASK = 'error-triage';

/** What the caller sends. Everything here is already scrubbed. */
export interface TriageInput {
  title: string;
  kind: string;
  route?: string | null;
  release?: string | null;
  platform?: string | null;
  severity: GuardSeverity;
  moneyPath: boolean;
  eventCount: number;
  message: string;
  /** Top application frames only — never a full stack. */
  stackFrames?: string[];
  /** Keys of the scrubbed context, not the values. */
  contextKeys?: string[];
  breadcrumbLabels?: string[];
}

const severityEnum = z.enum(['critical', 'error', 'warning', 'info']);

/**
 * Strict on purpose: an analysis that does not fit this shape is thrown away rather
 * than shown to a human as if it were fact.
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

const SYSTEM_PROMPT = `You are a senior engineer helping the owner of a small personal-finance app understand a failure report.

Rules:
- The report is metadata only. You will not see user data, and you must not ask for it.
- Write for a non-developer first, then give one technical pointer.
- Never invent file names. If the stack does not show a file, say "not in the report".
- Be concrete and short. No markdown, no code blocks, no bullet characters.
- Money matters: if an amount, balance, budget or export could be wrong, set moneyRisk to "possible" or "likely" and explain the consequence for the user.
- Answer with a single JSON object and nothing else.`;

/** Build the prompt. Pure: identical input, identical output, no clock, no randomness. */
export function buildTriagePrompt(input: TriageInput): { system: string; user: string } {
  const frames = (input.stackFrames ?? []).slice(0, 5);
  const lines = [
    `Problem: ${input.title}`,
    `Type: ${input.kind}`,
    `Severity: ${input.severity}`,
    `Touches money: ${input.moneyPath ? 'yes' : 'no'}`,
    `Times seen: ${input.eventCount}`,
    `Route: ${input.route ?? 'unknown'}`,
    `Release: ${input.release ?? 'unknown'}`,
    `Platform: ${input.platform ?? 'unknown'}`,
    `Message: ${input.message}`,
  ];
  if (frames.length) lines.push('Top frames:', ...frames.map((frame) => `- ${frame}`));
  if (input.contextKeys?.length) lines.push(`Context keys present: ${input.contextKeys.join(', ')}`);
  if (input.breadcrumbLabels?.length) {
    lines.push('Last actions before it happened:', ...input.breadcrumbLabels.slice(-8).map((l) => `- ${l}`));
  }
  lines.push(
    '',
    'Reply with JSON: {"plainSummary":string,"likelyCause":string,"whereToLook":string,',
    '"userImpact":string,"moneyRisk":"none"|"possible"|"likely",',
    '"severity":"critical"|"error"|"warning"|"info","confidence":0..1,"suggestedFix":string}',
  );
  return { system: SYSTEM_PROMPT, user: lines.join('\n') };
}
