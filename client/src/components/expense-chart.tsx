
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { DollarSign } from "lucide-react";
import { useTranslation } from "react-i18next";


interface ExpenseChartProps {
  summary?: {
    totalExpenses: number;
    expensesByCategory: { category: string; amount: number; color?: string }[];
  };
}

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe',
  '#00c49f', '#ffbb28', '#ff8042', '#8dd1e1', '#d084d0'
];

export function ExpenseChart({ summary }: ExpenseChartProps) {
  const { t } = useTranslation();
  const { data: expenseData } = useQuery({
    queryKey: ['/api/expense-breakdown'],
    enabled: !summary,
  });

  // Handle both summary data and API data
  let data = [];
  let totalExpenses = 0;

  if (summary?.expensesByCategory) {
    // Use summary data if provided
    data = summary.expensesByCategory;
    totalExpenses = summary.totalExpenses;
  } else if (expenseData) {
    // Use API data if no summary provided
    data = expenseData.expensesByCategory || [];
    totalExpenses = expenseData.totalExpenses || 0;
  }

  const chartData = data.map((item, index) => ({
    ...item,
    color: item.color || COLORS[index % COLORS.length],
    percentage: totalExpenses > 0 ? ((item.amount / totalExpenses) * 100).toFixed(1) : '0.0'
  }));

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {t('Expense Breakdown')}
          </CardTitle>
          <CardDescription>
            {t('Your spending by category')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="mx-auto h-12 w-12 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
              <DollarSign className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('No Expenses to Display')}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {t('Add some expense transactions to see your spending breakdown')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          {t('Expense Breakdown')}
        </CardTitle>
        <CardDescription>
          {t('Your spending by category this month')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name} (${percentage}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="amount"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`$${value.toLocaleString()}`, t('Amount')]}
                labelFormatter={(label) => `${t('Category')}: ${label}`}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-4 space-y-2">
          {chartData.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.category}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">${item.amount.toLocaleString()}</span>
                <span className="text-gray-500">({item.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
