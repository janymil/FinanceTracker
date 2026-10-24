/**
 * The Error Guard prompt lives in the AI processor, so its privacy properties are tested
 * there: only metadata is rendered, optional sections disappear instead of printing
 * "undefined", and everything is length-bounded.
 */
import { describe, expect, it } from 'vitest';
import { buildUserPrompt } from '../../server/errorGuard/triagePrompt';

describe('buildUserPrompt (Error Guard)', () => {
  it('renders the metadata the model needs', () => {
    const prompt = buildUserPrompt({
      title: 'TypeError: boom',
      kind: 'exception',
      route: '/api/expenses/:id',
      release: 'rel-1',
      severity: 'critical',
      moneyPath: true,
      eventCount: 7,
      message: 'Cannot read properties of undefined',
    });

    expect(prompt).toContain('Problem: TypeError: boom');
    expect(prompt).toContain('Touches money: yes');
    expect(prompt).toContain('Times seen: 7');
    expect(prompt).toContain('Route: /api/expenses/:id');
    expect(prompt).toContain('Message: Cannot read properties of undefined');
  });

  it('renders context KEY NAMES only, never values', () => {
    const prompt = buildUserPrompt({
      message: 'boom',
      contextKeys: ['where', 'amountInCents'],
    });
    expect(prompt).toContain('Context keys present: where, amountInCents');
  });

  it('omits optional sections and never prints undefined', () => {
    const prompt = buildUserPrompt({ message: 'boom' });
    expect(prompt).not.toContain('undefined');
    expect(prompt).not.toContain('Top frames');
    expect(prompt).toContain('Route: unknown');
  });

  it('limits frames, context keys and breadcrumbs', () => {
    const prompt = buildUserPrompt({
      message: 'boom',
      stackFrames: Array.from({ length: 9 }, (_, index) => `at fn${index} (src/x.ts:1:1)`),
      contextKeys: Array.from({ length: 30 }, (_, index) => `key${index}`),
      breadcrumbLabels: Array.from({ length: 20 }, (_, index) => `click-${index}`),
    });

    expect(prompt.match(/at fn\d/g)).toHaveLength(5);
    expect(prompt).toContain('key14');
    expect(prompt).not.toContain('key15');
    expect(prompt).toContain('click-19');
    expect(prompt).not.toContain('click-11');
  });

  it('truncates a long message and tolerates junk arrays', () => {
    const prompt = buildUserPrompt({
      message: 'x'.repeat(2_000),
      stackFrames: 'not-an-array' as unknown as string[],
      contextKeys: null as unknown as string[],
    });
    expect(prompt.length).toBeLessThan(1_200);
    expect(prompt).not.toContain('Top frames');
  });
});
