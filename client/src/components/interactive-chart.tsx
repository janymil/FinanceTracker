import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Download, 
  TrendingUp, 
  Info,
  Crown 
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Area,
  AreaChart
} from "recharts";
import { useCurrency } from "@/context/CurrencyContext";

interface ChartData {
  date: string;
  income: number;
  expenses: number;
  balance: number;
  category?: string;
  amount?: number;
}

interface InteractiveChartProps {
  data: ChartData[];
  chartType: "line" | "bar" | "area" | "pie";
  title: string;
  description?: string;
  onExport?: () => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const CustomTooltip = ({ active, payload, label, currencySymbol }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{`Date: ${label}`}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {`${entry.dataKey}: ${currencySymbol}${entry.value?.toLocaleString()}`}
          </p>
        ))}
        {payload[0]?.payload?.balance && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
            Net Balance: {currencySymbol}{payload[0].payload.balance.toLocaleString()}
          </p>
        )}
      </div>
    );
  }
  return null;
};

const CustomPieTooltip = ({ active, payload, currencySymbol }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{data.payload.category}</p>
        <p className="text-sm" style={{ color: data.color }}>
          Amount: {currencySymbol}{data.value?.toLocaleString()}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Percentage: {((data.value / data.payload.total) * 100).toFixed(1)}%
        </p>
      </div>
    );
  }
  return null;
};

export default function InteractiveChart({ 
  data, 
  chartType, 
  title, 
  description,
  onExport 
}: InteractiveChartProps) {
  const { currency } = useCurrency();
  const chartRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [chartRange, setChartRange] = useState("all");
  const [hoveredData, setHoveredData] = useState<ChartData | null>(null);
  const [insights, setInsights] = useState<string[]>([]);

  // Generate insights based on data
  useEffect(() => {
    if (data && data.length > 0) {
      const newInsights = [];

      if (chartType === "line" || chartType === "area") {
        const totalIncome = data.reduce((sum, item) => sum + (item.income || 0), 0);
        const totalExpenses = data.reduce((sum, item) => sum + (item.expenses || 0), 0);
        const avgIncome = totalIncome / data.length;
        const avgExpenses = totalExpenses / data.length;

        if (avgIncome > avgExpenses) {
          newInsights.push("You're maintaining positive cash flow");
        }

        const trend = data.length > 1 ? 
          ((data[data.length - 1].balance || 0) - (data[0].balance || 0)) / data.length : 0;

        if (trend > 0) {
          newInsights.push("Your balance is trending upward");
        } else if (trend < 0) {
          newInsights.push("Your balance is declining - consider reviewing expenses");
        }
      }

      setInsights(newInsights);
    }
  }, [data, chartType]);

  const filteredData = React.useMemo(() => {
    if (chartRange === "all") return data;

    const now = new Date();
    const cutoffDate = new Date(now);

    switch (chartRange) {
      case "7d":
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case "90d":
        cutoffDate.setDate(now.getDate() - 90);
        break;
      default:
        return data;
    }

    return data.filter(item => new Date(item.date) >= cutoffDate);
  }, [data, chartRange]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.2, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.5));
  const handleReset = () => {
    setZoom(1);
    setChartRange("all");
  };

  const renderChart = () => {
    const commonProps = {
      data: filteredData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (chartType) {
      case "line":
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="date" 
              className="text-xs"
              tick={{ fontSize: 11 }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => `${currency}${(value / 1000).toFixed(0)}K`}
            />
            <Tooltip content={<CustomTooltip currencySymbol={currency} />} />
            <Line 
              type="monotone" 
              dataKey="income" 
              stroke="#10B981" 
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="expenses" 
              stroke="#EF4444" 
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        );

      case "area":
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip content={<CustomTooltip currencySymbol={currency} />} />
            <Area 
              type="monotone" 
              dataKey="income" 
              stackId="1"
              stroke="#10B981" 
              fill="#10B981"
              fillOpacity={0.6}
            />
            <Area 
              type="monotone" 
              dataKey="expenses" 
              stackId="1"
              stroke="#EF4444" 
              fill="#EF4444"
              fillOpacity={0.6}
            />
          </AreaChart>
        );

      case "bar":
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip content={<CustomTooltip currencySymbol={currency} />} />
            <Bar dataKey="income" fill="#10B981" />
            <Bar dataKey="expenses" fill="#EF4444" />
          </BarChart>
        );

      case "pie":
        return (
          <PieChart>
            <Pie
              data={filteredData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="amount"
            >
              {filteredData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomPieTooltip currencySymbol={currency} />} />
          </PieChart>
        );

      default:
        return (
          <div className="text-center text-gray-500">
            Chart type not supported
          </div>
        );
    }
  };





  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {title}
              <Badge className="bg-premium text-white">Pro</Badge>
            </CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>

          {/* Chart Controls */}
          <div className="flex items-center space-x-2">
            <Select value={chartRange} onValueChange={setChartRange}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="7d">7D</SelectItem>
                <SelectItem value="30d">30D</SelectItem>
                <SelectItem value="90d">90D</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-md">
              <Button variant="ghost" size="sm" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            {onExport && (
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Chart Container */}
        <div 
          ref={chartRef}
          className="w-full h-80 mb-4"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
        >
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>

        {/* Insights Panel */}
        {insights.length > 0 && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                AI Insights
              </h4>
            </div>
            <ul className="space-y-1">
              {insights.map((insight, index) => (
                <li key={index} className="text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2">
                  <TrendingUp className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Hovered Data Display */}
        {hoveredData && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Data Point Details
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-300">Date:</span>
                <span className="ml-2 font-medium">{hoveredData.date}</span>
              </div>
              {hoveredData.income && (
                <div>
                  <span className="text-gray-600 dark:text-gray-300">Income:</span>
                  <span className="ml-2 font-medium text-green-600">{currency}{hoveredData.income.toLocaleString()}</span>
                </div>
              )}
              {hoveredData.expenses && (
                <div>
                  <span className="text-gray-600 dark:text-gray-300">Expenses:</span>
                  <span className="ml-2 font-medium text-red-600">{currency}{hoveredData.expenses.toLocaleString()}</span>
                </div>
              )}
              {hoveredData.balance && (
                <div>
                  <span className="text-gray-600 dark:text-gray-300">Balance:</span>
                  <span className="ml-2 font-medium">{currency}{hoveredData.balance.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}