import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { useState } from "react";

interface FinancialSummary {
  transactionsByCategory: Array<{
    categoryName: string;
    amount: number;
    type: string;
  }>;
}

interface ExpenseChartProps {
  summary?: FinancialSummary;
}

export default function ExpenseChart({ summary }: ExpenseChartProps) {
  const [timePeriod, setTimePeriod] = useState("month");

  // Process data for the chart
  const expenseData = summary?.transactionsByCategory
    ?.filter(item => item.type === 'expense')
    ?.map((item, index) => ({
      name: item.categoryName,
      value: item.amount,
      color: `hsl(${(index * 137.5) % 360}, 70%, 50%)`, // Generate distinct colors
    })) || [];

  // Mock data if no real data available
  const mockData = [
    { name: 'Food', value: 55.50, color: '#3B82F6' },
    { name: 'Entertainment', value: 29.99, color: '#F59E0B' },
    { name: 'Housing', value: 245.00, color: '#10B981' },
  ];

  const chartData = expenseData.length > 0 ? expenseData : mockData;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-primary">{formatCurrency(data.value)}</p>
        </div>
      );
    }
    return null;
  };

  const calculatePercentage = (value: number) => {
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    return Math.round((value / total) * 100);
  };

  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Expense Distribution</CardTitle>
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="quarter">Last 3 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="w-full space-y-3 mt-4">
            {chartData.map((entry, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {entry.name}
                  </span>
                </div>
                <span className="text-sm font-medium">
                  {calculatePercentage(entry.value)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
