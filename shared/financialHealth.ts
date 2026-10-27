/**
 * The financial health score — one rubric, computed once.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Two different "financial health" numbers were on the same dashboard. A component (`financial-
 * health-score.tsx`) added up four weights in the browser; the AI endpoint (`/api/financial-health`)
 * asked a model for its own four factors and used that total. Neither was wrong in isolation, but
 * they answered different questions with different data and could not agree: the same month showed
 * 100 next to 57.
 *
 * The weights and the bands here are the ones the interface documents in its own tooltip
 * (30 / 25 / 25 / 20, "80-100 excellent, 65-79 good, 50-64 fair, below 50 needs improvement"), so
 * the model no longer gets a vote on the number. It writes the sentences.
 *
 * The other half of the bug was arithmetic, not taste: the browser summed *every* budget in the
 * account as if it were one month's plan. Six monthly budgets of 650 made a 3,900 allowance for a
 * month that had 650, so spending looked six times healthier than it was. `budgetsForPeriod` is the
 * fix, and it has to be applied on both sides — hence living here rather than in a component.
 */

export type HealthFactorKey =
  | 'spendingControl'
  | 'savingsRate'
  | 'budgetAdherence'
  | 'financialStability';

/**
 * `not_measured` is not a low score: it means the data needed for that factor is absent (no income
 * recorded, or no budget set). Those factors take half their maximum, and the interface says why
 * instead of silently awarding full marks — or punishing the person for a gap in the data.
 */
export type HealthFactorStatus = 'excellent' | 'good' | 'fair' | 'needs_improvement' | 'not_measured';

export interface HealthFactor {
  key: HealthFactorKey;
  score: number;
  max: number;
  status: HealthFactorStatus;
}

export interface FinancialHealth {
  /** 0-100, the sum of the four factors. */
  score: number;
  band: 'excellent' | 'good' | 'fair' | 'needs_improvement';
  factors: HealthFactor[];
}

export interface HealthInput {
  totalIncome: number;
  totalExpenses: number;
  /**
   * The budgets that apply to the same period, added together. Zero means none are set.
   * Passing every budget in the account is the bug this file exists to prevent, so callers build
   * this with `budgetsForPeriod`.
   */
  budgetTotal: number;
}

const MAX_SPENDING_CONTROL = 30;
const MAX_SAVINGS_RATE = 25;
const MAX_BUDGET_ADHERENCE = 25;
const MAX_STABILITY = 20;

/** Money as integer cents, so the ratio comparisons below are exact. */
const cents = (value: number): number => Math.round((Number.isFinite(value) ? value : 0) * 100);

/**
 * The budgets a period is judged against: those whose dates overlap it, inclusive.
 * A budget running 1-31 October overlaps October; one running in May does not.
 */
export function budgetsForPeriod<T extends { startDate: Date | string; endDate: Date | string }>(
  budgets: readonly T[],
  start: Date | string,
  end: Date | string,
): T[] {
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return [];

  return budgets.filter((budget) => {
    const budgetStart = new Date(budget.startDate).getTime();
    const budgetEnd = new Date(budget.endDate).getTime();
    if (!Number.isFinite(budgetStart) || !Number.isFinite(budgetEnd)) return false;
    return budgetStart <= to && budgetEnd >= from;
  });
}

/** The band the interface colours by. Derived from the total, never set independently. */
export function healthBand(score: number): FinancialHealth['band'] {
  if (score >= 80) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 50) return 'fair';
  return 'needs_improvement';
}

/**
 * The four factors, with the weights the tooltip promises.
 *
 * Ratios are compared as `a * b` rather than `a / b <= 0.5` so that 0.1 + 0.2 float noise cannot
 * move someone across a threshold, and so a test can assert an exact boundary.
 */
export function calculateFinancialHealth(input: HealthInput): FinancialHealth {
  const income = cents(input.totalIncome);
  const expenses = cents(Math.abs(input.totalExpenses));
  const net = income - expenses;
  const budget = cents(input.budgetTotal);

  const factors: HealthFactor[] = [];

  // 1. Spending control (30): how much of the income the period's expenses took.
  if (income <= 0) {
    factors.push({
      key: 'spendingControl',
      score: Math.round(MAX_SPENDING_CONTROL / 2),
      max: MAX_SPENDING_CONTROL,
      status: 'not_measured',
    });
  } else if (expenses * 2 <= income) {
    factors.push({ key: 'spendingControl', score: 30, max: 30, status: 'excellent' });
  } else if (expenses * 5 <= income * 4) {
    factors.push({ key: 'spendingControl', score: 20, max: 30, status: 'good' });
  } else {
    factors.push({ key: 'spendingControl', score: 10, max: 30, status: 'needs_improvement' });
  }

  // 2. Savings rate (25): what was left at the end of the period.
  if (income <= 0) {
    factors.push({
      key: 'savingsRate',
      score: Math.round(MAX_SAVINGS_RATE / 2),
      max: MAX_SAVINGS_RATE,
      status: 'not_measured',
    });
  } else if (net * 5 >= income) {
    factors.push({ key: 'savingsRate', score: 25, max: 25, status: 'excellent' });
  } else if (net * 10 >= income) {
    factors.push({ key: 'savingsRate', score: 18, max: 25, status: 'good' });
  } else if (net >= 0) {
    factors.push({ key: 'savingsRate', score: 10, max: 25, status: 'fair' });
  } else {
    factors.push({ key: 'savingsRate', score: 0, max: 25, status: 'needs_improvement' });
  }

  // 3. Budget adherence (25): expenses against the budgets of the same period.
  if (budget <= 0) {
    factors.push({
      key: 'budgetAdherence',
      score: Math.round(MAX_BUDGET_ADHERENCE / 2),
      max: MAX_BUDGET_ADHERENCE,
      status: 'not_measured',
    });
  } else if (expenses * 5 <= budget * 4) {
    factors.push({ key: 'budgetAdherence', score: 25, max: 25, status: 'excellent' });
  } else if (expenses <= budget) {
    factors.push({ key: 'budgetAdherence', score: 18, max: 25, status: 'good' });
  } else {
    factors.push({ key: 'budgetAdherence', score: 8, max: 25, status: 'needs_improvement' });
  }

  // 4. Financial stability (20): did the period end with money left over.
  if (net > 0 && income > expenses) {
    factors.push({ key: 'financialStability', score: 20, max: 20, status: 'excellent' });
  } else if (net >= 0) {
    factors.push({ key: 'financialStability', score: 12, max: 20, status: 'good' });
  } else {
    factors.push({ key: 'financialStability', score: 5, max: 20, status: 'needs_improvement' });
  }

  const score = factors.reduce((total, factor) => total + factor.score, 0);

  return { score: Math.max(0, Math.min(100, score)), band: healthBand(score), factors };
}

