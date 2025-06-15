import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, CreditCard, Wallet, PiggyBank } from "lucide-react";

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

    const recentAvg = recentTransactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0) / recentTransactions.length;
    const olderAvg = olderTransactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0) / olderTransactions.length;

    if (recentAvg > olderAvg * 1.1) return 'increasing';
    if (recentAvg < olderAvg * 0.9) return 'decreasing';
    return 'stable';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  const topExpense = summary?.transactionsByCategory && Array.isArray(summary.transactionsByCategory)
    ? summary.transactionsByCategory
        .filter((cat: any) => cat.type === 'expense' && cat.amount < 0)
        .sort((a: any, b: any) => Math.abs(b.amount) - Math.abs(a.amount))[0]
    : null;

  const topIncome = summary?.transactionsByCategory && Array.isArray(summary.transactionsByCategory)
    ? summary.transactionsByCategory
        .filter((cat: any) => cat.type === 'income' && cat.amount > 0)
        .sort((a: any, b: any) => Math.abs(b.amount) - Math.abs(a.amount))[0]
    : null;

  // Calculate spending trend based on available data
  const currentMonthExpenses = Math.abs(summary?.totalExpenses || 0);
  const hasTransactionData = transactions && Array.isArray(transactions) && transactions.length > 0;

  // More sophisticated trend calculation if we have transaction data
  let spendingTrend = 'stable';
  if (hasTransactionData) {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const lastMonthExpenses = transactions
      .filter(t => {
        const tDate = new Date(t.date);
        return t.type === 'expense' && tDate >= lastMonth && tDate < currentMonth;
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

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
      title: "Monthly Balance",
      value: formatCurrency(summary?.netBalance || 0),
      description: (summary?.netBalance || 0) >= 0 ? "Positive cash flow" : "Negative cash flow",
      color: (summary?.netBalance || 0) >= 0 ? "text-green-600" : "text-red-600",
      bgColor: (summary?.netBalance || 0) >= 0 ? "bg-green-50" : "bg-red-50"
    },
    {
      icon: CreditCard,
      title: "Top Expense",
      value: topExpense ? formatCurrency(topExpense.amount) : "$0",
      description: topExpense?.categoryName || "No expenses",
      color: "text-red-600",
      bgColor: "bg-red-50"
    },
    {
      icon: PiggyBank,
      title: "Top Income",
      value: topIncome ? formatCurrency(topIncome.amount) : "$0",
      description: topIncome?.categoryName || "No income",
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      icon: spendingTrend === 'increasing' ? TrendingUp : 
            spendingTrend === 'decreasing' ? TrendingDown : DollarSign,
      title: "Spending Trend",
      value: spendingTrend === 'increasing' ? "↗ Rising" : 
             spendingTrend === 'decreasing' ? "↘ Falling" : "→ Stable",
      description: spendingTrend === 'increasing' ? "Expenses are increasing" :
                   spendingTrend === 'decreasing' ? "Expenses are decreasing" : "Consistent spending",
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
          Quick Financial Snapshot
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
                  <p className="text-xs text-gray-500">
                    {insight.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 space-y-1">
            <p className="font-medium">Quick Tips:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              {(summary?.netBalance || 0) < 0 && (
                <li>Focus on reducing expenses this month</li>
              )}
              {spendingTrend === 'increasing' && (
                <li>Monitor your spending - it's trending upward</li>
              )}
              {topExpense && Math.abs(topExpense.amount) > (summary?.totalIncome || 0) * 0.3 && (
                <li>Consider reviewing your {topExpense.categoryName.toLowerCase()} expenses</li>
              )}
              {(summary?.netBalance || 0) > 0 && spendingTrend !== 'increasing' && (
                <li>Great job! You're maintaining healthy finances</li>
              )}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}