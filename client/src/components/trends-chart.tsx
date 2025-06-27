import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import RequirePlan from "@/components/require-plan";
import { useCurrency } from "@/context/CurrencyContext";
import { useTranslation } from "react-i18next";

export default function TrendsChart() {
  const { t } = useTranslation();
  const { isReady, user } = useClerkUserReady();
  const { currency } = useCurrency();
  const displayCurrency = currency || '$';

  // Fetch user's actual financial data for trend calculation
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    enabled: isReady && !!user?.id,
    staleTime: 0,
    gcTime: 0,
  });

  const generateTrendData = () => {
    if (!transactions || !Array.isArray(transactions)) {
      return [];
    }

    const data = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = date.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric'
      });
      
      // Calculate start and end of month
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      // Filter transactions for this month
      const monthTransactions = transactions.filter((t: any) => {
        const tDate = new Date(t.date);
        return tDate >= monthStart && tDate <= monthEnd;
      });
      
      // Calculate totals for this month
      const income = monthTransactions
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
      
      const expenses = monthTransactions
        .filter((t: any) => t.type === 'expense')
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
      
      const netBalance = income - expenses;
      
      data.push({
        month: monthLabel,
        income: Math.round(income),
        expenses: Math.round(expenses),
        netBalance: Math.round(netBalance),
      });
    }
    
    return data;
  };

  const trendData = generateTrendData();

  const formatCurrency = (value: number) => {
    return `${displayCurrency}${value.toLocaleString()}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-4 border rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 dark:text-white mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Show loading state while data is being fetched
  if (!isReady || transactionsLoading) {
    return (
      <Card className="bg-white dark:bg-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                {t("Financial Trends")}
              </CardTitle>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {t("Evolution of your income, expenses and net balance over the last months")}
              </p>
            </div>
            <Badge className="bg-premium text-white">
              <Crown className="h-3 w-3 mr-1" />
              {t("Premium")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <Skeleton className="w-full h-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <RequirePlan plan="premium" feature={t("Financial Trends")}>
      <Card className="bg-white dark:bg-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                {t("Financial Trends")}
              </CardTitle>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {t("Evolution of your income, expenses and net balance over the last months")}
              </p>
            </div>
            <Badge className="bg-premium text-white">
              <Crown className="h-3 w-3 mr-1" />
              {t("Premium")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={trendData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 20,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="month" 
                className="text-xs"
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={formatCurrency}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="income"
                stroke="hsl(var(--success))"
                strokeWidth={3}
                dot={{ fill: "hsl(var(--success))", strokeWidth: 2, r: 4 }}
                name={t("Income")}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                stroke="hsl(var(--destructive))"
                strokeWidth={3}
                dot={{ fill: "hsl(var(--destructive))", strokeWidth: 2, r: 4 }}
                name={t("Expenses")}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="netBalance"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                name={t("Net Balance")}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
    </RequirePlan>
  );
}
