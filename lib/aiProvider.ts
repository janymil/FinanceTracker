import OpenAI from 'openai';
import { AsyncLocalStorage } from 'node:async_hooks';
import { anonymizeMessages } from '../shared/aiAnonymizer';

/**
 * Central AI routing layer.
 *
 * Default model is gpt-6-luna ($0.10 / $0.50 per 1M tokens) for every task, per the
 * cost/quality benchmark. If OpenAI fails, the request is retried on DeepSeek and then
 * on Groq, so a single provider outage never returns a "canned" answer.
 *
 * The router also:
 *  - strips ```json fences (gpt-4o-mini used to add them and break JSON.parse),
 *  - normalises max_tokens -> max_completion_tokens for OpenAI reasoning models,
 *  - records real token usage and cost through AsyncLocalStorage, so ai_usage rows stop
 *    reporting the fake "gpt-4o / $0.001" values.
 */

export type AIProvider = 'openai' | 'deepseek' | 'groq' | 'mistral';

export interface AIModelSpec {
  provider: AIProvider;
  model: string;
  inputPricePerM: number;
  outputPricePerM: number;
  reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium';
  thinking?: 'disabled';
}

/** Task aliases. Splitting a task onto another model later is a one-line change here. */
export const AI_MODELS = {
  /** User-facing prose: tips, insights, recommendations, health score, trends. */
  generation: 'gpt-6-luna',
  /** Structured extraction: statement parsing, OCR post-processing. */
  parsing: 'gpt-6-luna',
  /** Short classification: expense/income categorisation, voice parsing. */
  classification: 'gpt-6-luna',
  /** Anything not specified above. */
  default: 'gpt-6-luna',
} as const;

export const MODEL_CATALOG: Record<string, AIModelSpec> = {
  'gpt-6-luna': { provider: 'openai', model: 'gpt-6-luna', inputPricePerM: 0.1, outputPricePerM: 0.5, reasoningEffort: 'none' },
  'gpt-5-nano': { provider: 'openai', model: 'gpt-5-nano', inputPricePerM: 0.05, outputPricePerM: 0.4, reasoningEffort: 'minimal' },
  'gpt-6.1-sol': { provider: 'openai', model: 'gpt-6.1-sol', inputPricePerM: 2, outputPricePerM: 10 },
  'deepseek-flash': { provider: 'deepseek', model: 'deepseek-flash', inputPricePerM: 0.3, outputPricePerM: 1.2, thinking: 'disabled' },
  'deepseek-v4-pro': { provider: 'deepseek', model: 'deepseek-v4-pro', inputPricePerM: 1.32, outputPricePerM: 3.96, thinking: 'disabled' },
  'openai/gpt-oss-20b': { provider: 'groq', model: 'openai/gpt-oss-20b', inputPricePerM: 0.075, outputPricePerM: 0.3 },
  'openai/gpt-oss-120b': { provider: 'groq', model: 'openai/gpt-oss-120b', inputPricePerM: 0.15, outputPricePerM: 0.6 },
  'mistral-small-latest': { provider: 'mistral', model: 'mistral-small-latest', inputPricePerM: 0.15, outputPricePerM: 0.6 },
};

/** Ordered fallbacks per primary model. Missing keys are skipped automatically. */
const FALLBACKS: Record<string, string[]> = {
  'gpt-6-luna': ['deepseek-flash', 'openai/gpt-oss-20b'],
  'gpt-5-nano': ['openai/gpt-oss-20b', 'deepseek-flash'],
  'deepseek-flash': ['gpt-6-luna', 'openai/gpt-oss-20b'],
  default: ['deepseek-flash'],
};

const PROVIDER_KEYS: Record<AIProvider, string | undefined> = {
  openai: process.env.OPENAI_API_KEY,
  deepseek: process.env.DEEPSEEK_API_KEY,
  groq: process.env.GROQ_API_KEY,
  mistral: process.env.MISTRAL_API_KEY,
};

const PROVIDER_BASE_URLS: Partial<Record<AIProvider, string>> = {
  deepseek: 'https://api.deepseek.com',
  groq: 'https://api.groq.com/openai/v1',
  mistral: 'https://api.mistral.ai/v1',
};

export interface AIUsageRecord {
  model: string;
  provider: AIProvider | 'unknown';
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  fallback: boolean;
  task?: string;
}

const usageStorage = new AsyncLocalStorage<AIUsageRecord[]>();

/** Collects usage for everything executed inside `fn` (safe across concurrent requests). */
export async function collectAIUsage<T>(fn: () => Promise<T>): Promise<{ result: T; records: AIUsageRecord[] }> {
  const records: AIUsageRecord[] = [];
  const result = await usageStorage.run(records, fn);
  return { result, records };
}

function recordUsage(record: AIUsageRecord): void {
  usageStorage.getStore()?.push(record);
}

const clients = new Map<AIProvider, OpenAI>();

function clientFor(provider: AIProvider): OpenAI {
  const cached = clients.get(provider);
  if (cached) return cached;

  const apiKey = PROVIDER_KEYS[provider];
  if (!apiKey) throw new Error(`No API key configured for provider "${provider}"`);

  const client = new OpenAI({
    apiKey,
    baseURL: PROVIDER_BASE_URLS[provider],
    timeout: Number(process.env.AI_REQUEST_TIMEOUT_MS) || 90_000,
    maxRetries: 0,
  });
  clients.set(provider, client);
  return client;
}

/** Removes a leading/trailing ```json fence that some models add around JSON payloads. */
export function stripCodeFences(text: string): string {
  if (!text) return text;
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return text;
  return trimmed.replace(/^```[a-zA-Z0-9_-]*\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
}

function sanitizeResponse(response: any): any {
  for (const choice of response?.choices ?? []) {
    const content = choice?.message?.content;
    if (typeof content === 'string') {
      choice.message.content = stripCodeFences(content);
    }
  }
  return response;
}

function resolveSpec(requested: string): AIModelSpec {
  if (MODEL_CATALOG[requested]) return MODEL_CATALOG[requested];
  // Unknown ids pass through to OpenAI (e.g. a model pinned in an older call site).
  return { provider: 'openai', model: requested, inputPricePerM: 0.1, outputPricePerM: 0.5, reasoningEffort: 'none' };
}

export function buildBody(spec: AIModelSpec, params: any): any {
  // `task` is this router's own attribution field, not an OpenAI parameter. Forwarding it
  // makes the provider answer `400 Unknown parameter: 'task'`, so it must never leave here.
  const { task: _task, ...requestParams } = params ?? {};
  const body: any = { ...requestParams, model: spec.model };

  // OpenAI reasoning models reject max_tokens; they expect max_completion_tokens.
  if (spec.provider === 'openai' && body.max_tokens != null) {
    body.max_completion_tokens = body.max_tokens;
    delete body.max_tokens;
  }

  const effort = process.env.AI_REASONING_EFFORT || spec.reasoningEffort;
  if (spec.provider === 'openai' && effort) {
    body.reasoning_effort = effort;
  } else {
    delete body.reasoning_effort;
  }

  // DeepSeek defaults to thinking mode, which can consume the whole output budget and
  // return empty content. Always disable it for these short, structured tasks.
  if (spec.thinking === 'disabled') {
    body.thinking = { type: 'disabled' };
  }

  return body;
}

async function callModel(spec: AIModelSpec, params: any, fallback: boolean, task?: string): Promise<any> {
  const client = clientFor(spec.provider);
  const body = buildBody(spec, params);

  let response: any;
  try {
    response = await client.chat.completions.create(body);
  } catch (error: any) {
    // Older prompt code sets temperature, which some reasoning models reject. Retry once
    // without sampling parameters before giving up on this provider.
    const message = String(error?.message || '');
    if (error?.status === 400 && /temperature|top_p|unsupported parameter/i.test(message)) {
      const retryBody = { ...body };
      delete retryBody.temperature;
      delete retryBody.top_p;
      response = await client.chat.completions.create(retryBody);
    } else {
      throw error;
    }
  }

  const content = response?.choices?.[0]?.message?.content;
  if (!content || (typeof content === 'string' && content.trim() === '')) {
    throw new Error(`Empty response from ${spec.provider}:${spec.model}`);
  }

  const inputTokens = response?.usage?.prompt_tokens ?? 0;
  const outputTokens = response?.usage?.completion_tokens ?? 0;

  recordUsage({
    model: spec.model,
    provider: spec.provider,
    inputTokens,
    outputTokens,
    costUsd: (inputTokens * spec.inputPricePerM + outputTokens * spec.outputPricePerM) / 1_000_000,
    fallback,
    task,
  });

  return sanitizeResponse(response);
}

async function routeChat(params: any): Promise<any> {
  // Single choke point: nothing reaches a provider with an e-mail, IBAN, card, phone,
  // address, account number or the user's own name inside the prompt.
  if (Array.isArray(params?.messages)) {
    params = { ...params, messages: anonymizeMessages(params.messages) };
  }

  const primaryName = String(params?.model || AI_MODELS.default);
  const chain = [primaryName, ...(FALLBACKS[primaryName] ?? FALLBACKS.default)];
  let lastError: any;

  for (let i = 0; i < chain.length; i++) {
    const spec = resolveSpec(chain[i]);

    if (!PROVIDER_KEYS[spec.provider]) {
      lastError = new Error(`Provider ${spec.provider} has no API key`);
      continue;
    }

    try {
      return await callModel(spec, params, i > 0, params?.task);
    } catch (error: any) {
      lastError = error;
      // A 4xx that is not auth/rate-limit means the request itself is wrong: retrying on
      // another provider would fail the same way, so stop early.
      if (error?.status && error.status >= 400 && error.status < 500 && ![401, 403, 408, 409, 429].includes(error.status)) {
        throw error;
      }
      console.warn(
        `[AI] ${spec.provider}:${spec.model} failed (${error?.status || 'network'}: ${String(error?.message || error).slice(0, 120)}); trying next provider`,
      );
    }
  }

  throw lastError ?? new Error('All AI providers failed');
}

/**
 * Drop-in replacement for `new OpenAI(...)` that respects the routing above.
 * The app only uses `chat.completions.create`.
 */
export function createRoutedClient(): OpenAI {
  return {
    chat: { completions: { create: routeChat } },
  } as unknown as OpenAI;
}

/** Cheap diagnostics used by /api/ai/health. */
export function getAIProviderStatus() {
  return {
    defaultModel: AI_MODELS.default,
    reasoningEffort: process.env.AI_REASONING_EFFORT || 'none',
    providers: (Object.keys(PROVIDER_KEYS) as AIProvider[]).map((provider) => ({
      provider,
      configured: Boolean(PROVIDER_KEYS[provider]),
    })),
    fallbacks: FALLBACKS[AI_MODELS.default] ?? [],
  };
}
