import { describe, expect, it } from 'vitest';
import { dueOccurrences, occurrenceAt } from '../../shared/recurrence';

const day = (iso: string) => new Date(`${iso}T12:00:00.000Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);

describe('occurrenceAt', () => {
  it('anchors monthly rules to the start day instead of drifting', () => {
    const start = day('2026-01-31');
    expect(iso(occurrenceAt(start, 'monthly', 1))).toBe('2026-02-28');
    expect(iso(occurrenceAt(start, 'monthly', 2))).toBe('2026-03-31');
    expect(iso(occurrenceAt(start, 'monthly', 3))).toBe('2026-04-30');
  });

  it('handles weekly, biweekly, quarterly and yearly steps', () => {
    const start = day('2026-01-10');
    expect(iso(occurrenceAt(start, 'weekly', 2))).toBe('2026-01-24');
    expect(iso(occurrenceAt(start, 'biweekly', 1))).toBe('2026-01-24');
    expect(iso(occurrenceAt(start, 'quarterly', 1))).toBe('2026-04-10');
    expect(iso(occurrenceAt(start, 'yearly', 1))).toBe('2027-01-10');
  });
});

describe('dueOccurrences', () => {
  it('returns nothing before the first repeat is due', () => {
    const start = day('2026-01-10');
    expect(
      dueOccurrences({ start, frequency: 'monthly', lastProcessed: start, now: day('2026-02-09') })
    ).toEqual([]);
  });

  it('returns every missed occurrence, oldest first, and never the start itself', () => {
    const start = day('2026-01-10');
    const due = dueOccurrences({ start, frequency: 'monthly', lastProcessed: start, now: day('2026-04-15') });
    expect(due.map(iso)).toEqual(['2026-02-10', '2026-03-10', '2026-04-10']);
  });

  it('continues after the last processed occurrence (no duplicates on the next run)', () => {
    const start = day('2026-01-10');
    const due = dueOccurrences({
      start,
      frequency: 'monthly',
      lastProcessed: day('2026-03-10'),
      now: day('2026-04-15'),
    });
    expect(due.map(iso)).toEqual(['2026-04-10']);
  });

  it('stops at the end date', () => {
    const start = day('2026-01-01');
    const due = dueOccurrences({
      start,
      frequency: 'weekly',
      lastProcessed: start,
      endDate: day('2026-01-20'),
      now: day('2026-03-01'),
    });
    expect(due.map(iso)).toEqual(['2026-01-08', '2026-01-15']);
  });

  it('caps how many it creates in one run', () => {
    const start = day('2024-01-01');
    const due = dueOccurrences({ start, frequency: 'daily', lastProcessed: start, now: day('2026-01-01'), maxPerRun: 5 });
    expect(due).toHaveLength(5);
  });
});
