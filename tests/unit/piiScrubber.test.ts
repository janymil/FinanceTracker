import { describe, expect, it } from 'vitest';
import {
  scrubBreadcrumb,
  scrubEvent,
  scrubString,
  scrubValue,
} from '../../shared/piiScrubber';

/**
 * Module 7 of step 6: PII scrubbing for error reporting.
 * This is the only thing standing between a voice transcript and Sentry.
 */

describe('scrubString', () => {
  it('redacts e-mail addresses', () => {
    expect(scrubString('user jana.novakova@example.com failed')).toBe('user [redacted:email] failed');
  });

  it('redacts IBANs', () => {
    expect(scrubString('ucet SK61 0000 0000 1234 5678 9012 neplatny')).toContain('[redacted:iban]');
  });

  it('redacts card numbers in both shapes', () => {
    expect(scrubString('karta 4111 1111 1111 1111')).toContain('[redacted:card]');
    expect(scrubString('karta 4111111111111111')).toContain('[redacted:card]');
  });

  it('redacts international and local phone numbers', () => {
    expect(scrubString('tel +421 912 345 678')).toContain('[redacted:phone]');
    expect(scrubString('tel 0912 345 678')).toContain('[redacted:phone]');
  });

  it('keeps ordinary text and amounts intact', () => {
    expect(scrubString('expense 84.30 EUR for lunch')).toBe('expense 84.30 EUR for lunch');
    expect(scrubString('')).toBe('');
  });

  it('is idempotent', () => {
    const once = scrubString('jana@example.com 4111111111111111');
    expect(scrubString(once)).toBe(once);
  });
});

describe('scrubValue', () => {
  it('redacts values under sensitive keys', () => {
    const scrubbed = scrubValue({
      description: 'Lidl nakup',
      transcript: 'kupil som naftu',
      ocrText: 'SPOLU 24,89',
      referenceNote: 'pozna',
      email: 'a@b.c',
      password: 'hunter2',
      apiKey: 'sk-123',
      firstName: 'Jana',
    }) as Record<string, unknown>;

    expect(scrubbed.description).toBe('[redacted]');
    expect(scrubbed.transcript).toBe('[redacted]');
    expect(scrubbed.ocrText).toBe('[redacted]');
    expect(scrubbed.referenceNote).toBe('[redacted]');
    expect(scrubbed.email).toBe('[redacted]');
    expect(scrubbed.password).toBe('[redacted]');
    expect(scrubbed.apiKey).toBe('[redacted]');
    expect(scrubbed.firstName).toBe('[redacted]');
  });

  it('keeps non-sensitive keys and numbers (debugging needs them)', () => {
    const scrubbed = scrubValue({ categoryName: 'Potraviny', amountInCents: 8430, ok: true }) as Record<string, unknown>;
    expect(scrubbed).toEqual({ categoryName: 'Potraviny', amountInCents: 8430, ok: true });
  });

  it('walks nested objects and arrays', () => {
    const scrubbed = scrubValue({
      payload: { user: { email: 'a@b.c', id: 'user_123' } },
      items: [{ description: 'secret', amountInCents: 100 }],
    }) as any;

    expect(scrubbed.payload.user.email).toBe('[redacted]');
    expect(scrubbed.payload.user.id).toBe('user_123');
    expect(scrubbed.items[0].description).toBe('[redacted]');
    expect(scrubbed.items[0].amountInCents).toBe(100);
  });

  it('still scrubs secrets inside strings that are not under a sensitive key', () => {
    const scrubbed = scrubValue({ message: 'contact jana@example.com' }) as Record<string, unknown>;
    expect(scrubbed.message).toBe('contact [redacted:email]');
  });

  it('truncates long arrays', () => {
    const scrubbed = scrubValue(Array.from({ length: 60 }, (_, index) => index)) as unknown[];
    expect(scrubbed).toHaveLength(51);
    expect(scrubbed[50]).toBe('[redacted:truncated]');
  });

  it('stops at the depth limit', () => {
    let deep: any = { value: 'x' };
    for (let i = 0; i < 12; i += 1) deep = { nested: deep };
    expect(JSON.stringify(scrubValue(deep))).toContain('[redacted:depth]');
  });

  it('normalises Error instances', () => {
    const scrubbed = scrubValue(new Error('failed for jana@example.com')) as Record<string, unknown>;
    expect(scrubbed.name).toBe('Error');
    expect(scrubbed.message).toBe('failed for [redacted:email]');
  });

  it('keeps null/undefined and replaces exotic primitives', () => {
    expect(scrubValue(null)).toBeNull();
    expect(scrubValue(undefined)).toBeUndefined();
    expect(scrubValue(BigInt(10))).toBe('[redacted:type]');
  });

  it('does not mutate the input', () => {
    const input = { description: 'secret' };
    scrubValue(input);
    expect(input.description).toBe('secret');
  });
});

describe('scrubEvent', () => {
  const event = {
    message: 'failed for jana@example.com',
    user: { id: 'user_123', email: 'jana@example.com', ip_address: '1.2.3.4' },
    request: { data: { description: 'Lidl', amount: 10 } },
    extra: { transcript: 'kupil som naftu', amountInCents: 6000 },
    contexts: { transaction: { description: 'x' } },
    breadcrumbs: [{ message: 'POST /api/transactions', data: { body: { description: 'y' } } }],
    level: 'error',
  };

  it('reduces the user object to the id only', () => {
    expect(scrubEvent({ ...event }).user).toEqual({ id: 'user_123' });
  });

  it('scrubs message, request, extra, contexts and breadcrumbs', () => {
    const scrubbed = scrubEvent({ ...event }) as any;

    expect(scrubbed.message).toBe('failed for [redacted:email]');
    expect(scrubbed.request.data.description).toBe('[redacted]');
    expect(scrubbed.request.data.amount).toBe(10);
    expect(scrubbed.extra.transcript).toBe('[redacted]');
    expect(scrubbed.extra.amountInCents).toBe(6000);
    expect(scrubbed.contexts.transaction.description).toBe('[redacted]');
    expect(scrubbed.breadcrumbs[0].data.body.description).toBe('[redacted]');
  });

  it('keeps unknown top-level fields', () => {
    expect((scrubEvent({ ...event }) as any).level).toBe('error');
  });

  it('handles events without user/extra/breadcrumbs', () => {
    expect(() => scrubEvent({ message: 'x' })).not.toThrow();
    expect((scrubEvent({ message: 'x' }) as any).user).toBeUndefined();
  });
});

describe('scrubBreadcrumb', () => {
  it('scrubs message and data, keeps category', () => {
    const scrubbed = scrubBreadcrumb({
      category: 'fetch',
      message: 'GET https://kaptia.app/?email=jana@example.com',
      data: { description: 'Lidl', status: 200 },
    }) as any;

    expect(scrubbed.category).toBe('fetch');
    expect(scrubbed.message).toContain('[redacted:email]');
    expect(scrubbed.data.description).toBe('[redacted]');
    expect(scrubbed.data.status).toBe(200);
  });
});

