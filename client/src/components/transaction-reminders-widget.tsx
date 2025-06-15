import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, 
  Clock, 
  Calendar,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Repeat,
  Crown
} from "lucide-react";
import { format, isToday, isTomorrow, isWithinInterval, addDays } from "date-fns";
import RequirePlan from "@/components/require-plan";

interface TransactionReminder {
  id: string;
  title: string;
  description: string;
  amount: string;
  dueDate: Date;
  type: 'income' | 'expense';
  categoryName: string;
  isRecurring: boolean;
  source: 'future_transaction' | 'recurring_transaction';
}

export default function TransactionRemindersWidget() {
  const { data: reminders = [], isLoading, error } = useQuery<TransactionReminder[]>({
    queryKey: ["/api/transaction-reminders", { days: 30 }],
    queryFn: () => fetch("/api/transaction-reminders?days=30").then(res => res.json()),
    enabled: true,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const getReminderPriority = (reminder: TransactionReminder) => {
    const dueDate = new Date(reminder.dueDate);
    const today = new Date();

    if (isToday(dueDate)) return "high";
    if (isTomorrow(dueDate)) return "medium";
    if (isWithinInterval(dueDate, { start: today, end: addDays(today, 7) })) return "low";
    return "normal";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "text-red-600 bg-red-100 dark:bg-red-900/20";
      case "medium": return "text-orange-600 bg-orange-100 dark:bg-orange-900/20";
      case "low": return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20";
      default: return "text-blue-600 bg-blue-100 dark:bg-blue-900/20";
    }
  };

  const getTypeIcon = (type: 'income' | 'expense') => {
    return type === 'income' ? TrendingUp : TrendingDown;
  };

  const getTypeColor = (type: 'income' | 'expense') => {
    return type === 'income' 
      ? "text-green-600 bg-green-100 dark:bg-green-900/20" 
      : "text-red-600 bg-red-100 dark:bg-red-900/20";
  };

  if (isLoading) {
    return (
      <RequirePlan plan="standard">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Upcoming Transactions
                  <Badge className="bg-blue-600 text-white">
                    <Crown className="h-3 w-3 mr-1" />
                    Standard+
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Automatic reminders from your future and recurring transactions
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </RequirePlan>
    );
  }

  // Handle API not implemented yet
  if (error) {
    return (
      <RequirePlan plan="standard">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Upcoming Transactions
                  <Badge className="bg-blue-600 text-white">
                    <Crown className="h-3 w-3 mr-1" />
                    Standard+
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Automatic reminders from your future and recurring transactions
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-300">Error loading transactions</p>
            </div>
          </CardContent>
        </Card>
      </RequirePlan>
    );
  }

  return (
    <RequirePlan plan="standard">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Upcoming Transactions
                <Badge className="bg-blue-600 text-white">
                  <Crown className="h-3 w-3 mr-1" />
                  Standard+
                </Badge>
              </CardTitle>
              <CardDescription>
                Automatic reminders from your future and recurring transactions
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {reminders.length > 0 ? (
            <div className="space-y-3">
              {reminders.slice(0, 6).map((reminder) => {
                const priority = getReminderPriority(reminder);
                const priorityColor = getPriorityColor(priority);
                const TypeIcon = getTypeIcon(reminder.type);
                const typeColor = getTypeColor(reminder.type);

                return (
                  <div key={reminder.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${priorityColor}`}>
                        {priority === "high" ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-medium text-sm">{reminder.title}</h5>
                          {reminder.isRecurring && (
                            <Badge variant="outline" className="text-xs">
                              <Repeat className="h-3 w-3 mr-1" />
                              Recurring
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                          <span>Due: {format(new Date(reminder.dueDate), "MMM dd, yyyy")}</span>
                          <span>•</span>
                          <span>{reminder.categoryName}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{reminder.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded ${typeColor}`}>
                        <TypeIcon className="h-3 w-3" />
                      </div>
                      {reminder.amount && (
                        <Badge variant="outline" className="text-xs">
                          ${reminder.amount}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}

              {reminders.length > 6 && (
                <p className="text-xs text-gray-500 text-center">
                  +{reminders.length - 6} more upcoming transactions
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-300">No upcoming transactions</p>
              <p className="text-sm text-gray-500 mt-1">
                Create future-dated or recurring transactions to see reminders here
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </RequirePlan>
  );
}