import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import RequirePlan from "@/components/require-plan";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  TrendingUp,
  TrendingDown,
  DollarSign,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface Transaction {
  id: number;
  amount: string;
  description: string;
  date: string;
  type: "income" | "expense";
  categoryId: number;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
}

interface DayData {
  date: Date;
  transactions: Transaction[];
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { isReady, user } = useClerkUserReady();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    enabled: isReady,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
  });

  // Process transactions for calendar view
  const processTransactionsForCalendar = (transactions: Transaction[], month: Date): DayData[] => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return days.map(date => {
      const dayTransactions = transactions.filter(transaction => 
        isSameDay(parseISO(transaction.date), date)
      );

      const totalIncome = dayTransactions
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      const totalExpenses = dayTransactions
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      return {
        date,
        transactions: dayTransactions,
        totalIncome,
        totalExpenses,
        netAmount: totalIncome - totalExpenses,
      };
    });
  };

  const calendarData = processTransactionsForCalendar(transactions as Transaction[], currentMonth);
  const selectedDayData = selectedDate ? calendarData.find(day => isSameDay(day.date, selectedDate)) : null;

  const monthlyTotals = calendarData.reduce(
    (acc, day) => ({
      income: acc.income + day.totalIncome,
      expenses: acc.expenses + day.totalExpenses,
      net: acc.net + day.netAmount,
    }),
    { income: 0, expenses: 0, net: 0 }
  );

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
    setSelectedDate(null);
  };

  const getDayClassName = (dayData: DayData) => {
    const baseClasses = "min-h-[100px] p-2 border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors";
    
    if (!isSameMonth(dayData.date, currentMonth)) {
      return cn(baseClasses, "text-gray-400 bg-gray-50 dark:bg-gray-900");
    }

    if (selectedDate && isSameDay(dayData.date, selectedDate)) {
      return cn(baseClasses, "bg-primary/10 border-primary");
    }

    if (dayData.transactions.length > 0) {
      return cn(baseClasses, "bg-blue-50 dark:bg-blue-900/20");
    }

    return baseClasses;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <RequirePlan plan="standard">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Calendar View</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              View your financial transactions in a calendar format
            </p>
          </div>
          
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            <CalendarIcon className="h-3 w-3 mr-1" />
            Standard Feature
          </Badge>
        </div>

        {/* Monthly Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Income</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(monthlyTotals.income)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(monthlyTotals.expenses)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Amount</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                monthlyTotals.net >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {formatCurrency(monthlyTotals.net)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">
                    {format(currentMonth, 'MMMM yyyy')}
                  </CardTitle>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateMonth('prev')}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateMonth('next')}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Calendar Header */}
                    <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="bg-gray-100 dark:bg-gray-800 p-3 text-center text-sm font-medium text-gray-900 dark:text-white">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                      {calendarData.map((dayData, index) => (
                        <div
                          key={index}
                          className={getDayClassName(dayData)}
                          onClick={() => setSelectedDate(dayData.date)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className={cn(
                              "text-sm font-medium",
                              !isSameMonth(dayData.date, currentMonth) && "text-gray-400"
                            )}>
                              {format(dayData.date, 'd')}
                            </span>
                            {dayData.transactions.length > 0 && (
                              <Badge variant="secondary" className="text-xs px-1 py-0">
                                {dayData.transactions.length}
                              </Badge>
                            )}
                          </div>

                          {dayData.transactions.length > 0 && (
                            <div className="space-y-1">
                              {dayData.totalIncome > 0 && (
                                <div className="flex items-center text-xs text-green-600">
                                  <Plus className="h-3 w-3 mr-1" />
                                  {formatCurrency(dayData.totalIncome)}
                                </div>
                              )}
                              {dayData.totalExpenses > 0 && (
                                <div className="flex items-center text-xs text-red-600">
                                  <Minus className="h-3 w-3 mr-1" />
                                  {formatCurrency(dayData.totalExpenses)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Selected Day Details */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a Date'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDate && selectedDayData ? (
                  <div className="space-y-4">
                    {selectedDayData.transactions.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">
                        No transactions on this date
                      </p>
                    ) : (
                      <>
                        {/* Day Summary */}
                        <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Income</p>
                            <p className="text-lg font-semibold text-green-600">
                              {formatCurrency(selectedDayData.totalIncome)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Expenses</p>
                            <p className="text-lg font-semibold text-red-600">
                              {formatCurrency(selectedDayData.totalExpenses)}
                            </p>
                          </div>
                        </div>

                        {/* Transactions List */}
                        <div className="space-y-3">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            Transactions ({selectedDayData.transactions.length})
                          </h4>
                          <div className="space-y-2 max-h-80 overflow-y-auto">
                            {selectedDayData.transactions.map(transaction => (
                              <div
                                key={transaction.id}
                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                              >
                                <div className="flex items-center space-x-3">
                                  <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-white text-sm",
                                    transaction.type === "income" ? "bg-green-500" : "bg-red-500"
                                  )}>
                                    {transaction.type === "income" ? "+" : "-"}
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm text-gray-900 dark:text-white">
                                      {transaction.description}
                                    </p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                      {transaction.categoryName}
                                    </p>
                                  </div>
                                </div>
                                <div className={cn(
                                  "font-semibold",
                                  transaction.type === "income" ? "text-green-600" : "text-red-600"
                                )}>
                                  {transaction.type === "income" ? "+" : "-"}
                                  {formatCurrency(parseFloat(transaction.amount))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    Click on a date to view transactions
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </RequirePlan>
  );
}