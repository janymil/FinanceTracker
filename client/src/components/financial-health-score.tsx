import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Shield, AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

interface FinancialHealthProps {
  summary?: {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
  };
  budgets?: any[];
}

export default function FinancialHealthScore({ summary, budgets }: FinancialHealthProps) {
  // This component is designed for free users and provides mathematical calculations only
  const { t } = useTranslation();

  const calculateHealthScore = () => {
    if (!summary) return { score: 0, status: 'Loading...', color: 'gray' };

    let score = 0;
    const factors = [];

    // Income vs Expenses ratio (30% weight)
    const incomeExpenseRatio = summary.totalIncome > 0 ? Math.abs(summary.totalExpenses) / summary.totalIncome : 0;
    if (incomeExpenseRatio <= 0.5) {
      score += 30;
      factors.push({ name: t('financial_health.spending_control'), score: 30, max: 30, status: 'excellent' });
    } else if (incomeExpenseRatio <= 0.8) {
      score += 20;
      factors.push({ name: t('financial_health.spending_control'), score: 20, max: 30, status: 'good' });
    } else {
      score += 10;
      factors.push({ name: t('financial_health.spending_control'), score: 10, max: 30, status: 'needs improvement' });
    }

    // Savings rate (25% weight)
    const savingsRate = summary.totalIncome > 0 ? summary.netBalance / summary.totalIncome : 0;
    if (savingsRate >= 0.2) {
      score += 25;
      factors.push({ name: t('financial_health.savings_rate'), score: 25, max: 25, status: 'excellent' });
    } else if (savingsRate >= 0.1) {
      score += 18;
      factors.push({ name: t('financial_health.savings_rate'), score: 18, max: 25, status: 'good' });
    } else if (savingsRate >= 0) {
      score += 10;
      factors.push({ name: t('financial_health.savings_rate'), score: 10, max: 25, status: 'fair' });
    } else {
      score += 0;
      factors.push({ name: t('financial_health.savings_rate'), score: 0, max: 25, status: 'critical' });
    }

    // Budget adherence (25% weight)
    const totalBudget = budgets?.reduce((sum, budget) => sum + parseFloat(budget.amount), 0) || 0;
    const budgetUsage = totalBudget > 0 ? Math.abs(summary.totalExpenses) / totalBudget : 0;
    if (budgetUsage <= 0.8) {
      score += 25;
      factors.push({ name: t('financial_health.budget_adherence'), score: 25, max: 25, status: 'excellent' });
    } else if (budgetUsage <= 1.0) {
      score += 18;
      factors.push({ name: t('financial_health.budget_adherence'), score: 18, max: 25, status: 'good' });
    } else {
      score += 8;
      factors.push({ name: t('financial_health.budget_adherence'), score: 8, max: 25, status: 'needs improvement' });
    }

    // Financial stability (20% weight)
    if (summary.netBalance > 0 && summary.totalIncome > Math.abs(summary.totalExpenses)) {
      score += 20;
      factors.push({ name: t('financial_health.financial_stability'), score: 20, max: 20, status: 'excellent' });
    } else if (summary.netBalance >= 0) {
      score += 12;
      factors.push({ name: t('financial_health.financial_stability'), score: 12, max: 20, status: 'good' });
    } else {
      score += 5;
      factors.push({ name: t('financial_health.financial_stability'), score: 5, max: 20, status: 'needs attention' });
    }

    let status = t('financial_health.status.excellent');
    let color = 'green';
    let icon = CheckCircle;

    if (score >= 80) {
      status = t('financial_health.status.excellent');
      color = 'green';
      icon = CheckCircle;
    } else if (score >= 65) {
      status = t('financial_health.status.good');
      color = 'blue';
      icon = TrendingUp;
    } else if (score >= 50) {
      status = t('financial_health.status.fair');
      color = 'yellow';
      icon = Shield;
    } else {
      status = t('financial_health.status.needs_improvement');
      color = 'red';
      icon = AlertTriangle;
    }

    return { score: Math.round(score), status, color, factors, icon };
  };

  const healthData = calculateHealthScore();
  const StatusIcon = healthData.icon || CheckCircle;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <StatusIcon className={`h-5 w-5 text-${healthData.color}-600`} />
          {t('financial_health.title')}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm p-4 text-sm">
                <div className="space-y-2">
                  <div className="font-semibold">{t('financial_health.tooltip.calculation_title')}</div>
                  <div>
                    <strong>{t('financial_health.tooltip.spending_control_title')}</strong> {t('financial_health.tooltip.spending_control_desc')}
                  </div>
                  <div>
                    <strong>{t('financial_health.tooltip.savings_rate_title')}</strong> {t('financial_health.tooltip.savings_rate_desc')}
                  </div>
                  <div>
                    <strong>{t('financial_health.tooltip.budget_adherence_title')}</strong> {t('financial_health.tooltip.budget_adherence_desc')}
                  </div>
                  <div>
                    <strong>{t('financial_health.tooltip.financial_stability_title')}</strong> {t('financial_health.tooltip.financial_stability_desc')}
                  </div>
                  <div className="mt-3 pt-2 border-t border-gray-200">
                    <strong>{t('financial_health.tooltip.score_ranges')}</strong><br />
                    {t('financial_health.tooltip.score_ranges_detail')}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className={`text-4xl font-bold text-${healthData.color}-600 mb-2`}>
            {healthData.score}
          </div>
          <div className={`text-sm font-medium text-${healthData.color}-600`}>
            {healthData.status}
          </div>
          <Progress 
            value={healthData.score} 
            className="mt-3"
            style={{
              background: `linear-gradient(to right, ${
                healthData.color === 'green' ? '#10b981' :
                healthData.color === 'blue' ? '#3b82f6' :
                healthData.color === 'yellow' ? '#f59e0b' : '#ef4444'
              } 0%, ${
                healthData.color === 'green' ? '#10b981' :
                healthData.color === 'blue' ? '#3b82f6' :
                healthData.color === 'yellow' ? '#f59e0b' : '#ef4444'
              } ${healthData.score}%, #e5e7eb ${healthData.score}%)`
            }}
          />
        </div>

        <div className="space-y-3">
          <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">
{t('financial_health.score_breakdown')}
          </h4>
          {(healthData.factors || []).map((factor, index) => (
            <div key={index} className="flex justify-between items-center text-xs">
              <span className="text-gray-600 dark:text-gray-400">{factor.name}</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{factor.score}/{factor.max}</span>
                <div className={`w-2 h-2 rounded-full ${
                  factor.status === 'excellent' ? 'bg-green-500' :
                  factor.status === 'good' ? 'bg-blue-500' :
                  factor.status === 'fair' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p className="font-medium">{t('financial_health.recommendations')}</p>
            {healthData.score < 80 && (
              <ul className="list-disc list-inside space-y-1 ml-2">
                {(healthData.factors || []).find(f => f.name === t('financial_health.spending_control') && f.score < 25) && (
                  <li>{t('financial_health.recommendation_expenses')}</li>
                )}
                {(healthData.factors || []).find(f => f.name === t('financial_health.savings_rate') && f.score < 20) && (
                  <li>{t('financial_health.recommendation_savings')}</li>
                )}
                {(healthData.factors || []).find(f => f.name === t('financial_health.budget_adherence') && f.score < 20) && (
                  <li>{t('financial_health.recommendation_budgets')}</li>
                )}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}