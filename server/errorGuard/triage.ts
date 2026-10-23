/**
 * AI triage client — talks to the **AI processor service**, not to a provider directly.
 *
 * The processor (`external-services/ai-processor`, deployed at `AI_PROCESSOR_URL`) owns the
 * provider keys, the model router, the prompt and the cost log. It exposes one new route,
 * `POST /error-triage`, mounted by `registerErrorGuardTriage(app)`. Nothing else in that
 * service changed.
 *
 * This module's job is narrow:
 *  - decide whether to call at all (off switch, daily budget, one call at a time),
 *  - build a metadata-only payload (`buildTriagePayload`),
 *  - survive a dead/hanging service (timeout + cooldown),
 *  - validate the answer and store it.
 *
 * It never throws into the caller: the caller is the flush path of the error tracker.
 */
import {
  TRIAGE_PATH,
  buildTriagePayload,
  parseTriageResponse,
  toGuardAnalysis,
  type TriagePayload,
} from '@shared/errorGuard/triage';
import { getGroup, getSamples, saveAnalysis, setAIStatus } from './store';

const PROCESSOR_TIMEOUT_MS = Number(process.env.ERROR_GUARD_AI_TIMEOUT_MS) || 20_000;
const PROCESSOR_COOLDOWN_MS = Number(process.env.ERROR_GUARD_AI_COOLDOWN_MS) || 300_000;
const DAILY_BUDGET = Number(process.env.ERROR_GUARD_AI_BUDGET) || 25;
const MAX_CONCURRENT = 1;

let callsToday = 0;
let budgetDay = new Date().toISOString().slice(0, 10);
let processorDownUntil = 0;
const inFlight = new Set<string>();

function processorUrl(): string {
  return (process.env.AI_PROCESSOR_URL || 'https://ai-processor.formatika.dev').replace(/\/+$/, '');
}

/** `ERROR_GUARD_AI=off` is the only switch. The keys live in the processor, not here. */
export function isTriageEnabled(): boolean {
  return process.env.ERROR_GUARD_AI !== 'off';
}

export interface TriageStats {
  enabled: boolean;
  callsToday: number;
  budget: number;
  inFlight: number;
  processorReachable: boolean;
  processorUrl: string;
}

export function getTriageStats(): TriageStats {
  return {
    enabled: isTriageEnabled(),
    callsToday,
    budget: DAILY_BUDGET,
    inFlight: inFlight.size,
    processorReachable: Date.now() >= processorDownUntil,
    processorUrl: processorUrl(),
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

interface ProcessorResponse {
  analysis?: unknown;
  model?: string;
}

async function callProcessor(payload: TriagePayload): Promise<ProcessorResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROCESSOR_TIMEOUT_MS);

  try {
    const response = await fetch(`${processorUrl()}${TRIAGE_PATH}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.AI_PROCESSOR_API_KEY ? { 'x-api-key': process.env.AI_PROCESSOR_API_KEY } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 120);
      const error: Error & { status?: number } = new Error(
        `processor HTTP ${response.status}: ${detail}`,
      );
      error.status = response.status;
      throw error;
    }

    return (await response.json()) as ProcessorResponse;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Analyse one group through the AI processor.
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
    const response = await callProcessor(payload);

    const parsed = parseTriageResponse(response.analysis);
    if (!parsed) {
      await setAIStatus(groupId, 'failed').catch(() => undefined);
      // Log the group id, never the payload: it is derived from user-facing text.
      console.warn(`[errorGuard] processor returned an unusable shape for group ${groupId}`);
      return { ok: false, reason: 'invalid' };
    }

    const model = response.model ?? 'ai-processor';
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

