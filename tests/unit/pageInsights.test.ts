import { describe, expect, it } from 'vitest';
import { buildMonthLedger, dayKeyIn, payeeKey, type LedgerTransaction } from '../../shared/ledger';
import { planGoal } from '../../shared/goalPlan';
import { buildPeriodReport, presetRanges, previousOf } from '../../shared/periodReport';
import { buildTrendStats } from '../../shared/trendStats';

const ZONE = 'America/Lima'; // UTC-5, no daylight saving
const NOW = new Date('2026-10-28T17:00:00Z'); // 12:00 on 28 October in Lima

let nextId = 1;
const categoryIds = new Map<string, number>();
const categoryId = (name: string) => {
  if (!categoryIds.has(name)) categoryIds.set(name, categoryIds.size + 1);
  return categoryIds.get(name)!;
};
const tx = (
  date: string,
  type: 'income' | 'expense',
  amount: string,
  categoryName: string | null = 'Groceries',
  extra: Partial<LedgerTransaction> = {},
): LedgerTransaction => ({
  id: nextId++,
  date,
  type,
  amount,
  categoryName,
  categoryId: categoryName ? categoryId(categoryName) : null,
  description: 'Shop',
  ...extra,
});

describe('buildMonthLedger', () => {
  it('puts a row in the day and month the person lived it, not the UTC one', () => {
    // 1 November 03:00 UTC is still 31 October in Lima.
    const late = tx('2026-11-01T03:00:00Z', 'expense', '10.00');
    expect(dayKeyIn(late.date, ZONE)).toBe('2026-10-31');
    const ledger = buildMonthLedger([late], '2026-10', { timeZone: ZONE, now: new Date('2026-11-02T17:00:00Z') });
    expect(ledger.expenseCents).toBe(1000);
    expect(ledger.days[0].key).toBe('2026-10-31');
  });

  it('keeps rows dated after now out of the totals and flags their day as scheduled', () => {
    const ledger = buildMonthLedger([
      tx('2026-10-05T15:00:00Z', 'expense', '40.00'),
      tx('2026-10-30T15:00:00Z', 'expense', '700.00', 'Rent', { isRecurring: true }),
      tx('2026-10-01T15:00:00Z', 'income', '2000.00', 'Salary'),
    ], '2026-10', { timeZone: ZONE, now: NOW });

    expect(ledger.expenseCents).toBe(4000);
    expect(ledger.scheduledExpenseCents).toBe(70000);
    expect(ledger.scheduledCount).toBe(1);
    expect(ledger.netCents).toBe(200000 - 4000);
    expect(ledger.days.map((d) => [d.key, d.scheduled])).toEqual([
      ['2026-10-30', true],
      ['2026-10-05', false],
      ['2026-10-01', false],
    ]);
  });

  it('compares each category with its own average of the months before that had it', () => {
    const ledger = buildMonthLedger([
      tx('2026-07-10T15:00:00Z', 'expense', '100.00', 'Food'),
      tx('2026-09-10T15:00:00Z', 'expense', '300.00', 'Food'),
      tx('2026-10-10T15:00:00Z', 'expense', '300.00', 'Food'),
      tx('2026-10-11T15:00:00Z', 'expense', '50.00', 'Taxi'),
    ], '2026-10', { timeZone: ZONE, now: NOW });

    const food = ledger.expenseCategories.find((c) => c.name === 'Food')!;
    expect(food.usualCents).toBe(20000); // (100 + 300) / 2 months that had food
    expect(food.changePct).toBe(50);
    expect(food.shareBp).toBe(8571);
    const taxi = ledger.expenseCategories.find((c) => c.name === 'Taxi')!;
    expect(taxi.usualCents).toBeNull();
    expect(ledger.usualExpenseCents).toBe(20000); // July and September; August had no spending
  });

  it('splits fixed from everyday spending and projects the month from the everyday pace', () => {
    const ledger = buildMonthLedger([
      tx('2026-10-01T15:00:00Z', 'expense', '700.00', 'Rent', { isRecurring: true }),
      tx('2026-10-14T15:00:00Z', 'expense', '280.00'),
    ], '2026-10', { timeZone: ZONE, now: NOW });

    expect(ledger.recurringExpenseCents).toBe(70000);
    expect(ledger.everydayExpenseCents).toBe(28000);
    expect(ledger.dailyAverageCents).toBe(1000); // 280 over 28 days lived
    expect(ledger.projectedExpenseCents).toBe(98000 + 1000 * 3);
  });

  it('counts a payment typed by hand every month as fixed, but not a shop visited with different amounts', () => {
    const rows = ['07', '08', '09', '10'].flatMap((m, i) => [
      tx(`2026-${m}-01T15:00:00Z`, 'expense', '1650.00', 'Rent', { description: 'Monthly rent' }),
      tx(`2026-${m}-12T15:00:00Z`, 'expense', String(40 + i * 35), 'Food', { description: 'Groceries Wong' }),
    ]);
    const ledger = buildMonthLedger(rows, '2026-10', { timeZone: ZONE, now: NOW });
    expect(ledger.recurringExpenseCents).toBe(165000);
    expect(ledger.everydayExpenseCents).toBe(14500);
  });

  it('groups payees by what the person typed, whatever the receipt number', () => {
    expect(payeeKey('LIDL 0423 Bratislava')).toBe(payeeKey('Lidl Bratislava'));
    const ledger = buildMonthLedger([
      tx('2026-10-02T15:00:00Z', 'expense', '20.00', 'Food', { description: 'LIDL 0423' }),
      tx('2026-10-09T15:00:00Z', 'expense', '30.00', 'Food', { description: 'Lidl' }),
      tx('2026-10-10T15:00:00Z', 'expense', '45.00', 'Fun', { description: 'Cinema' }),
    ], '2026-10', { timeZone: ZONE, now: NOW });
    expect(ledger.payees[0]).toEqual({ name: 'Lidl', cents: 5000, count: 2 });
  });

  it('counts spending by the same day of last month and leaves uncategorized rows out of the usual', () => {
    const ledger = buildMonthLedger([
      tx('2026-09-20T15:00:00Z', 'expense', '100.00'),
      tx('2026-09-29T15:00:00Z', 'expense', '999.00'), // after day 28: not "by now" last month
      tx('2026-10-03T15:00:00Z', 'expense', '12.00', null),
    ], '2026-10', { timeZone: ZONE, now: NOW });
    expect(ledger.samePointLastMonthCents).toBe(10000);
    expect(ledger.uncategorizedCount).toBe(1);
    expect(ledger.uncategorizedCents).toBe(1200);
  });

  it('reads how steady income is from closed months only', () => {
    const rows = ['05', '06', '07', '08', '09'].map((m) => tx(`2026-${m}-01T15:00:00Z`, 'income', '1000.00', 'Salary'));
    rows.push(tx('2026-10-01T15:00:00Z', 'income', '10.00', 'Salary')); // the month in progress
    const ledger = buildMonthLedger(rows, '2026-10', { timeZone: ZONE, now: NOW });
    expect(ledger.incomeVariationPct).toBe(0);
    expect(ledger.usualIncomeCents).toBe(100000);
  });
});

describe('planGoal', () => {
  it('asks for the remaining amount spread over the months left, the current one included', () => {
    const plan = planGoal({ targetAmount: '1200', currentAmount: '200', targetDate: '2027-01-31T00:00:00Z' }, NOW, ZONE);
    expect(plan.monthsLeft).toBe(4); // Oct, Nov, Dec, Jan
    expect(plan.monthlyNeededCents).toBe(25000);
    expect(plan.percent).toBe(16);
    expect(plan.targetDay).toBe('2027-01-31');
  });

  it('judges pace against a steady saver since the goal was created', () => {
    const base = { targetAmount: '1000', targetDate: '2026-12-28T00:00:00Z', createdAt: '2026-08-29T00:00:00Z' };
    // Halfway through the time: a steady saver has 500.
    expect(planGoal({ ...base, currentAmount: '300' }, NOW, ZONE).pace).toBe('behind');
    expect(planGoal({ ...base, currentAmount: '500' }, NOW, ZONE).pace).toBe('on_track');
    expect(planGoal({ ...base, currentAmount: '700' }, NOW, ZONE).pace).toBe('ahead');
    expect(planGoal({ ...base, currentAmount: '1000' }, NOW, ZONE).pace).toBe('reached');
  });

  it('marks a goal overdue once its day has passed without the money', () => {
    const plan = planGoal({ targetAmount: '1000', currentAmount: '10', targetDate: '2026-10-01T00:00:00Z' }, NOW, ZONE);
    expect(plan.overdue).toBe(true);
    expect(plan.pace).toBe('overdue');
    expect(plan.monthlyNeededCents).toBeNull();
  });
});

describe('buildPeriodReport', () => {
  it('compares a month with the month before and keeps scheduled rows out', () => {
    const { range, previous } = presetRanges('month', NOW, ZONE);
    expect(range).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(previous).toEqual({ start: '2026-09-01', end: '2026-09-30' });

    const report = buildPeriodReport([
      tx('2026-09-05T15:00:00Z', 'expense', '200.00', 'Food'),
      tx('2026-10-05T15:00:00Z', 'expense', '300.00', 'Food'),
      tx('2026-10-01T15:00:00Z', 'income', '1000.00', 'Salary'),
      tx('2026-10-30T15:00:00Z', 'expense', '50.00', 'Food'),
    ], range, previous, { timeZone: ZONE, now: NOW });

    expect(report.expenseCents).toBe(30000);
    expect(report.scheduledExpenseCents).toBe(5000);
    expect(report.expenseChangePct).toBe(50);
    expect(report.savingsRateBp).toBe(7000);
    expect(report.expenseCategories[0]).toMatchObject({ name: 'Food', cents: 30000, previousCents: 20000, changePct: 50 });
    expect(report.months).toHaveLength(1);
    expect(report.dailyExpenseCents).toBe(Math.round(30000 / 28));
  });

  it('gives a custom range the same number of days right before it', () => {
    expect(previousOf({ start: '2026-10-11', end: '2026-10-20' })).toEqual({ start: '2026-10-01', end: '2026-10-10' });
  });

  it('lists every month of a year, empty ones included', () => {
    const { range, previous } = presetRanges('year', NOW, ZONE);
    const report = buildPeriodReport([], range, previous, { timeZone: ZONE, now: NOW });
    expect(report.months.map((m) => m.key)).toHaveLength(12);
    expect(report.savingsRateBp).toBeNull();
  });
});

describe('buildTrendStats', () => {
  const months = ['05', '06', '07', '08', '09'];

  it('reads direction from closed months and never from the month in progress', () => {
    const rows = months.flatMap((m, i) => [
      tx(`2026-${m}-01T15:00:00Z`, 'income', '1000.00', 'Salary'),
      tx(`2026-${m}-10T15:00:00Z`, 'expense', String(900 - i * 100), 'Food'),
    ]);
    rows.push(tx('2026-10-02T15:00:00Z', 'expense', '5000.00', 'Food')); // a bad start to October
    const stats = buildTrendStats(rows, 6, { timeZone: ZONE, now: NOW });
    expect(stats.closedMonths).toBe(5);
    expect(stats.direction).toBe('improving');
    expect(stats.bestMonth?.key).toBe('2026-09');
    expect(stats.months[5].partial).toBe(true);
  });

  it('calls steady spending low-volatility and moving spending high', () => {
    const steady = months.map((m) => tx(`2026-${m}-10T15:00:00Z`, 'expense', '500.00'));
    expect(buildTrendStats(steady, 6, { timeZone: ZONE, now: NOW }).volatility).toBe('low');
    const moving = months.map((m, i) => tx(`2026-${m}-10T15:00:00Z`, 'expense', i % 2 ? '100.00' : '900.00'));
    expect(buildTrendStats(moving, 6, { timeZone: ZONE, now: NOW }).volatility).toBe('high');
  });

  it('averages weekday spending per day lived and leaves recurring payments out', () => {
    const rows = [
      tx('2026-10-03T15:00:00Z', 'expense', '40.00'), // Saturday
      tx('2026-10-05T15:00:00Z', 'expense', '700.00', 'Rent', { isRecurring: true }), // Monday, fixed
    ];
    const stats = buildTrendStats(rows, 1, { timeZone: ZONE, now: NOW });
    expect(stats.weekdays[5]).toBe(1000); // 40 over the four Saturdays lived in October
    expect(stats.weekdays[0]).toBe(0);
  });

  it('compares a category over the last three closed months with the three before', () => {
    const rows = ['04', '05', '06'].map((m) => tx(`2026-${m}-10T15:00:00Z`, 'expense', '100.00', 'Food'))
      .concat(['07', '08', '09'].map((m) => tx(`2026-${m}-10T15:00:00Z`, 'expense', '150.00', 'Food')));
    const food = buildTrendStats(rows, 7, { timeZone: ZONE, now: NOW }).categories[0];
    expect(food.recentAverageCents).toBe(15000);
    expect(food.priorAverageCents).toBe(10000);
    expect(food.changePct).toBe(50);
    expect(food.direction).toBe('up');
  });
});
