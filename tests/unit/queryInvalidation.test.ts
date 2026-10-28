import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { QUERY_KEYS_BY_CHANGE, invalidateViewsFor } from '../../client/src/lib/queryClient';

/**
 * What a saved expense refreshes.
 *
 * The receipt modal used to invalidate `transactions` and `financial-summary` only, so a scan
 * saved from the top bar left the dashboard — the landing screen, and where the header's "scan a
 * receipt" is opened — showing the numbers from before. The person saw no change, reloaded the
 * page, and reported that the expense had not been saved at all.
 *
 * The key list now lives in one place, shared with the live-update stream, so the two cannot
 * drift back apart.
 */
describe('invalidateViewsFor', () => {
  function keysFor(changeType: keyof typeof QUERY_KEYS_BY_CHANGE): string[] {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
    invalidateViewsFor(client, changeType);
    return spy.mock.calls.map(([arg]) => String((arg as { queryKey: string[] }).queryKey[0]));
  }

  it('refreshes every view a new expense changes', () => {
    const keys = keysFor('transaction');

    expect(keys).toEqual([...QUERY_KEYS_BY_CHANGE.transaction]);
    // The list the expense lands in, and the two screens that aggregate it.
    expect(keys).toContain('transactions');
    expect(keys).toContain('financial-summary');
    expect(keys).toContain('dashboard-overview');
  });

  it('refreshes the month view for a budget change and the goal screens for a goal change', () => {
    expect(keysFor('budget')).toContain('dashboard-overview');
    expect(keysFor('goal')).toContain('goals');
  });

  it('invalidates by prefix, so a keyed list like ["transactions", userId] is covered', () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
    client.setQueryData(['transactions', 'user_1'], []);

    invalidateViewsFor(client, 'transaction');

    const keys = spy.mock.calls.map(([arg]) => (arg as { queryKey: string[] }).queryKey);
    expect(keys.flat()).toContain('transactions');
    expect(keys.every((key) => key.length === 1)).toBe(true);
  });
});
