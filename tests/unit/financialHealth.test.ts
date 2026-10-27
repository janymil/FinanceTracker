import { describe, expect, it } from 'vitest';
import {
  budgetsForPeriod,
  calculateFinancialHealth,
  healthBand,
} from '../../shared/financialHealth';

/**
 * The numbers in this file come from a real account: October 2026 held income 7,000.00 and
 * expenses 3,222.97, with seven October budgets adding up to 3,210.00. The dashboard used to score
 * that month as 100 because it added up all 44 budgets in the account (20,760.00) instead of the
 * seven that applied. Both figures are pinned here.
 */
const OCTOBER = {
  totalIncome: 7000,
  totalExpenses: 3222.97,
  budgetTotal: 3210,
};

describe('calculateFinancialHealth', () => {
  it('scores the real October as 83, not 100', () => {
    const result = calculateFinancialHealth(OCTOBER);

    // 30 (spending) + 25 (savings) + 8 (budgets: 3,222.97 spent against 3,210.00) + 20 (stability).
    // The budget factor has a cliff on purpose: the tooltip says "under budget = excellent", and
    // 12.97 over is over.
    expect(result.score).toBe(83);
    expect(result.band).toBe('excellent');
    expect(result.factors.map((factor) => [factor.key, factor.score])).toEqual([
      ['spendingControl', 30],
      ['savingsRate', 25],
      ['budgetAdherence', 8],
      ['financialStability', 20],
    ]);
  });

  it('would have scored the same month 100 had the budget factor used the year, not the month', () => {
    // 3,222.97 against the 20,760.00 of all 44 budgets in the account: 15% used, full marks.
    const withEveryBudget = calculateFinancialHealth({ ...OCTOBER, budgetTotal: 20760 });
    expect(withEveryBudget.score).toBe(100);

    const withThisMonth = calculateFinancialHealth(OCTOBER);
    expect(withThisMonth.score).toBe(83);
  });

  it('awards 100 only when the month really is under every limit', () => {
    const result = calculateFinancialHealth({ ...OCTOBER, totalExpenses: 2500 });

    expect(result.score).toBe(100);
    expect(result.factors.find((factor) => factor.key === 'budgetAdherence')?.score).toBe(25);
  });

  it('does not hand out full marks when no budget is set for the period', () => {
    const result = calculateFinancialHealth({ ...OCTOBER, budgetTotal: 0 });
    const budget = result.factors.find((factor) => factor.key === 'budgetAdherence');

    expect(budget).toMatchObject({ score: 13, max: 25, status: 'not_measured' });
    expect(result.score).toBe(88);
  });

  it('does not hand out full marks when no income is recorded', () => {
    const result = calculateFinancialHealth({ totalIncome: 0, totalExpenses: 500, budgetTotal: 400 });

    expect(result.factors.find((factor) => factor.key === 'spendingControl')).toMatchObject({
      score: 15,
      status: 'not_measured',
    });
    expect(result.factors.find((factor) => factor.key === 'savingsRate')).toMatchObject({
      score: 13,
      status: 'not_measured',
    });
    // Spending 500 with no income and no 25 saved is poor, not neutral.
    expect(result.score).toBeLessThan(60);
  });

  it('gives the worst marks to a month that spent more than it earned', () => {
    const result = calculateFinancialHealth({
      totalIncome: 1000,
      totalExpenses: 1400,
      budgetTotal: 1200,
    });

    expect(result.factors.map((factor) => factor.score)).toEqual([10, 0, 8, 5]);
    expect(result.score).toBe(23);
    expect(result.band).toBe('needs_improvement');
  });

  it('keeps the documented factor maxima', () => {
    const result = calculateFinancialHealth(OCTOBER);

    expect(result.factors.map((factor) => factor.max)).toEqual([30, 25, 25, 20]);
    expect(result.factors.reduce((total, factor) => total + factor.max, 0)).toBe(100);
  });

  it('is not moved across a threshold by float noise', () => {
    // 0.1 + 0.2 !== 0.3 in binary floating point; the ratio must still be exactly 50%.
    const result = calculateFinancialHealth({
      totalIncome: 1000,
      totalExpenses: 0.1 + 0.2 + 499.7,
      budgetTotal: 1000,
    });

    expect(result.factors[0]).toMatchObject({ score: 30, status: 'excellent' });
  });
});

describe('budgetsForPeriod', () => {
  const start = '2026-10-01T00:00:00.000Z';
  const end = '2026-10-31T23:59:59.000Z';

  const budgets = [
    { id: 1, amount: '650.00', startDate: '2026-05-01T00:00:00.000Z', endDate: '2026-05-31T00:00:00.000Z' },
    { id: 2, amount: '650.00', startDate: '2026-09-01T00:00:00.000Z', endDate: '2026-09-30T00:00:00.000Z' },
    { id: 3, amount: '650.00', startDate: '2026-10-01T00:00:00.000Z', endDate: '2026-10-31T00:00:00.000Z' },
    { id: 4, amount: '800.00', startDate: '2026-09-15T00:00:00.000Z', endDate: '2026-10-14T00:00:00.000Z' },
  ];

  it('keeps only the budgets that overlap the period', () => {
    expect(budgetsForPeriod(budgets, start, end).map((budget) => budget.id)).toEqual([3, 4]);
  });

  it('returns nothing for unusable dates instead of everything', () => {
    expect(budgetsForPeriod(budgets, 'not-a-date', end)).toEqual([]);
  });
});

describe('healthBand', () => {
  it('matches the ranges printed in the tooltip', () => {
    expect(healthBand(100)).toBe('excellent');
    expect(healthBand(80)).toBe('excellent');
    expect(healthBand(79)).toBe('good');
    expect(healthBand(65)).toBe('good');
    expect(healthBand(64)).toBe('fair');
    expect(healthBand(50)).toBe('fair');
    expect(healthBand(49)).toBe('needs_improvement');
    expect(healthBand(0)).toBe('needs_improvement');
  });
});
