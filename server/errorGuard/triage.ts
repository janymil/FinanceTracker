/**
 * AI triage for Error Guard — an **independent** module.
 *
 * Deliberate architectural choice: nothing here touches the running `ai-processor`
 * service, `lib/aiProcessor.ts`, or any existing prompt/specialist. The call goes through
 * `lib/aiProvider.createRoutedClient()` — the same router `server/openai.ts` already uses —
 * with its own task name (`error-triage`), its own model alias (`classification`), its own
 * budget and its own prompt (in `shared/errorGuard/triage.ts`).
 *
 * That means: zero redeploy of ai-processor, zero risk to the ten financial AI tasks, and
 * removing this feature is deleting this file.
 *
 * Invariants:
 *  - never throws into the caller (the caller is the flush path);
 *  - never blocks a request (fire-and-forget after the row exists);
 *  - never sends user data — the prompt is built from scrubbed metadata only;
 *  - never spends more than `ERROR_GUARD_AI_BUDGET` calls per UTC day.
 */
import { AI_MODELS, createRoutedClient, getAIProviderStatus } from '../../lib/aiProvider';
import {
  buildTriagePrompt,
  parseTriageResponse,
  toGuardAnalysis,
  TRIAGE_TASK,
  type TriageInput,
} from '@shared/errorGuard/triage';
import type { GuardGroup } from '@shared/errorGuard/types';
import { getGroup, getSamples, saveAnalysis, setAIStatus, type GuardSample } from './store';

const DAILY_BUDGET = Number(process.env.ERROR_GUARD_AI_BUDGET) || 25;
const CALL_TIMEOUT_MS = Number(process.env.ERROR_GUARD_AI_TIMEOUT_MS) || 25_000;
const MAX_CONCURRENT = 1;

let callsToday = 0;
let budgetDay = new Date().toISOString().slice(0, 10);
const inFlight = new Set<string>();

/** Off switch is explicit: `ERROR_GUARD_AI=off`, or simply no provider key configured. */
export function isTriageEnabled(): boolean {
  if (process.env.ERROR_GUARD_AI === 'off') return false;
  try {
    return getAIProviderStatus().providers.some((provider) => provider.configured);
  } catch {
    return false;
  }
}

export interface TriageStats {
  enabled: boolean;
  callsToday: number;
  budget: number;
  inFlight: number;
}

export function getTriageStats(): TriageStats {
  return { enabled: isTriageEnabled(), callsToday, budget: DAILY_BUDGET, inFlight: inFlight.size };
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

function safeJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/** Only metadata goes into the prompt: the message, the top frames, the key names. */
export function buildTriageInput(group: GuardGroup, samples: GuardSample[]): TriageInput {
  const sample = samples[0];
  const stackFrames = (sample?.stack ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at '))
    .slice(0, 5);

  const contextKeys = sample?.context && typeof sample.context === 'object'
    ? Object.keys(sample.context).slice(0, 15)
    : undefined;

  const breadcrumbLabels = Array.isArray(sample?.breadcrumbs)
    ? (sample.breadcrumbs as Array<{ label?: unknown }>)
        .map((crumb) => (typeof crumb?.label === 'string' ? crumb.label : null))
        .filter((label): label is string => Boolean(label))
        .slice(-8)
    : undefined;

  return {
    title: group.title,
    kind: group.kind,
    route: group.route,
    release: group.release,
    platform: null,
    severity: group.severity,
    moneyPath: group.moneyPath,
    eventCount: group.eventCount,
    message: group.message,
    stackFrames: stackFrames.length > 0 ? stackFrames : undefined,
    contextKeys,
    breadcrumbLabels,
  };
}

export type TriageOutcome =
  | { ok: true; model: string }
  | { ok: false; reason: 'disabled' | 'budget' | 'in-flight' | 'missing' | 'invalid' | 'failed' };

/**
 * Analyse one group. Fire-and-forget from the flush path; returns an outcome so the admin
 * "Explain this" button can tell the user what happened instead of hanging.
 */
export async function analyzeGroup(groupId: string): Promise<TriageOutcome> {
  if (!isTriageEnabled()) {
    await setAIStatus(groupId, 'skipped').catch(() => undefined);
    return { ok: false, reason: 'disabled' };
  }
  if (inFlight.has(groupId) || inFlight.size >= MAX_CONCURRENT) {
    return { ok: false, reason: 'in-flight' };
  }
  if (!consumeBudget()) {
    await setAIStatus(groupId, 'skipped').catch(() => undefined);
    return { ok: false, reason: 'budget' };
  }

  inFlight.add(groupId);
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    const group = await getGroup(groupId);
    if (!group) return { ok: false, reason: 'missing' };

    const samples = await getSamples(groupId, 3);
    const prompt = buildTriagePrompt(buildTriageInput(group, samples));

    const client = createRoutedClient();
    const request = client.chat.completions.create({
      model: AI_MODELS.classification,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 600,
      // Custom field consumed by the router in lib/aiProvider.ts (usage attribution).
      task: TRIAGE_TASK,
    } as never) as unknown as Promise<{
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
    }>;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error('triage timeout')), CALL_TIMEOUT_MS);
      if (typeof timeout.unref === 'function') timeout.unref();
    });

    const completion = await Promise.race([request, timeoutPromise]);
    const parsed = parseTriageResponse(safeJson(completion?.choices?.[0]?.message?.content));

    if (!parsed) {
      await setAIStatus(groupId, 'failed').catch(() => undefined);
      // Log the group id, never the prompt: the prompt is derived from user-facing text.
      console.warn(`[errorGuard] triage returned an unusable shape for group ${groupId}`);
      return { ok: false, reason: 'invalid' };
    }

    const model = completion?.model ?? AI_MODELS.classification;
    await saveAnalysis(groupId, toGuardAnalysis(parsed), model);
    return { ok: true, model };
  } catch (error: unknown) {
    await setAIStatus(groupId, 'failed').catch(() => undefined);
    console.warn(
      `[errorGuard] triage failed for group ${groupId}:`,
      error instanceof Error ? error.message.slice(0, 160) : 'unknown',
    );
    return { ok: false, reason: 'failed' };
  } finally {
    if (timeout) clearTimeout(timeout);
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
