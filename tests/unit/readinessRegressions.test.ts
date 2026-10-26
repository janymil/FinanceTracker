import { describe, expect, it } from 'vitest';
import { cleanDateValue } from '../../shared/trackingInput';
import { escapeHtml, safeLinkUrl, safeSubject } from '../../server/emailService';
import { readEdgeCountry } from '../../server/middleware/countryBlocking';

/**
 * Three regressions from the readiness review, each one a bug that no type or existing test
 * could have caught: a stored day shifting by a timezone, a name executed as markup, and a
 * country read from an address the caller controls.
 */
describe('a plain day is a calendar date', () => {
  it('stores 2026-10-01 as noon UTC, not midnight UTC', () => {
    const stored = cleanDateValue('2026-10-01');
    expect(stored?.toISOString()).toBe('2026-10-01T12:00:00.000Z');
  });

  it('keeps the same day in Lima (UTC-5) and in Madrid (UTC+2)', () => {
    const stored = cleanDateValue('2026-10-01')!;
    expect(stored.toLocaleDateString('en-CA', { timeZone: 'America/Lima' })).toBe('2026-10-01');
    expect(stored.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })).toBe('2026-10-01');
  });

  it('still accepts a full timestamp and rejects nonsense', () => {
    expect(cleanDateValue('2026-10-01T08:30:00Z')?.toISOString()).toBe('2026-10-01T08:30:00.000Z');
    expect(cleanDateValue('not a date')).toBeNull();
    expect(cleanDateValue('')).toBeNull();
  });
});

describe('e-mail values are escaped, not executed', () => {
  it('escapes a goal name that is really a link', () => {
    const escaped = escapeHtml('<a href="https://evil.example">Confirm your password</a>');
    expect(escaped).not.toContain('<a');
    expect(escaped).toContain('&lt;a');
    expect(escaped).toContain('&quot;');
  });

  it('keeps apostrophes and ampersands readable', () => {
    expect(escapeHtml("Mum's & Dad's")).toBe('Mum&#39;s &amp; Dad&#39;s');
  });

  it('refuses a non-http link targets', () => {
    expect(safeLinkUrl('javascript:alert(1)')).toBe('https://kaptia.app');
    expect(safeLinkUrl('https://kaptia.app/goal/1')).toBe('https://kaptia.app/goal/1');
  });

  it('cannot add a header through the subject', () => {
    expect(safeSubject('Hello\r\nBcc: someone@example.com')).toBe('Hello Bcc: someone@example.com');
  });
});

describe('the visitor country comes from the edge header', () => {
  const request = (headers: Record<string, string>) => ({ headers }) as never;

  it('reads a two-letter code', () => {
    expect(readEdgeCountry(request({ 'cf-ipcountry': 'pe' }))).toBe('PE');
  });

  it('treats unknown and Tor as absent', () => {
    expect(readEdgeCountry(request({ 'cf-ipcountry': 'XX' }))).toBeNull();
    expect(readEdgeCountry(request({ 'cf-ipcountry': 'T1' }))).toBeNull();
  });

  it('ignores a value that is not a country code', () => {
    expect(readEdgeCountry(request({ 'cf-ipcountry': 'india' }))).toBeNull();
    expect(readEdgeCountry(request({}))).toBeNull();
  });
});
