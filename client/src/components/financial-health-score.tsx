import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Shield, AlertTriangle, CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HelpTooltip } from "@/components/help-tooltip";
import {
  budgetsForPeriod,
  calculateFinancialHealth,
  type HealthFactor,
  type HealthFactorKey,
} from "@shared/financialHealth";

interface FinancialHealthProps {
  summary?: {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
  };
  /** Every budget in the account. Only the ones covering `startDate`-`endDate` are counted. */
  budgets?: Array<{ amount: string | number; startDate: string; endDate: string }>;
  /** The period the summary covers, so the budgets are read against the same days. */
  startDate?: string;
  endDate?: string;
}

/** Label key for each factor, so a factor is matched by name rather than by translated text. */
const FACTOR_LABELS: Record<HealthFactorKey, string> = {
  spendingControl: 'financial_health.spending_control',
  savingsRate: 'financial_health.savings_rate',
  budgetAdherence: 'financial_health.budget_adherence',
  financialStability: 'financial_health.financial_stability',
};

// Explicit classes instead of `text-${color}-600`. Two reasons: 600-level yellow is 3.1:1 on
// white (axes flags it, and rightly), and a class built by interpolation is invisible to
// Tailwind's scanner, so whether it exists in the stylesheet is luck.
const BAND_TEXT: Record<string, string> = {
  excellent: 'text-green-700 dark:text-green-300',
  good: 'text-blue-700 dark:text-blue-300',
  fair: 'text-yellow-700 dark:text-yellow-300',
  needs_improvement: 'text-red-700 dark:text-red-300',
};

const BAND_BAR: Record<string, string> = {
  excellent: '#10b981',
  good: '#3b82f6',
  fair: '#f59e0b',
  needs_improvement: '#ef4444',
};

const STATUS_DOT: Record<string, string> = {
  excellent: 'bg-green-500',
  good: 'bg-blue-500',
  fair: 'bg-yellow-500',
  needs_improvement: 'bg-red-500',
  not_measured: 'bg-gray-400',
};

const BAND_ICON = {
  excellent: CheckCircle,
  good: TrendingUp,
  fair: Shield,
  needs_improvement: AlertTriangle,
} as const;

/** The recommendations this period deserves, one per factor that is not at its maximum. */
function recommendationsFor(factors: HealthFactor[]): string[] {
  const byKey = (key: HealthFactorKey) => factors.find((factor) => factor.key === key);
  const list: string[] = [];

  const spending = byKey('spendingControl');
  const savings = byKey('savingsRate');
  const budget = byKey('budgetAdherence');

  // A factor that could not be measured says nothing about the person's habits, so it only earns
  // advice where the fix is the missing data itself (setting a budget).
  if (spending && spending.status !== 'not_measured' && spending.score < spending.max) {
    list.push('financial_health.recommendation_expenses');
  }
  if (savings && savings.status !== 'not_measured' && savings.score < savings.max) {
    list.push('financial_health.recommendation_savings');
  }
  if (budget && budget.score < budget.max) {
    list.push('financial_health.recommendation_budgets');
  }

  return list;
}

export default function FinancialHealthScore({ summary, budgets, startDate, endDate }: FinancialHealthProps) {
  const { t } = useTranslation();

  // Every budget in the account used to be summed here, so a year of monthly budgets became one
  // enormous allowance. Only the budgets covering the same days as the summary count.
  const periodBudgets = budgetsForPeriod(budgets ?? [], startDate ?? new Date(), endDate ?? new Date());
  const budgetTotal = periodBudgets.reduce((total, budget) => total + Number(budget.amount || 0), 0);

  const healthData = summary
    ? calculateFinancialHealth({
        totalIncome: summary.totalIncome,
        totalExpenses: summary.totalExpenses,
        budgetTotal,
      })
    : null;

  const score = healthData?.score ?? 0;
  const band = healthData?.band ?? 'needs_improvement';
  const StatusIcon = BAND_ICON[band];
  const scoreText = BAND_TEXT[band];
  const recommendations = healthData ? recommendationsFor(healthData.factors) : [];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {healthData && <StatusIcon className={`h-5 w-5 ${scoreText}`} />}
          {t('financial_health.title')}
          <HelpTooltip label={t('help.what_this_does')}>
            <div className="space-y-1">
              <p>{t('help.health_score')}</p>
              <div className="mt-2 font-semibold">{t('financial_health.tooltip.calculation_title')}</div>
              <div>
                <strong>{t('financial_health.tooltip.spending_control_title')}</strong>{' '}
                {t('financial_health.tooltip.spending_control_desc')}
              </div>
              <div>
                <strong>{t('financial_health.tooltip.savings_rate_title')}</strong>{' '}
                {t('financial_health.tooltip.savings_rate_desc')}
              </div>
              <div>
                <strong>{t('financial_health.tooltip.budget_adherence_title')}</strong>{' '}
                {t('financial_health.tooltip.budget_adherence_desc')}
              </div>
              <div>
                <strong>{t('financial_health.tooltip.financial_stability_title')}</strong>{' '}
                {t('financial_health.tooltip.financial_stability_desc')}
              </div>
              <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                <strong>{t('financial_health.tooltip.score_ranges')}</strong><br />
                {t('financial_health.tooltip.score_ranges_detail')}
              </div>
            </div>
          </HelpTooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className={`text-4xl font-bold ${scoreText} mb-2`}>{healthData ? score : '—'}</div>
          <div className={`text-sm font-medium ${scoreText}`}>
            {healthData ? t(`financial_health.status.${band}`) : t('financial_health.loading')}
          </div>
          <Progress
            aria-label={t('a11y.health_score')}
            aria-valuetext={`${score} / 100`}
            value={score}
            className="mt-3"
            style={{
              background: `linear-gradient(to right, ${BAND_BAR[band]} 0%, ${BAND_BAR[band]} ${score}%, #e5e7eb ${score}%)`,
            }}
          />
        </div>

        {healthData && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">
              {t('financial_health.score_breakdown')}
            </h4>
            {healthData.factors.map((factor) => (
              <div key={factor.key} className="flex justify-between items-center text-xs">
                <span className="text-gray-600 dark:text-gray-400">{t(FACTOR_LABELS[factor.key])}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{factor.score}/{factor.max}</span>
                  <div
                    aria-label={t(`financial_health.status.${factor.status}`)}
                    className={`w-2 h-2 rounded-full ${STATUS_DOT[factor.status]}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p className="font-medium">{t('financial_health.recommendations')}</p>
            {recommendations.length > 0 ? (
              <ul className="list-disc list-inside space-y-1 ml-2">
                {recommendations.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
            ) : (
              // The heading used to print on its own when the score was high, which read like
              // something had failed to load. Say the good news instead.
              <p>{t('financial_health.all_good')}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
