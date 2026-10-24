/**
 * AI triage client.
 *
 * The prompt and the model call live in ./triagePrompt (the Kaptia app owns its prompts); the
 * call goes through lib/aiProvider, so it reaches the ai-processor gateway first and falls back
 * to a provider directly. There is no Kaptia-specific route on the gateway any more.
 *
 * This module's job is narrow:
 *  - decide whether to call at all (off switch, daily budget, one call at a time),
 *  - build a metadata-only payload (`buildTriagePayload`),
 *  - survive a dead/hanging model (cooldown),
 *  - validate the answer and store it.
 *
 * It never throws into the caller: the caller is the flush path of the error tracker.
 */
import {
  buildTriagePayload,
  parseTriageResponse,
  toGuardAnalysis,
  type TriagePayload,
} from '@shared/errorGuard/triage';
import { getGroup, getSamples, saveAnalysis, setAIStatus } from './store';
import { runTriageModel } from './triagePrompt';

const PROCESSOR_COOLDOWN_MS = Number(process.env.ERROR_GUARD_AI_COOLDOWN_MS) || 300_000;
const DAILY_BUDGET = Number(process.env.ERROR_GUARD_AI_BUDGET) || 25;
const MAX_CONCURRENT = 1;

let callsToday = 0;
let budgetDay = new Date().toISOString().slice(0, 10);
let processorDownUntil = 0;
const inFlight = new Set<string>();

/** `ERROR_GUARD_AI=off` is the only switch. */
export function isTriageEnabled(): boolean {
  return process.env.ERROR_GUARD_AI !== 'off';
}

export interface TriageStats {
  enabled: boolean;
  callsToday: number;
  budget: number;
  inFlight: number;
  processorReachable: boolean;
  processorUrl: string | null;
}

export function getTriageStats(): TriageStats {
  return {
    enabled: isTriageEnabled(),
    callsToday,
    budget: DAILY_BUDGET,
    inFlight: inFlight.size,
    processorReachable: Date.now() >= processorDownUntil,
    processorUrl: process.env.AI_PROCESSOR_ENABLED === 'true' ? (process.env.AI_PROCESSOR_URL ?? null) : null,
  };
}

function consumeBudget(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== budgetDay) {
    budgetDay = today;
    callsToday = 0;
  }
  if (callsToday >= DAILY_BUDGET) return false;
  callsToday += 1;
  return true;
}

export type TriageOutcome =
  | { ok: true; model: string }
  | {
      ok: false;
      reason: 'disabled' | 'budget' | 'in-flight' | 'missing' | 'invalid' | 'unavailable' | 'failed';
    };

/**
 * Analyse one group.
 *
 * Fire-and-forget from the flush path; returns an outcome so the admin "Explain this"
 * button can say what happened instead of hanging.
 */
export async function analyzeGroup(groupId: string): Promise<TriageOutcome> {
  if (!isTriageEnabled()) {
    await setAIStatus(groupId, 'skipped').catch(() => undefined);
    return { ok: false, reason: 'disabled' };
  }
  if (inFlight.has(groupId) || inFlight.size >= MAX_CONCURRENT) {
    return { ok: false, reason: 'in-flight' };
  }
  if (Date.now() < processorDownUntil) {
    await setAIStatus(groupId, 'skipped').catch(() => undefined);
    return { ok: false, reason: 'unavailable' };
  }
  if (!consumeBudget()) {
    await setAIStatus(groupId, 'skipped').catch(() => undefined);
    return { ok: false, reason: 'budget' };
  }

  inFlight.add(groupId);

  try {
    const group = await getGroup(groupId);
    if (!group) return { ok: false, reason: 'missing' };

    const samples = await getSamples(groupId, 3);
    const payload = buildTriagePayload(group, samples);
    const response = await runTriageModel(payload);

    const parsed = parseTriageResponse(response.analysis);
    if (!parsed) {
      await setAIStatus(groupId, 'failed').catch(() => undefined);
      // Log the group id, never the payload: it is derived from user-facing text.
      console.warn(`[errorGuard] model returned an unusable shape for group ${groupId}`);
      return { ok: false, reason: 'invalid' };
    }

    const model = response.model;
    await saveAnalysis(groupId, toGuardAnalysis(parsed), model);
    processorDownUntil = 0;
    return { ok: true, model };
  } catch (error: unknown) {
    const status = (error as { status?: number }).status;
    // A network failure or 5xx means the service is down: stop asking for five minutes so a
    // dead host cannot add latency to every new problem. A 4xx is our bug, not an outage.
    if (!status || status >= 500) processorDownUntil = Date.now() + PROCESSOR_COOLDOWN_MS;

    await setAIStatus(groupId, 'failed').catch(() => undefined);
    console.warn(
      `[errorGuard] triage failed for group ${groupId}:`,
      error instanceof Error ? error.message.slice(0, 160) : 'unknown',
    );
    return { ok: false, reason: !status || status >= 500 ? 'unavailable' : 'failed' };
  } finally {
    inFlight.delete(groupId);
  }
}

/** Called from the aggregator's new-group hook. Never awaited, never throws. */
export function scheduleTriage(groupId: string): void {
  if (!isTriageEnabled()) return;
  setImmediate(() => {
    void analyzeGroup(groupId).catch(() => undefined);
  });
}

