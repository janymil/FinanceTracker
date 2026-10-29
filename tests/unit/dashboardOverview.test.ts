import { describe, expect, it } from 'vitest';
import {
  buildDashboardOverview,
  overviewWindow,
  parseMonthParam,
  type OverviewInput,
  type OverviewTransaction,
} from '../../shared/dashboardOverview';

const ZONE = 'America/Lima'; // UTC-5, no daylight saving
const NOW = new Date('2026-10-28T17:00:00Z'); // 12:00 on 28 October in Lima

const tx = (
  date: string,
  type: 'income' | 'expense',
  amount: string,
  categoryName: string | null = 'Groceries',
  extra: Partial<OverviewTransaction> = {},
): OverviewTransaction => ({ date, type, amount, categoryName, ...extra });

function input(overrides: Partial<OverviewInput> = {}): OverviewInput {
  return {
    year: 2026,
    month: 10,
    timeZone: ZONE,
    now: NOW,
    transactions: [],
    budgets: [],
    goals: [],
    bills: [],
    ...overrides,
  };
}

describe('buildDashboardOverview — the month card', () => {
  it('separates what is paid from what is still coming, and counts income dated later this month', () => {
    const result = buildDashboardOverview(input({
      transactions: [
        tx('2026-10-01T15:00:00Z', 'income', '2150.00', 'Salary'),
        tx('2026-10-30T15:00:00Z', 'income', '320.00', 'Freelance'), // dated ahead: still this month's plan
        tx('2026-10-05T15:00:00Z', 'expense', '650.00', 'Housing', { isRecurring: true }),
        tx('2026-10-20T15:00:00Z', 'expense', '100.10', 'Groceries'),
        tx('2026-10-30T15:00:00Z', 'expense', '29.90', 'Utilities'), // scheduled
      ],
      bills: [
        { id: 'recurring_7', title: 'Gym', amount: '50.00', dueDate: '2026-10-31T15:00:00Z', source: 'recurring_transaction' },
        // A reminder is not money until it is recorded: shown, not subtracted.
        { id: 'reminder_3', title: 'Phone', amount: '15.50', dueDate: '2026-10-30T15:00:00Z', source: 'expense_reminder' },
      ],
    }));

    expect(result.month).toEqual({ key: '2026-10', status: 'current', day: 28, daysInMonth: 31, daysLeft: 3 });
    expect(result.totals.incomeCents).toBe(247_000);
    expect(result.totals.incomeCount).toBe(2);
    expect(result.totals.spentCents).toBe(75_010);
    expect(result.totals.upcomingCents).toBe(2_990 + 5_000);
    expect(result.totals.upcomingCount).toBe(2);
    expect(result.totals.leftCents).toBe(247_000 - 75_010 - 7_990);
    expect(result.totals.leftShareBp).toBe(Math.round((164_000 * 10_000) / 247_000));
  });

  it('reads the month in the person’s zone: 1 November 02:00 UTC is still 31 October in Lima', () => {
    const result = buildDashboardOverview(input({
      now: new Date('2026-11-05T17:00:00Z'),
      transactions: [tx('2026-11-01T02:00:00Z', 'expense', '10.00')],
    }));
    expect(result.month.status).toBe('past');
    expect(result.totals.spentCents).toBe(1_000);
  });

  it('forecasts from the day-to-day pace only, leaving fixed payments out of the pace', () => {
    const result = buildDashboardOverview(input({
      transactions: [
        tx('2026-10-01T15:00:00Z', 'income', '2800.00', 'Salary'),
        tx('2026-10-02T15:00:00Z', 'expense', '700.00', 'Housing', { isRecurring: true }),
        tx('2026-10-10T15:00:00Z', 'expense', '280.00'),
      ],
    }));
    // 280 over 28 days = 10 a day, three days left.
    expect(result.forecast).toEqual({ spentCents: 98_000 + 3_000, keptCents: 280_000 - 101_000 });
  });

  it('gives no forecast in the first days of a month, nor for a closed one', () => {
    expect(buildDashboardOverview(input({ now: new Date('2026-10-03T17:00:00Z') })).forecast).toBeNull();
    expect(buildDashboardOverview(input({ month: 9 })).forecast).toBeNull();
  });
});

describe('buildDashboardOverview — categories against the usual month', () => {
  it('compares each category with its own average over the three months before', () => {
    const result = buildDashboardOverview(input({
      transactions: [
        tx('2026-07-10T15:00:00Z', 'expense', '120.00', 'Restaurants'),
        tx('2026-08-10T15:00:00Z', 'expense', '150.00', 'Restaurants'),
        tx('2026-09-10T15:00:00Z', 'expense', '180.00', 'Restaurants'),
        tx('2026-10-10T15:00:00Z', 'expense', '100.00', 'Restaurants'),
        tx('2026-10-11T15:00:00Z', 'expense', '95.00', 'Restaurants'),
        tx('2026-10-12T15:00:00Z', 'expense', '40.00', 'Pets'), // nothing to compare with
        tx('2026-10-13T15:00:00Z', 'expense', '12.00', null),
        tx('2026-10-14T15:00:00Z', 'expense', '8.00', 'Uncategorized'),
      ],
    }));

    expect(result.categories.map((c) => c.name)).toEqual(['Restaurants', 'Pets']);
    expect(result.categories[0]).toMatchObject({ amountCents: 19_500, purchases: 2, usualCents: 15_000, changePct: 30 });
    expect(result.categories[1]).toMatchObject({ usualCents: null, changePct: null });
    expect(result.uncategorized).toEqual({ count: 2, amountCents: 2_000 });
    expect(result.attention).toContainEqual({ kind: 'uncategorized', count: 2, amountCents: 2_000 });
  });

  it('averages over the months that hold spending, so a young account is not compared with zeros', () => {
    const result = buildDashboardOverview(input({
      transactions: [
        tx('2026-09-10T15:00:00Z', 'expense', '90.00', 'Transport'),
        tx('2026-10-10T15:00:00Z', 'expense', '90.00', 'Transport'),
      ],
    }));
    expect(result.categories[0]).toMatchObject({ usualCents: 9_000, changePct: 0 });
  });
});

describe('buildDashboardOverview — what needs attention', () => {
  it('lists bills due within a week, budgets at 85% or more, and goals running out of time', () => {
    const result = buildDashboardOverview(input({
      bills: [
        { id: 'reminder_1', title: 'Internet', amount: '29.90', dueDate: '2026-10-30T15:00:00Z', source: 'expense_reminder' },
        { id: 'recurring_2', title: 'Insurance', amount: '80.00', dueDate: '2026-11-20T15:00:00Z', source: 'recurring_transaction' },
      ],
      budgets: [
        { categoryName: 'Restaurants', amount: '200.00', spent: 186.4, startDate: '2026-10-01', endDate: '2026-10-31' },
        { categoryName: 'Shopping', amount: '150.00', spent: 60, startDate: '2026-10-01', endDate: '2026-10-31' },
        { categoryName: 'Old', amount: '100.00', spent: 99, startDate: '2026-09-01', endDate: '2026-09-30' },
      ],
      goals: [
        { id: 1, name: 'Trip', targetAmount: '1000.00', currentAmount: '400.00', targetDate: '2026-11-30', status: 'active' },
        { id: 2, name: 'Laptop', targetAmount: '1000.00', currentAmount: '100.00', targetDate: '2027-06-30', status: 'active' },
        { id: 3, name: 'Done', targetAmount: '100.00', currentAmount: '100.00', targetDate: '2026-11-01', status: 'active' },
      ],
    }));

    expect(result.attention).toEqual([
      { kind: 'bill', id: 'reminder_1', title: 'Internet', amountCents: 2_990, dueDate: '2026-10-30', daysUntil: 2, canComplete: true },
      { kind: 'budget', categoryName: 'Restaurants', spentCents: 18_640, limitCents: 20_000, percent: 93, daysLeft: 3 },
      { kind: 'goal', id: 1, name: 'Trip', remainingCents: 60_000, targetDate: '2026-11-30', daysLeft: 33 },
    ]);
  });

  it('shows nothing to act on when looking at a closed month', () => {
    const result = buildDashboardOverview(input({
      month: 9,
      transactions: [tx('2026-09-10T15:00:00Z', 'expense', '5.00', null)],
    }));
    expect(result.attention).toEqual([]);
  });
});

describe('buildDashboardOverview — goals, trend, score, streak', () => {
  it('works out what a goal needs per month from now, and leaves reached goals at the end', () => {
    const result = buildDashboardOverview(input({
      goals: [
        { id: 9, name: 'Reached', targetAmount: '100.00', currentAmount: '120.00', targetDate: '2026-12-31' },
        { id: 1, name: 'Emergency fund', targetAmount: '5000.00', currentAmount: '2400.00', targetDate: '2027-06-30' },
        { id: 2, name: 'Paused', targetAmount: '100.00', currentAmount: '0', targetDate: '2027-01-01', status: 'paused' },
      ],
    }));
    expect(result.goals.map((g) => g.name)).toEqual(['Emergency fund', 'Reached']);
    // November to June inclusive is 9 months counting October: 2,600 / 9, rounded up to the cent.
    expect(result.goals[0]).toMatchObject({ percent: 48, monthlyNeededCents: Math.ceil(260_000 / 9), reached: false });
    expect(result.goals[1]).toMatchObject({ percent: 100, monthlyNeededCents: null, reached: true });
  });

  it('returns six months ending with the one on screen, the score change, and the streak', () => {
    const result = buildDashboardOverview(input({
      transactions: [
        tx('2026-09-01T15:00:00Z', 'income', '2000.00', 'Salary'),
        tx('2026-09-02T15:00:00Z', 'expense', '1800.00'),
        tx('2026-10-01T15:00:00Z', 'income', '2000.00', 'Salary'),
        tx('2026-10-26T15:00:00Z', 'expense', '10.00'),
        tx('2026-10-27T15:00:00Z', 'expense', '10.00'),
        tx('2026-10-28T15:00:00Z', 'expense', '10.00'),
      ],
    }));
    expect(result.trend.map((m) => m.key)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(result.trend[4]).toEqual({ key: '2026-09', incomeCents: 200_000, expensesCents: 180_000 });
    expect(result.previous).toEqual({ key: '2026-09', expensesCents: 180_000, keptCents: 20_000, hasData: true });
    expect(result.previousHealthScore).not.toBeNull();
    expect(result.health.score).toBeGreaterThan(result.previousHealthScore!);
    expect(result.streak).toEqual({ current: 3, loggedToday: true });
    expect(result.usualKeptShareBp).toBe(1_000);
  });
});

describe('buildDashboardOverview — the movements that repeat in the month', () => {
  it('lists only the rules that land in the month, with the days they land on', () => {
    const result = buildDashboardOverview(input({
      recurringRules: [
        { id: 1, description: 'Rent', amount: '1200.00', type: 'expense', frequency: 'monthly', startDate: '2026-01-05T15:00:00Z' },
        { id: 2, description: 'Gym', amount: '50.00', type: 'expense', frequency: 'weekly', startDate: '2026-10-06T15:00:00Z', endDate: '2026-10-20T15:00:00Z' },
        { id: 3, description: 'Salary', amount: '3500.00', type: 'income', frequency: 'monthly', startDate: '2026-01-30T15:00:00Z' },
        { id: 4, description: 'Insurance', amount: '300.00', type: 'expense', frequency: 'yearly', startDate: '2026-03-10T15:00:00Z' },
        { id: 5, description: 'Old rule', amount: '20.00', type: 'expense', frequency: 'monthly', startDate: '2026-01-02T15:00:00Z', endDate: '2026-09-30T15:00:00Z' },
      ],
    }));

    expect(result.recurring).toEqual([
      { id: 1, description: 'Rent', amountCents: 120_000, type: 'expense', frequency: 'monthly', count: 1, firstDay: '2026-10-05', lastDay: '2026-10-05' },
      { id: 2, description: 'Gym', amountCents: 5_000, type: 'expense', frequency: 'weekly', count: 3, firstDay: '2026-10-06', lastDay: '2026-10-20' },
      { id: 3, description: 'Salary', amountCents: 350_000, type: 'income', frequency: 'monthly', count: 1, firstDay: '2026-10-30', lastDay: '2026-10-30' },
    ]);
  });

  it('finds every day of a daily rule that started years before the month', () => {
    const result = buildDashboardOverview(input({
      recurringRules: [
        { id: 7, description: 'Coffee', amount: '4.00', type: 'expense', frequency: 'daily', startDate: '2020-01-01T15:00:00Z' },
      ],
    }));

    expect(result.recurring).toHaveLength(1);
    expect(result.recurring[0]).toMatchObject({ count: 31, firstDay: '2026-10-01', lastDay: '2026-10-31' });
  });

  it('keeps a monthly rule on its own day of the month, without drifting to the 28th', () => {
    const result = buildDashboardOverview(input({
      recurringRules: [
        { id: 8, description: 'Studio', amount: '900.00', type: 'expense', frequency: 'monthly', startDate: '2026-01-31T15:00:00Z' },
      ],
    }));

    expect(result.recurring[0]).toMatchObject({ count: 1, firstDay: '2026-10-31', lastDay: '2026-10-31' });
  });

  it('is empty when nothing repeats in the month, which is what hides the card', () => {
    const result = buildDashboardOverview(input({
      recurringRules: [
        { id: 9, description: 'Insurance', amount: '300.00', type: 'expense', frequency: 'yearly', startDate: '2026-03-10T15:00:00Z' },
        { id: 10, description: 'Ended', amount: '10.00', type: 'expense', frequency: 'weekly', startDate: '2026-01-06T15:00:00Z', endDate: '2026-09-30T15:00:00Z' },
        { id: 11, description: 'Not a rule', amount: '10.00', type: 'expense', frequency: 'sometimes', startDate: '2026-10-06T15:00:00Z' },
      ],
    }));

    expect(result.recurring).toEqual([]);
  });
});

describe('month parameter and window', () => {
  it('accepts yyyy-MM and nothing else', () => {
    expect(parseMonthParam('2026-10')).toEqual({ year: 2026, month: 10 });
    expect(parseMonthParam('2026-13')).toBeNull();
    expect(parseMonthParam('2026-1')).toBeNull();
    expect(parseMonthParam(['2026-10'])).toBeNull();
  });

  it('reads from the first day five months back to the last instant of the month, in the zone', () => {
    const window = overviewWindow(2026, 10, ZONE);
    expect(window.start.toISOString()).toBe('2026-05-01T05:00:00.000Z');
    expect(window.end.toISOString()).toBe('2026-11-01T04:59:59.999Z');
  });
});
