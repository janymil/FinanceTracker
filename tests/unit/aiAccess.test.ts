import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();

vi.mock('../../server/storage', () => ({
  storage: { getUser: (...args: any[]) => getUser(...args) },
}));

import { checkAiAccess } from '../../server/aiAccess';

/**
 * Two promises, one gate:
 *   - free accounts never reach an AI provider;
 *   - the switch in Profile stops every AI feature.
 */
describe('checkAiAccess', () => {
  beforeEach(() => {
    getUser.mockReset();
  });

  it('rejects an anonymous caller', async () => {
    const access = await checkAiAccess(undefined);
    expect(access).toMatchObject({ allowed: false, code: 'unauthenticated' });
    expect(getUser).not.toHaveBeenCalled();
  });

  it('rejects a user that does not exist', async () => {
    getUser.mockResolvedValueOnce(undefined);
    const access = await checkAiAccess('user_missing');
    expect(access).toMatchObject({ allowed: false, code: 'unauthenticated' });
  });

  it('blocks the free plan even when AI is enabled', async () => {
    getUser.mockResolvedValueOnce({ id: 'user_1', plan: 'free', aiEnabled: true });
    const access = await checkAiAccess('user_1');
    expect(access).toMatchObject({ allowed: false, code: 'plan_required', plan: 'free' });
  });

  it('blocks a paid account that switched AI off', async () => {
    getUser.mockResolvedValueOnce({ id: 'user_1', plan: 'premium', aiEnabled: false });
    const access = await checkAiAccess('user_1');
    expect(access).toMatchObject({ allowed: false, code: 'ai_disabled' });
  });

  it('treats a missing flag (rows created before the switch existed) as enabled', async () => {
    getUser.mockResolvedValueOnce({ id: 'user_1', plan: 'standard' });
    const access = await checkAiAccess('user_1');
    expect(access).toMatchObject({ allowed: true });
  });

  it('allows standard and premium accounts with AI on', async () => {
    getUser.mockResolvedValueOnce({ id: 'user_1', plan: 'standard', aiEnabled: true });
    expect(await checkAiAccess('user_1')).toMatchObject({ allowed: true, plan: 'standard' });

    getUser.mockResolvedValueOnce({ id: 'user_2', plan: 'premium', aiEnabled: true });
    expect(await checkAiAccess('user_2')).toMatchObject({ allowed: true, plan: 'premium' });
  });
});
