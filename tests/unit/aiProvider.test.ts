import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The router every AI call goes through: ai-processor gateway first, then the providers
 * directly (OpenAI, then DeepSeek, then Groq), with a breaker per hop. No network: `fetch`
 * stands in for the gateway and the `openai` package for the providers.
 */
const create = vi.hoisted(() => vi.fn());

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create } };
    constructor(public options: any) {}
  },
}));

import { collectAIUsage, getAIProviderStatus, resetAIBreakers, routeChat } from '../../lib/aiProvider';

const fetchMock = vi.fn();

const ok = (content = '{"ok":true}', meta: Record<string, unknown> = {}) => ({
  choices: [{ message: { role: 'assistant', content } }],
  usage: { prompt_tokens: 10, completion_tokens: 5 },
  ...meta,
});

const gatewayReply = (content = '{"via":"gateway"}') =>
  new Response(
    JSON.stringify({
      ...ok(content),
      model: 'gpt-6-luna',
      x_gateway: { provider: 'openai', model: 'gpt-6-luna', costUsd: 0.00012, fallback: false, ms: 40, redactions: 0 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

const gatewayError = (status: number, message = 'nope') =>
  new Response(JSON.stringify({ error: { message, type: 'x', code: 'x' } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const providerError = (status: number | undefined, message = 'boom') =>
  Object.assign(new Error(message), status ? { status } : {});

const params = (extra: Record<string, unknown> = {}) => ({
  model: 'gpt-6-luna',
  messages: [{ role: 'user', content: 'hello' }],
  ...extra,
});

const ENV_KEYS = [
  'AI_PROCESSOR_ENABLED', 'AI_PROCESSOR_URL', 'AI_PROCESSOR_API_KEY', 'AI_PROCESSOR_TIMEOUT_MS',
  'OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'GROQ_API_KEY', 'MISTRAL_API_KEY',
  'AI_BREAKER_THRESHOLD', 'AI_BREAKER_COOLDOWN_MS', 'AI_TOTAL_BUDGET_MS',
];

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  process.env.OPENAI_API_KEY = 'test-openai';
  process.env.DEEPSEEK_API_KEY = 'test-deepseek';
  process.env.GROQ_API_KEY = 'test-groq';
  create.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  resetAIBreakers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const enableGateway = () => {
  process.env.AI_PROCESSOR_ENABLED = 'true';
  process.env.AI_PROCESSOR_URL = 'https://gateway.test/';
  process.env.AI_PROCESSOR_API_KEY = 'gw-secret';
};

describe('direct providers only (gateway off)', () => {
  it('uses OpenAI and never touches fetch', async () => {
    create.mockResolvedValueOnce(ok('{"a":1}'));
    const response = await routeChat(params());
    expect(response.choices[0].message.content).toBe('{"a":1}');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('strips the router-only `task` field before anything leaves the process', async () => {
    create.mockResolvedValueOnce(ok());
    await routeChat(params({ task: 'tips' }));
    expect(create.mock.calls[0][0].task).toBeUndefined();
  });

  it('falls back to DeepSeek when OpenAI fails with a server error', async () => {
    create.mockRejectedValueOnce(providerError(500)).mockResolvedValueOnce(ok('{"from":"deepseek"}'));
    const response = await routeChat(params());
    expect(response.choices[0].message.content).toContain('deepseek');
    expect(create.mock.calls[1][0].model).toBe('deepseek-flash');
  });

  it('treats a rate limit and a network failure as reasons to try the next provider', async () => {
    create
      .mockRejectedValueOnce(providerError(429))
      .mockRejectedValueOnce(providerError(undefined, 'socket hang up'))
      .mockResolvedValueOnce(ok('{"from":"groq"}'));
    const response = await routeChat(params());
    expect(response.choices[0].message.content).toContain('groq');
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('stops at once on a request the provider calls invalid: the next one would refuse it too', async () => {
    create.mockRejectedValueOnce(providerError(400, 'bad schema'));
    await expect(routeChat(params())).rejects.toThrow('bad schema');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('treats an empty reply as a failure, not as an answer', async () => {
    create.mockResolvedValueOnce(ok('   ')).mockResolvedValueOnce(ok('{"second":true}'));
    const response = await routeChat(params());
    expect(response.choices[0].message.content).toContain('second');
  });

  it('strips a ```json fence some models add', async () => {
    create.mockResolvedValueOnce(ok('```json\n{"x":1}\n```'));
    const response = await routeChat(params());
    expect(response.choices[0].message.content).toBe('{"x":1}');
  });

  it('throws the last error when every provider fails', async () => {
    create.mockRejectedValue(providerError(503, 'down'));
    await expect(routeChat(params())).rejects.toThrow('down');
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('says so plainly when no provider is configured at all', async () => {
    for (const key of ['OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'GROQ_API_KEY']) delete process.env[key];
    await expect(routeChat(params())).rejects.toThrow('No AI provider is configured');
  });

  it('stops walking the chain once the time budget is spent', async () => {
    process.env.AI_TOTAL_BUDGET_MS = '1000';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    create.mockImplementation(async () => {
      vi.setSystemTime(new Date(Date.now() + 2000));
      throw providerError(503);
    });
    await expect(routeChat(params())).rejects.toThrow();
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe('anonymising', () => {
  it('removes an e-mail and an IBAN before the prompt reaches a provider', async () => {
    create.mockResolvedValueOnce(ok());
    await routeChat(params({
      messages: [{ role: 'user', content: 'Paid to ana@example.com from CH9300762011623852957' }],
    }));
    const sent = JSON.stringify(create.mock.calls[0][0].messages);
    expect(sent).not.toContain('ana@example.com');
    expect(sent).not.toContain('CH9300762011623852957');
  });

  it('does the same on the way to the gateway', async () => {
    enableGateway();
    fetchMock.mockResolvedValueOnce(gatewayReply());
    await routeChat(params({
      messages: [{ role: 'user', content: 'Refund for ana@example.com' }],
    }));
    const body = String(fetchMock.mock.calls[0][1].body);
    expect(body).not.toContain('ana@example.com');
  });
});

describe('gateway first', () => {
  beforeEach(enableGateway);

  it('answers from the gateway and never calls a provider', async () => {
    fetchMock.mockResolvedValueOnce(gatewayReply('{"via":"gateway"}'));
    const response = await routeChat(params({ task: 'tips' }));
    expect(response.choices[0].message.content).toBe('{"via":"gateway"}');
    expect(create).not.toHaveBeenCalled();
  });

  it('calls /v1/chat/completions with the key and the app name, and keeps `task` in a header only', async () => {
    fetchMock.mockResolvedValueOnce(gatewayReply());
    await routeChat(params({ task: 'tips' }));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://gateway.test/v1/chat/completions');
    expect(init.headers['x-api-key']).toBe('gw-secret');
    expect(init.headers['x-app']).toBe('kaptia');
    expect(init.headers['x-task']).toBe('tips');
    expect(JSON.parse(init.body).task).toBeUndefined();
  });

  it('reports real tokens and cost from the gateway, tagged as gateway', async () => {
    fetchMock.mockResolvedValueOnce(gatewayReply());
    const { records } = await collectAIUsage(() => routeChat(params({ task: 'tips' })));
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      via: 'gateway', provider: 'openai', model: 'gpt-6-luna',
      inputTokens: 10, outputTokens: 5, costUsd: 0.00012, fallback: false, task: 'tips',
    });
  });

  it.each([500, 502, 503, 504, 429, 401])('falls back to OpenAI directly on a gateway %i', async (status) => {
    fetchMock.mockResolvedValueOnce(gatewayError(status));
    create.mockResolvedValueOnce(ok('{"via":"direct"}'));
    const { result, records } = await collectAIUsage(() => routeChat(params()));
    expect(result.choices[0].message.content).toBe('{"via":"direct"}');
    expect(records[0]).toMatchObject({ via: 'direct', fallback: true });
  });

  it('falls back on a timeout and on a network failure', async () => {
    fetchMock
      .mockRejectedValueOnce(Object.assign(new Error('timed out'), { name: 'TimeoutError' }))
      .mockRejectedValueOnce(new TypeError('fetch failed'));
    create.mockResolvedValue(ok());
    await routeChat(params());
    await routeChat(params());
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('falls back on an empty gateway reply', async () => {
    fetchMock.mockResolvedValueOnce(gatewayReply('   '));
    create.mockResolvedValueOnce(ok('{"via":"direct"}'));
    const response = await routeChat(params());
    expect(response.choices[0].message.content).toBe('{"via":"direct"}');
  });

  it('is not used without a key: a gateway with no key would be open to anyone', async () => {
    delete process.env.AI_PROCESSOR_API_KEY;
    create.mockResolvedValueOnce(ok());
    await routeChat(params());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is not used when switched off, even with a URL and a key', async () => {
    process.env.AI_PROCESSOR_ENABLED = 'false';
    create.mockResolvedValueOnce(ok());
    await routeChat(params());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still works when the gateway is the only thing configured', async () => {
    for (const key of ['OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'GROQ_API_KEY']) delete process.env[key];
    fetchMock.mockResolvedValueOnce(gatewayReply());
    await expect(routeChat(params())).resolves.toBeTruthy();
  });

  it('reports the gateway error when it fails and nothing else is configured', async () => {
    for (const key of ['OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'GROQ_API_KEY']) delete process.env[key];
    fetchMock.mockResolvedValueOnce(gatewayError(503, 'gateway down'));
    await expect(routeChat(params())).rejects.toThrow(/gateway down/);
  });

  it('gives bank statements the long timeout and everything else the normal one', async () => {
    fetchMock.mockImplementation(async () => gatewayReply());
    const spy = vi.spyOn(AbortSignal, 'timeout');
    await routeChat(params({ task: 'parseBankStatement' }));
    await routeChat(params({ task: 'tips' }));
    expect(spy.mock.calls[0][0]).toBe(120_000);
    expect(spy.mock.calls[1][0]).toBe(45_000);
  });
});

describe('gateway circuit breaker', () => {
  beforeEach(() => {
    enableGateway();
    create.mockResolvedValue(ok('{"via":"direct"}'));
  });

  it('skips the gateway after three failures in a row, so an outage costs one slow request', async () => {
    fetchMock.mockResolvedValue(gatewayError(503));
    for (let i = 0; i < 3; i += 1) await routeChat(params());
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await routeChat(params());
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getAIProviderStatus().gateway).toMatchObject({ circuit: 'open', consecutiveFailures: 3 });
  });

  it('tries the gateway again after the cooldown, and closes once it answers', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    fetchMock.mockResolvedValue(gatewayError(503));
    for (let i = 0; i < 3; i += 1) await routeChat(params());

    vi.setSystemTime(new Date('2026-01-01T00:01:01Z'));
    fetchMock.mockResolvedValueOnce(gatewayReply());
    const response = await routeChat(params());
    expect(response.choices[0].message.content).toContain('gateway');
    expect(getAIProviderStatus().gateway).toMatchObject({ circuit: 'closed', consecutiveFailures: 0 });
  });

  it('does not count a request the gateway rejected as invalid against the gateway', async () => {
    fetchMock.mockResolvedValue(gatewayError(400, 'too large'));
    for (let i = 0; i < 5; i += 1) await routeChat(params());
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(getAIProviderStatus().gateway.circuit).toBe('closed');
  });

  it('one success resets the count', async () => {
    fetchMock
      .mockResolvedValueOnce(gatewayError(503))
      .mockResolvedValueOnce(gatewayError(503))
      .mockResolvedValueOnce(gatewayReply())
      .mockResolvedValue(gatewayError(503));
    for (let i = 0; i < 5; i += 1) await routeChat(params());
    expect(getAIProviderStatus().gateway.circuit).toBe('closed');
  });
});

describe('direct provider circuit breaker', () => {
  it('skips a provider that keeps failing and goes straight to the next', async () => {
    create.mockImplementation(async (body: any) => {
      if (body.model === 'gpt-6-luna') throw providerError(503);
      return ok('{"from":"deepseek"}');
    });
    for (let i = 0; i < 3; i += 1) await routeChat(params());
    create.mockClear();

    await routeChat(params());
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].model).toBe('deepseek-flash');
  });

  it('still tries every provider when all of them are open, instead of refusing the request', async () => {
    create.mockRejectedValue(providerError(503));
    for (let i = 0; i < 3; i += 1) await routeChat(params()).catch(() => undefined);
    create.mockClear();
    create.mockResolvedValue(ok());

    await expect(routeChat(params())).resolves.toBeTruthy();
    expect(create).toHaveBeenCalled();
  });
});

describe('status for diagnostics', () => {
  it('reports the gateway and each provider without any key', () => {
    enableGateway();
    const status = getAIProviderStatus();
    expect(status.gateway).toMatchObject({ enabled: true, configured: true, circuit: 'closed' });
    expect(status.providers.find((p) => p.provider === 'openai')).toMatchObject({ configured: true });
    expect(JSON.stringify(status)).not.toContain('gw-secret');
    expect(JSON.stringify(status)).not.toContain('test-openai');
  });
});
