import { describe, expect, it, vi } from 'vitest';
// Pure helpers in this module; the database connection is mocked away.
import { chargeReference, periodEnd } from '../../server/billingDocuments';

vi.mock('../../server/db', () => ({ db: {} }));

/**
 * "One charge, one document" is decided by the reference these two functions build.
 *
 * MercadoPago reports the *first* payment twice — once as the subscription being authorised, once
 * as the charge it produced — and retries a notification it could not deliver. Merging renewals or
 * splitting the first payment would both end in the wrong number of documents, and a document is
 * an invoice once it reaches SUNAT.
 */
describe('charge reference', () => {
  it('is the same for both notices of the same charge', () => {
    const authorised = new Date('2026-10-28T10:00:00.000Z');
    const charged = new Date('2026-10-28T10:02:00.000Z');
    expect(chargeReference('pre-1', authorised)).toBe(chargeReference('pre-1', charged));
  });

  it('changes from one period to the next', () => {
    expect(chargeReference('pre-1', new Date('2026-10-31T23:00:00.000Z'))).toBe('pre-1#2026-10');
    expect(chargeReference('pre-1', new Date('2026-11-01T00:00:00.000Z'))).toBe('pre-1#2026-11');
  });

  it('keeps two customers apart', () => {
    const at = new Date('2026-10-01T00:00:00.000Z');
    expect(chargeReference('pre-1', at)).not.toBe(chargeReference('pre-2', at));
  });
});

describe('period end', () => {
  it('adds one month for a monthly plan and one year for a yearly one', () => {
    const start = new Date('2026-01-15T00:00:00.000Z');
    expect(periodEnd(start, 'monthly').toISOString().slice(0, 10)).toBe('2026-02-15');
    expect(periodEnd(start, 'yearly').toISOString().slice(0, 10)).toBe('2027-01-15');
  });

  it('never mutates the start date it was given', () => {
    const start = new Date('2026-03-31T00:00:00.000Z');
    periodEnd(start, 'monthly');
    expect(start.toISOString()).toBe('2026-03-31T00:00:00.000Z');
  });
});
