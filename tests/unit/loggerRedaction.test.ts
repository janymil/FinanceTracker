import { afterEach, describe, expect, it, vi } from 'vitest';
import { log, redaction } from '../../server/logger';

/**
 * A log line must never carry a person's data or a credential.
 *
 * Call sites are supposed to pass metadata only, but one line that passed a voice transcript
 * showed why the rule cannot rely on discipline alone. These tests pin the scrubbing that now
 * happens inside logger.ts, so a future call site passing `{ transcript }` still writes nothing.
 */
const originalLevel = process.env.LOG_LEVEL;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalLevel === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = originalLevel;
});

function captured(run: () => void): string {
  const spies = [
    vi.spyOn(console, 'log').mockImplementation(() => undefined),
    vi.spyOn(console, 'warn').mockImplementation(() => undefined),
    vi.spyOn(console, 'error').mockImplementation(() => undefined),
  ];
  run();
  const text = spies
    .flatMap((spy) => spy.mock.calls.flat())
    .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
    .join(' ');
  spies.forEach((spy) => spy.mockRestore());
  return text;
}

describe('log redaction', () => {
  it('masks an e-mail address in free text', () => {
    expect(captured(() => log.info('contact a.person+tag@example.com failed'))).toBe(
      'contact «email» failed',
    );
  });

  it('masks card-length digit strings, grouped or not', () => {
    const text = captured(() => log.info('card 4111 1111 1111 1111 and 4111111111111111'));
    expect(text).not.toContain('4111');
    expect(text).toContain('«number»');
  });

  it('masks provider keys, webhook secrets and bearer tokens', () => {
    const text = captured(() =>
      log.warn('sk_live_abcdefghijklmnop / whsec_abcdefghijkl / Bearer abc.def-ghi'),
    );
    expect(text).not.toContain('sk_live_');
    expect(text).not.toContain('whsec_');
    expect(text).toContain('Bearer «token»');
  });

  it('replaces whole values of keys that carry personal data', () => {
    const text = captured(() =>
      log.info('voice', { transcript: 'I bought coffee at Starbucks', language: 'sk' }),
    );
    expect(text).not.toContain('Starbucks');
    expect(text).toContain('«redacted»');
    // Everything that is not personal data still reaches the log.
    expect(text).toContain('sk');
  });

  it('leaves ordinary metadata untouched', () => {
    expect(captured(() => log.info('serving on port 5000', { route: '/api/transactions' }))).toBe(
      'serving on port 5000 {"route":"/api/transactions"}',
    );
  });

  it('survives a circular object instead of throwing inside the logger', () => {
    const circular: Record<string, unknown> = { userId: 'user_1' };
    circular.self = circular;
    expect(() => captured(() => log.info('x', circular))).not.toThrow();
    expect(captured(() => log.info('x', circular))).toContain('«circular»');
  });

  it('scrubs an Error message but keeps it readable', () => {
    const text = captured(() => log.error('failed', new Error('no user a@b.com')));
    expect(text).toContain('«email»');
    expect(text).toContain('no user');
    expect(text).not.toContain('a@b.com');
  });

  it('honours LOG_LEVEL=error for lower levels', () => {
    process.env.LOG_LEVEL = 'error';
    const infoSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    log.info('not shown');
    log.error('shown');
    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledOnce();
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('exposes the same rules for any future sink', () => {
    expect(redaction.sensitiveKey.test('transcript')).toBe(true);
    expect(redaction.sensitiveKey.test('userId')).toBe(false);
    expect(redaction.scrub({ note: 'private' })).toEqual({ note: '«redacted»' });
  });
});
