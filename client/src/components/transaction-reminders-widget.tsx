import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Bell, 
  Clock, 
  Calendar,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Repeat,
  Crown,
  Plus,
  CheckCircle,
  Trash2,
  User,
  Zap
} from "lucide-react";
import { format, isToday, isTomorrow, isWithinInterval, addDays } from "date-fns";
import RequirePlan from "@/components/require-plan";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

interface ExpenseReminder {
  id: number;
  title: string;
  description?: string;
  amount?: string;
  dueDate: string;
  isRecurring: boolean;
  recurringFrequency?: string;
  recurringEndDate?: string;
  reminderDaysBefore: number;
  isActive: boolean;
  isCompleted: boolean;
  categoryId?: number;
  paymentUrl?: string;
  referenceNote?: string;
}

interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: "income" | "expense";
}

interface UnifiedReminder {
  id: string;
  title: string;
  description: string;
  amount?: string;
  dueDate: Date;
  type: 'income' | 'expense';
  categoryName?: string;
  isRecurring: boolean;
  source: 'automatic' | 'manual';
  priority: 'high' | 'medium' | 'low' | 'normal';
  canEdit?: boolean;
  canComplete?: boolean;
  paymentUrl?: string;
  referenceNote?: string;
}

export default function TransactionRemindersWidget() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newReminder, setNewReminder] = useState({
    title: "",
    description: "",
    amount: "",
    dueDate: new Date().toISOString().split('T')[0],
    isRecurring: false,
    recurringFrequency: "monthly" as "weekly" | "monthly" | "yearly",
    recurringEndDate: "",
    reminderDaysBefore: 1,
    categoryId: "",
    paymentUrl: "",
    referenceNote: "",
  });

  // Fetch automatic transaction reminders
  const { data: transactionReminders = [], isLoading: transactionLoading } = useQuery<TransactionReminder[]>({
    queryKey: ["/api/transaction-reminders", { days: 30 }],
    enabled: true,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Fetch manual expense reminders
  const { data: expenseReminders = [], isLoading: expenseLoading } = useQuery<ExpenseReminder[]>({
    queryKey: ["/api/expense-reminders/upcoming"],
    enabled: true,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
  });

  const getReminderPriority = (dueDate: Date): 'high' | 'medium' | 'low' | 'normal' => {
    const today = new Date();

    if (isToday(dueDate)) return "high";
    if (isTomorrow(dueDate)) return "medium";
    if (isWithinInterval(dueDate, { start: today, end: addDays(today, 7) })) return "low";
    return "normal";
  };

  // Combine both reminder types into unified list
  const unifiedReminders: UnifiedReminder[] = [
    // Automatic transaction reminders
    ...(Array.isArray(transactionReminders) ? transactionReminders.map(reminder => ({
      id: `auto_${reminder.id}`,
      title: reminder.title,
      description: reminder.description,
      amount: reminder.amount,
      dueDate: new Date(reminder.dueDate),
      type: reminder.type,
      categoryName: reminder.categoryName,
      isRecurring: reminder.isRecurring,
      source: 'automatic' as const,
      priority: getReminderPriority(new Date(reminder.dueDate)),
      canEdit: false,
      canComplete: false,
    })) : []),
    // Manual expense reminders
    ...(Array.isArray(expenseReminders) ? expenseReminders.map(reminder => ({
      id: `manual_${reminder.id}`,
      title: reminder.title,
      description: reminder.description || '',
      amount: reminder.amount,
      dueDate: new Date(reminder.dueDate),
      type: 'expense' as const,
      categoryName: 'Custom Reminder',
      isRecurring: reminder.isRecurring,
      source: 'manual' as const,
      priority: getReminderPriority(new Date(reminder.dueDate)),
      canEdit: true,
      canComplete: true,
      paymentUrl: reminder.paymentUrl,
      referenceNote: reminder.referenceNote,
    })) : [])
  ].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const createReminder = async (reminderData: any) => {
    try {
      await apiRequest('POST', '/api/expense-reminders', reminderData);
      await queryClient.invalidateQueries({ queryKey: ["/api/expense-reminders"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/expense-reminders/upcoming"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Reminder Created",
        description: "Payment reminder has been set successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create reminder",
        variant: "destructive",
      });
    }
  };

  const completeReminder = async (id: number) => {
    try {
      await apiRequest('PUT', `/api/expense-reminders/${id}`, { isCompleted: true });
      await queryClient.invalidateQueries({ queryKey: ["/api/expense-reminders"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/expense-reminders/upcoming"] });
      toast({
        title: "Reminder Completed",
        description: "Reminder marked as completed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to complete reminder",
        variant: "destructive",
      });
    }
  };

  const deleteReminder = async (id: number) => {
    try {
      await apiRequest('DELETE', `/api/expense-reminders/${id}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/expense-reminders"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/expense-reminders/upcoming"] });
      toast({
        title: "Reminder Deleted",
        description: "Reminder has been removed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete reminder",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setNewReminder({
      title: "",
      description: "",
      amount: "",
      dueDate: new Date().toISOString().split('T')[0],
      isRecurring: false,
      recurringFrequency: "monthly",
      recurringEndDate: "",
      reminderDaysBefore: 1,
      categoryId: "",
      paymentUrl: "",
      referenceNote: "",
    });
  };

  const handleSubmit = () => {
    if (!newReminder.title || !newReminder.dueDate) return;
    createReminder(newReminder);
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