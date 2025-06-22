import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, TrendingDown, PiggyBank, AlertCircle, CheckCircle } from "lucide-react";

interface ContextualTipsProps {
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
  budgets?: any[];
}

interface FinancialTip {
  id: string;
  title: string;
  description: string;
  category: 'spending' | 'saving' | 'budgeting' | 'income';
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  icon: any;
}

export default function ContextualFinancialTips({ summary, transactions, budgets }: ContextualTipsProps) {
  const generateTips = (): FinancialTip[] => {
    const tips: FinancialTip[] = [];

    if (!summary) return tips;

    const expenseRatio = summary.totalIncome > 0 ? Math.abs(summary.totalExpenses) / summary.totalIncome : 0;
    const savingsRate = summary.totalIncome > 0 ? summary.netBalance / summary.totalIncome : 0;

    // High expense ratio tips
    if (expenseRatio > 0.9) {
      tips.push({
        id: 'high-expenses',
        title: 'Expenses Too High',
        description: 'You\'re spending over 90% of your income. Consider reviewing your largest expense categories and finding areas to cut back.',
        category: 'spending',
        priority: 'high',
        actionable: true,
        icon: AlertCircle
      });
    }

    // Only show savings tips if there's actual financial data
    if (savingsRate < 0.1 && summary.netBalance >= 0 && summary.totalIncome > 0 && transactions && transactions.length > 0) {
      tips.push({
        id: 'low-savings',
        title: 'Increase Your Savings Rate',
        description: 'Aim to save at least 10-20% of your income. Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings.',
        category: 'saving',
        priority: 'medium',
        actionable: true,
        icon: PiggyBank
      });
    }

    // Negative balance tips
    if (summary.netBalance < 0) {
      tips.push({
        id: 'negative-balance',
        title: 'Spending Exceeds Income',
        description: 'You\'re spending more than you earn this month. Review your expenses and consider creating an emergency budget.',
        category: 'spending',
        priority: 'high',
        actionable: true,
        icon: AlertCircle
      });
    }

    // Category-specific tips
    if (summary.transactionsByCategory) {
      const expenseCategories = summary.transactionsByCategory
        .filter(cat => cat.type === 'expense')
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

      // High single category spending
      const topExpense = expenseCategories[0];
      if (topExpense && Math.abs(topExpense.amount) > summary.totalIncome * 0.4) {
        tips.push({
          id: 'high-category-spending',
          title: `High ${topExpense.categoryName} Spending`,
          description: `Your ${topExpense.categoryName.toLowerCase()} expenses are taking up a large portion of your income. Consider ways to reduce these costs.`,
          category: 'spending',
          priority: 'medium',
          actionable: true,
          icon: TrendingDown
        });
      }
    }

    // Budget adherence tips
    if (budgets && budgets.length > 0) {
      const totalBudget = budgets.reduce((sum, budget) => sum + parseFloat(budget.amount), 0);
      const budgetUsage = totalBudget > 0 ? Math.abs(summary.totalExpenses) / totalBudget : 0;

      if (budgetUsage > 1.1) {
        tips.push({
          id: 'over-budget',
          title: 'Over Budget This Month',
          description: 'You\'ve exceeded your total budget by more than 10%. Review your spending patterns and adjust your budgets or spending habits.',
          category: 'budgeting',
          priority: 'high',
          actionable: true,
          icon: AlertCircle
        });
      }
    }

    // Frequent small transactions tip
    if (transactions) {
      const smallTransactions = transactions.filter(t => 
        t.type === 'expense' && Math.abs(parseFloat(t.amount)) < 50
      );
      
      if (smallTransactions.length > 10) {
        const smallTransactionTotal = smallTransactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
        
        if (smallTransactionTotal > summary.totalIncome * 0.15) {
          tips.push({
            id: 'small-purchases',
            title: 'Small Purchases Add Up',
            description: `You have ${smallTransactions.length} small transactions totaling $${smallTransactionTotal.toFixed(2)}. Consider tracking these micro-expenses more carefully.`,
            category: 'spending',
            priority: 'low',
            actionable: true,
            icon: Lightbulb
          });
        }
      }
    }

    // Positive reinforcement tips
    if (savingsRate >= 0.2) {
      tips.push({
        id: 'good-savings',
        title: 'Excellent Savings Rate!',
        description: 'You\'re saving over 20% of your income. Keep up the great work! Consider investing some of these savings for long-term growth.',
        category: 'saving',
        priority: 'low',
        actionable: false,
        icon: CheckCircle
      });
    }

    // Only show positive spending tips if there's actual transaction data
    if (expenseRatio < 0.7 && summary.totalIncome > 0 && summary.totalExpenses > 0 && transactions && transactions.length > 0) {
      tips.push({
        id: 'controlled-spending',
        title: 'Well-Controlled Spending',
        description: 'Your expenses are well within a healthy range. This gives you flexibility for savings and investments.',
        category: 'spending',
        priority: 'low',
        actionable: false,
        icon: CheckCircle
      });
    }

    return tips.slice(0, 4); // Limit to 4 most relevant tips
  };

  const tips = generateTips();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'spending': return TrendingDown;
      case 'saving': return PiggyBank;
      case 'budgeting': return AlertCircle;
      case 'income': return CheckCircle;
      default: return Lightbulb;
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-600" />
          Personalized Financial Tips
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tips.length === 0 ? (
          <div className="text-center py-8">
            <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Add transactions to get personalized financial insights
            </p>
          </div>
        ) : (
          tips.map((tip) => {
            const IconComponent = tip.icon;
            return (
              <div key={tip.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <IconComponent className={`h-5 w-5 ${
                      tip.priority === 'high' ? 'text-red-600' :
                      tip.priority === 'medium' ? 'text-yellow-600' :
                      'text-green-600'
                    }`} />
                    <h4 className="font-medium text-sm">{tip.title}</h4>
                  </div>
                  <Badge className={`${getPriorityColor(tip.priority)} text-xs`}>
                    {tip.priority}
                  </Badge>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {tip.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {tip.category}
                  </Badge>
                  {tip.actionable && (
                    <span className="text-xs text-blue-600 font-medium">
                      Action Required
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
        
        {tips.length > 0 && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Tips are generated based on your current spending patterns and financial goals.
              Review them regularly to maintain healthy financial habits.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}