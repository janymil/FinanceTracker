import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The cache sits between a person and a paid model call. Three things must hold: an answer is
 * only reused for the same input, a stored *failure* is never served as an answer, and a person
 * who changes language never gets the old language back.
 */
const storage = vi.hoisted(() => ({
  getAICacheEntry: vi.fn(),
  setAICacheEntry: vi.fn(),
}));

vi.mock('../../server/storage', () => ({ storage }));
vi.mock('../../server/db', () => ({ db: {} }));

import { UnifiedAICache } from '../../lib/unifiedAICache';

beforeEach(() => {
  storage.getAICacheEntry.mockReset();
  storage.setAICacheEntry.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

const entry = (overrides: Record<string, unknown> = {}) => ({
  outputJson: { tips: ['cached'] },
  isError: false,
  expiresAt: new Date(Date.now() + 3_600_000),
  month: null,
  ...overrides,
});

describe('UnifiedAICache.get', () => {
  it('returns the stored answer for the same user, function and input', async () => {
    storage.getAICacheEntry.mockResolvedValueOnce(entry());
    const cache = new UnifiedAICache('financial-tips', 'user_1');

    expect(await cache.get({ a: 1 })).toEqual({ tips: ['cached'] });
    const [userId, functionKey, hash] = storage.getAICacheEntry.mock.calls[0];
    expect([userId, functionKey]).toEqual(['user_1', 'financial-tips']);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('misses when there is nothing stored', async () => {
    storage.getAICacheEntry.mockResolvedValueOnce(undefined);
    expect(await new UnifiedAICache('x', 'u').get({})).toBeNull();
  });

  it('never serves a stored failure as an answer', async () => {
    storage.getAICacheEntry.mockResolvedValueOnce(entry({ isError: true, outputJson: { tips: ['fallback'] } }));
    expect(await new UnifiedAICache('contextual-tips', 'u').get({})).toBeNull();
  });

  it('misses once the entry has expired', async () => {
    storage.getAICacheEntry.mockResolvedValueOnce(entry({ expiresAt: new Date(Date.now() - 1000) }));
    expect(await new UnifiedAICache('x', 'u').get({})).toBeNull();
  });

  it('misses when the stored month is not the month asked for', async () => {
    storage.getAICacheEntry.mockResolvedValueOnce(entry({ month: '2026-09' }));
    expect(await new UnifiedAICache('contextual-tips', 'u', '2026-10').get({})).toBeNull();

    storage.getAICacheEntry.mockResolvedValueOnce(entry({ month: '2026-10' }));
    expect(await new UnifiedAICache('contextual-tips', 'u', '2026-10').get({})).not.toBeNull();
  });

  it('treats a storage failure as a miss: the model is asked again instead of the page failing', async () => {
    storage.getAICacheEntry.mockRejectedValueOnce(new Error('db down'));
    expect(await new UnifiedAICache('x', 'u').get({})).toBeNull();
  });

  it('keys on the whole input, so another language is another entry', async () => {
    storage.getAICacheEntry.mockResolvedValue(undefined);
    const cache = new UnifiedAICache('spending-insights', 'u');
    await cache.get({ transactions: [1], language: 'es-pe' });
    await cache.get({ transactions: [1], language: 'sk-sk' });
    await cache.get({ transactions: [1], language: 'es-pe' });

    const hashes = storage.getAICacheEntry.mock.calls.map((call) => call[2]);
    expect(hashes[0]).not.toBe(hashes[1]);
    expect(hashes[0]).toBe(hashes[2]);
  });

  it('never mixes two people: the user id is part of every lookup', async () => {
    storage.getAICacheEntry.mockResolvedValue(undefined);
    await new UnifiedAICache('x', 'alice').get({ same: true });
    await new UnifiedAICache('x', 'bob').get({ same: true });
    expect(storage.getAICacheEntry.mock.calls.map((c) => c[0])).toEqual(['alice', 'bob']);
  });

  it('ignores a malformed month filter instead of matching nothing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    storage.getAICacheEntry.mockResolvedValueOnce(entry({ month: '2026-09' }));
    expect(await new UnifiedAICache('x', 'u', 'October').get({})).not.toBeNull();
  });
});

describe('UnifiedAICache.set', () => {
  it('stores with the function\'s default lifetime', async () => {
    await new UnifiedAICache('financial-tips', 'u').set({ a: 1 }, { out: 1 });
    expect(storage.setAICacheEntry.mock.calls[0][7]).toBe(168);

    await new UnifiedAICache('daily-recommendations', 'u').set({ a: 1 }, { out: 1 });
    expect(storage.setAICacheEntry.mock.calls[1][7]).toBe(24);
  });

  it('uses the lifetime the caller asks for', async () => {
    await new UnifiedAICache('financial-tips', 'u').set({}, {}, false, 5);
    expect(storage.setAICacheEntry.mock.calls[0][7]).toBe(5);
  });

  it('remembers a failure for an hour at most, so the next request can try the providers again', async () => {
    await new UnifiedAICache('contextual-tips', 'u').set({}, { tips: [] }, true, 72);
    const call = storage.setAICacheEntry.mock.calls[0];
    expect(call[6]).toBe(true);
    expect(call[7]).toBe(1);
  });

  it('does not stretch a short failure lifetime', async () => {
    await new UnifiedAICache('x', 'u').set({}, {}, true, 0.25);
    expect(storage.setAICacheEntry.mock.calls[0][7]).toBe(0.25);
  });
});
