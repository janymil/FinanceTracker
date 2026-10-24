import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkAiGateway, resetAiGatewayHealthCache } from '../../server/aiGatewayHealth';

/**
 * The gateway may be down without the app being down (calls fall back to the providers), so it
 * can only ever read "degraded". And because /api/health/deep is public, answers are cached.
 */
const fetchMock = vi.fn();

const health = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  resetAiGatewayHealthCache();
  process.env.AI_PROCESSOR_ENABLED = 'true';
  process.env.AI_PROCESSOR_URL = 'https://gateway.test';
  process.env.AI_PROCESSOR_API_KEY = 'secret';
});

afterEach(() => {
  delete process.env.AI_PROCESSOR_ENABLED;
  delete process.env.AI_PROCESSOR_URL;
  delete process.env.AI_PROCESSOR_API_KEY;
});

describe('checkAiGateway', () => {
  it('is "disabled" when the gateway is switched off, without any request', async () => {
    process.env.AI_PROCESSOR_ENABLED = 'false';
    expect(await checkAiGateway()).toBe('disabled');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is "ok" when the gateway answers and has its key configured', async () => {
    fetchMock.mockResolvedValueOnce(health({ status: 'ok', authConfigured: true }));
    expect(await checkAiGateway()).toBe('ok');
    expect(fetchMock.mock.calls[0][0]).toBe('https://gateway.test/health');
  });

  it('is "degraded" when the gateway is up but has no key (it would refuse every request)', async () => {
    fetchMock.mockResolvedValueOnce(health({ status: 'ok', authConfigured: false }));
    expect(await checkAiGateway()).toBe('degraded');
  });

  it.each([
    ['an error status', () => fetchMock.mockResolvedValueOnce(health({ status: 'ok' }, 503))],
    ['a network failure', () => fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))],
    ['a timeout', () => fetchMock.mockRejectedValueOnce(Object.assign(new Error('t'), { name: 'TimeoutError' }))],
    ['nonsense', () => fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 200 }))],
  ])('is "degraded" on %s, never an error', async (_name, arrange) => {
    arrange();
    expect(await checkAiGateway()).toBe('degraded');
  });

  it('is "degraded" when enabled but not fully configured', async () => {
    delete process.env.AI_PROCESSOR_API_KEY;
    expect(await checkAiGateway()).toBe('degraded');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers from the cache for 30 seconds, so a public endpoint cannot hammer the gateway', async () => {
    fetchMock.mockResolvedValue(health({ status: 'ok', authConfigured: true }));
    const t0 = 1_000_000;
    await checkAiGateway(t0);
    await checkAiGateway(t0 + 29_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await checkAiGateway(t0 + 31_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('asks with a short timeout, under the synthetic check\'s latency budget', async () => {
    fetchMock.mockResolvedValueOnce(health({ status: 'ok', authConfigured: true }));
    const spy = vi.spyOn(AbortSignal, 'timeout');
    await checkAiGateway();
    expect(spy.mock.calls[0][0]).toBeLessThan(2000);
  });
});
