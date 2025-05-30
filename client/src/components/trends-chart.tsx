import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function TrendsChart() {
  // Mock data for financial trends
  const trendData = [
    { month: 'Dec 2024', income: 0, expenses: 0, netBalance: 0 },
    { month: 'Jan 2025', income: 0, expenses: 0, netBalance: 0 },
    { month: 'Feb 2025', income: 0, expenses: 0, netBalance: 0 },
    { month: 'Mar 2025', income: 0, expenses: 0, netBalance: 0 },
    { month: 'Apr 2025', income: 2000, expenses: 150, netBalance: 1850 },
    { month: 'May 2025', income: 14000, expenses: 330, netBalance: 13670 },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
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

  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
              Financial Trends
            </CardTitle>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Evolution of your income, expenses and net balance over the last months
            </p>
          </div>
          <Badge className="bg-premium text-white">
            <Crown className="h-3 w-3 mr-1" />
            Premium
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
                name="Income"
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                stroke="hsl(var(--destructive))"
                strokeWidth={3}
                dot={{ fill: "hsl(var(--destructive))", strokeWidth: 2, r: 4 }}
                name="Expenses"
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="netBalance"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                name="Net Balance"
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
