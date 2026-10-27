import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, CreditCard, Wallet, PiggyBank } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";
import { useTranslation } from "react-i18next";
import { getDateRangeForFilter, isDateInRange } from "@/lib/dateRangeUtils";
import { sumTransactionAmounts } from "@shared/calculations";

interface QuickSnapshotProps {
  summary?: {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    transactionsByCategory: Array<{
      categoryName: string;
      amount: number;
      type: string;
    }>;
  };
  transactions?: any[];
}

export default function QuickFinancialSnapshot({ summary, transactions }: QuickSnapshotProps) {
  const { currency } = useCurrency();
  const { t } = useTranslation();
  
  // Don't show currency symbol if none is selected yet
  const displayCurrency = currency || '$';
  const getTopCategories = () => {
    if (!summary?.transactionsByCategory) return { topExpense: null, topIncome: null };

    const expenseCategories = summary.transactionsByCategory
      .filter(cat => cat.type === 'expense')
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    const incomeCategories = summary.transactionsByCategory
      .filter(cat => cat.type === 'income')
      .sort((a, b) => b.amount - a.amount);

    return {
      topExpense: expenseCategories[0] || null,
      topIncome: incomeCategories[0] || null
    };
  };

  const getSpendingTrend = () => {
    if (!transactions || transactions.length < 2) return 'stable';

    const recentTransactions = transactions
      .filter(t => t.type === 'expense')
      .slice(0, 5);

    const olderTransactions = transactions
      .filter(t => t.type === 'expense')
      .slice(5, 10);

    if (recentTransactions.length === 0 || olderTransactions.length === 0) return 'stable';

    const recentAvg = sumTransactionAmounts(recentTransactions) / recentTransactions.length;
    const olderAvg = sumTransactionAmounts(olderTransactions) / olderTransactions.length;

    if (recentAvg > olderAvg * 1.1) return 'increasing';
    if (recentAvg < olderAvg * 0.9) return 'decreasing';
    return 'stable';
  };

  const formatCurrency = (amount: number) => {
    return `${displayCurrency}${Math.abs(amount).toLocaleString()}`;
  };

  const topExpense = summary?.transactionsByCategory && Array.isArray(summary.transactionsByCategory)
    ? summary.transactionsByCategory
        .filter((cat: any) => cat.type === 'expense')
        .sort((a: any, b: any) => Math.abs(b.amount) - Math.abs(a.amount))[0]
    : null;

  const topIncome = summary?.transactionsByCategory && Array.isArray(summary.transactionsByCategory)
    ? summary.transactionsByCategory
        .filter((cat: any) => cat.type === 'income')
        .sort((a: any, b: any) => Math.abs(b.amount) - Math.abs(a.amount))[0]
    : null;

  // Calculate spending trend based on available data
  const currentMonthExpenses = Math.abs(summary?.totalExpenses || 0);
  const hasTransactionData = transactions && Array.isArray(transactions) && transactions.length > 0;

  // More sophisticated trend calculation if we have transaction data
  let spendingTrend = 'stable';
  if (hasTransactionData) {
    const lastMonthRange = getDateRangeForFilter('last-month');
    
    const lastMonthExpenses = lastMonthRange ? sumTransactionAmounts(transactions
      .filter(t => {
        const tDate = new Date(t.date);
        return t.type === 'expense' && isDateInRange(tDate, lastMonthRange);
      })) : 0;

    if (currentMonthExpenses > lastMonthExpenses * 1.1) {
      spendingTrend = 'increasing';
    } else if (currentMonthExpenses < lastMonthExpenses * 0.9) {
      spendingTrend = 'decreasing';
    }
  } else {
    // Fallback trend calculation
    spendingTrend = currentMonthExpenses > 500 ? 'increasing' : 
                   currentMonthExpenses < 200 ? 'decreasing' : 'stable';
  }

  const insights = [
    {
      icon: Wallet,
      title: t("Monthly Balance"),
      value: formatCurrency(summary?.netBalance || 0),
      description: (summary?.netBalance || 0) >= 0 ? t("Positive cash flow") : t("Negative cash flow"),
      // 700-level on the tinted tile backgrounds: green-600 on green-50 is ~3.3:1.
      color: (summary?.netBalance || 0) >= 0 ? "text-green-700" : "text-red-700",
      bgColor: (summary?.netBalance || 0) >= 0 ? "bg-green-50" : "bg-red-50"
    },
    {
      icon: CreditCard,
      title: t("Top Expense"),
      value: topExpense ? formatCurrency(topExpense.amount) : `${displayCurrency}0`,
      description: topExpense?.categoryName || t("No expenses"),
      color: "text-red-700",
      bgColor: "bg-red-50"
    },
    {
      icon: PiggyBank,
      title: t("Top Income"),
      value: topIncome ? formatCurrency(topIncome.amount) : `${displayCurrency}0`,
      description: topIncome?.categoryName || t("No income"),
      color: "text-green-700",
      bgColor: "bg-green-50"
    },
    {
      icon: spendingTrend === 'increasing' ? TrendingUp : 
            spendingTrend === 'decreasing' ? TrendingDown : DollarSign,
      title: t("Spending Trend"),
      value: spendingTrend === 'increasing' ? t("↗ Rising") : 
             spendingTrend === 'decreasing' ? t("↘ Falling") : t("→ Stable"),
      description: spendingTrend === 'increasing' ? t("Expenses are increasing") :
                   spendingTrend === 'decreasing' ? t("Expenses are decreasing") : t("Consistent spending"),
      color: spendingTrend === 'increasing' ? "text-orange-600" : 
             spendingTrend === 'decreasing' ? "text-blue-600" : "text-gray-600",
      bgColor: spendingTrend === 'increasing' ? "bg-orange-50" : 
               spendingTrend === 'decreasing' ? "bg-blue-50" : "bg-gray-50"
    }
  ];

  return (
    <Card className="h-full">
      <CardContent className="p-6">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-blue-600" />
          {t("Quick Financial Snapshot")}
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {insights.map((insight, index) => {
            const IconComponent = insight.icon;
            return (
              <div key={index} className={`${insight.bgColor} p-4 rounded-lg border`}>
                <div className="flex items-start justify-between mb-2">
                  <IconComponent className={`h-5 w-5 ${insight.color}`} />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">
                    {insight.title}
                  </p>
                  <p className={`text-lg font-bold ${insight.color} mb-1`}>
                    {insight.value}
                  </p>
                  <p className="text-xs text-gray-600">
                    {insight.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-600 space-y-1">
            <p className="font-medium">{t("Quick Tips")}:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              {(summary?.netBalance || 0) < 0 && (
                <li>{t("Focus on reducing expenses this month")}</li>
              )}
              {spendingTrend === 'increasing' && (
                <li>{t("Monitor your spending - it's trending upward")}</li>
              )}
              {topExpense && Math.abs(topExpense.amount) > (summary?.totalIncome || 0) * 0.3 && (
                <li>{t("Consider reviewing your {{category}} expenses", { category: topExpense.categoryName.toLowerCase() })}</li>
              )}
              {(summary?.netBalance || 0) > 0 && spendingTrend !== 'increasing' && (
                <li>{t("Great job! You're maintaining healthy finances")}</li>
              )}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}