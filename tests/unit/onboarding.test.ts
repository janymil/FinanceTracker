import { describe, expect, it, vi } from 'vitest';
import { safeRedirect, signInUrl } from '../../client/src/lib/authRedirect';
import { onboardingSteps } from '../../client/src/lib/onboardingSteps';
import { syncCreatedClerkUser } from '../../server/clerkUsers';
import { parseFirstTransaction } from '../../client/src/lib/firstTransaction';
import { currencyByCode, suggestCurrencyCode } from '../../shared/currencies';

describe('safeRedirect', () => {
  it('accepts pages of this app, query and hash included', () => {
    expect(safeRedirect('/es/budget')).toBe('/es/budget');
    expect(safeRedirect('/en/expenses?month=2026-10#top')).toBe('/en/expenses?month=2026-10#top');
  });

  it('refuses anything that could leave the site', () => {
    for (const bad of [
      '//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)',
      'evil.example', '', '   ', null, undefined, '/ok\nSet-Cookie: x=1', '/' + 'a'.repeat(600),
    ]) {
      expect(safeRedirect(bad as any), String(bad)).toBeNull();
    }
  });

  it('refuses the sign-in page itself and the API', () => {
    expect(safeRedirect('/en/auth')).toBeNull();
    expect(safeRedirect('/es/auth#sign-in')).toBeNull();
    expect(safeRedirect('/auth?x=1')).toBeNull();
    expect(safeRedirect('/api/auth/user')).toBeNull();
  });
});

describe('signInUrl', () => {
  it('carries the page the visitor wanted', () => {
    expect(signInUrl('es', '/es/budget?month=2026-10')).toBe('/es/auth?redirect=%2Fes%2Fbudget%3Fmonth%3D2026-10#sign-in');
  });

  it('falls back to a plain sign-in page', () => {
    expect(signInUrl('en')).toBe('/en/auth#sign-in');
    expect(signInUrl('en', '//evil.example')).toBe('/en/auth#sign-in');
    expect(signInUrl('en', '/en/auth')).toBe('/en/auth#sign-in');
  });
});

describe('onboarding steps by plan', () => {
  const base = { lang: 'en', transactionsCount: 0, incomeCount: 0, budgetsCount: 0, goalsCount: 0, importsCount: 0 };

  it('never sends a free account to features its plan does not include', () => {
    const { steps, coreCount } = onboardingSteps({ ...base, plan: 'free' });
    expect(steps.map((s) => s.key)).toEqual(['transaction', 'income', 'upgrade']);
    expect(steps.map((s) => s.key)).not.toContain('budget');
    expect(steps.map((s) => s.key)).not.toContain('goal');
    expect(steps.map((s) => s.key)).not.toContain('import');
    expect(coreCount).toBe(2);
  });

  it('a free account can finish the checklist', () => {
    const { steps, coreCount } = onboardingSteps({ ...base, plan: 'free', transactionsCount: 3, incomeCount: 1 });
    expect(steps.slice(0, coreCount).every((s) => s.done)).toBe(true);
  });

  it('an unknown or missing plan is treated as free', () => {
    expect(onboardingSteps({ ...base, plan: undefined }).steps.map((s) => s.key)).toContain('upgrade');
    expect(onboardingSteps({ ...base, plan: 'weird' }).steps.map((s) => s.key)).toContain('upgrade');
  });

  it('standard accounts get budget and goal but not import', () => {
    const { steps, coreCount } = onboardingSteps({ ...base, plan: 'standard' });
    expect(steps.map((s) => s.key)).toEqual(['transaction', 'budget', 'goal']);
    expect(coreCount).toBe(3);
  });

  it('premium adds import, ticked only by a real import, not by transaction count', () => {
    const manyManual = onboardingSteps({ ...base, plan: 'premium', transactionsCount: 50 });
    expect(manyManual.steps.find((s) => s.key === 'import')?.done).toBe(false);
    const imported = onboardingSteps({ ...base, plan: 'premium', importsCount: 1 });
    expect(imported.steps.find((s) => s.key === 'import')?.done).toBe(true);
  });

  it('keeps the language in every link', () => {
    const { steps } = onboardingSteps({ ...base, plan: 'premium', lang: 'sk' });
    expect(steps.every((s) => s.href.startsWith('/sk/'))).toBe(true);
  });
});

describe('Clerk user.created webhook', () => {
  const event = {
    id: 'user_1',
    email_addresses: [{ id: 'e1', email_address: 'ana@example.com' }],
    primary_email_address_id: 'e1',
    first_name: 'Ana',
    last_name: 'Lima',
    created_at: 1_760_000_000_000,
  };

  it('creates the account when it does not exist yet', async () => {
    const store = { getUser: vi.fn().mockResolvedValue(undefined), createUser: vi.fn().mockResolvedValue({}) };
    expect(await syncCreatedClerkUser(event, store)).toBe('created');
    expect(store.createUser).toHaveBeenCalledWith(expect.objectContaining({ id: 'user_1', email: 'ana@example.com', plan: 'free' }));
  });

  it('does nothing when the first dashboard load already created it', async () => {
    const store = { getUser: vi.fn().mockResolvedValue({ id: 'user_1' }), createUser: vi.fn() };
    expect(await syncCreatedClerkUser(event, store)).toBe('already-exists');
    expect(store.createUser).not.toHaveBeenCalled();
  });

  it('survives losing the race for the same id (no failure for Clerk to retry)', async () => {
    const store = {
      getUser: vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: 'user_1' }),
      createUser: vi.fn().mockRejectedValue({ code: '23505' }),
    };
    expect(await syncCreatedClerkUser(event, store)).toBe('already-exists');
  });

  it('acknowledges an e-mail that belongs to an older account; sign-in re-links it', async () => {
    const store = {
      getUser: vi.fn().mockResolvedValue(undefined),
      createUser: vi.fn().mockRejectedValue(Object.assign(new Error('duplicate key value violates unique constraint "users_email_unique"'), { code: '23505' })),
    };
    expect(await syncCreatedClerkUser(event, store)).toBe('email-belongs-to-another-account');
  });

  it('still fails loudly on real errors so Clerk retries', async () => {
    const store = { getUser: vi.fn().mockResolvedValue(undefined), createUser: vi.fn().mockRejectedValue(new Error('connection lost')) };
    await expect(syncCreatedClerkUser(event, store)).rejects.toThrow('connection lost');
  });

  it('copes with a missing created_at', async () => {
    const store = { getUser: vi.fn().mockResolvedValue(undefined), createUser: vi.fn().mockResolvedValue({}) };
    await syncCreatedClerkUser({ ...event, created_at: undefined }, store);
    expect(store.createUser.mock.calls[0][0].createdAt).toBeInstanceOf(Date);
  });
});

describe('first transaction form', () => {
  it('understands dot and comma decimals and trims the description', () => {
    expect(parseFirstTransaction('12.50', ' Coffee ')).toEqual({ amount: '12.50', description: 'Coffee' });
    expect(parseFirstTransaction('12,5', 'Lunch')).toEqual({ amount: '12.50', description: 'Lunch' });
    expect(parseFirstTransaction('1 200', 'Rent')).toEqual({ amount: '1200.00', description: 'Rent' });
  });

  it('refuses a missing amount or description, zero, negatives and words', () => {
    for (const [amount, description] of [['', 'x'], ['0', 'x'], ['-5', 'x'], ['abc', 'x'], ['10', ''], ['10', '   '], ['10', 'x'.repeat(201)]]) {
      expect(parseFirstTransaction(amount, description), `${amount}|${description}`).toBeNull();
    }
  });
});

describe('suggested currency', () => {
  it('follows the device time zone first', () => {
    expect(suggestCurrencyCode('America/Lima', 'en')).toBe('PEN');
    expect(suggestCurrencyCode('America/Mexico_City', 'es')).toBe('MXN');
    expect(suggestCurrencyCode('Europe/Bratislava', 'en')).toBe('EUR');
    expect(suggestCurrencyCode('Europe/Warsaw', 'en')).toBe('PLN');
    expect(suggestCurrencyCode('America/Guayaquil', 'es')).toBe('USD');
  });

  it('falls back to the page language, then to dollars', () => {
    expect(suggestCurrencyCode('Asia/Tokyo', 'es')).toBe('PEN');
    expect(suggestCurrencyCode(null, 'sk')).toBe('EUR');
    expect(suggestCurrencyCode(undefined, 'en')).toBe('USD');
    expect(suggestCurrencyCode('Nowhere/Land', undefined)).toBe('USD');
  });

  it('only ever suggests a currency the picker offers', () => {
    for (const zone of ['America/Lima', 'Europe/Prague', 'Australia/Perth', 'America/Caracas', 'Europe/London']) {
      expect(currencyByCode(suggestCurrencyCode(zone, 'en')), zone).toBeDefined();
    }
  });
});
