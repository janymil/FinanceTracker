import { useState, useMemo, useCallback, useEffect } from "react";
import { useUser, useAuth } from "@clerk/clerk-react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { apiRequest } from "@/lib/queryClient";
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
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, isLoaded, isSignedIn } = useUser();
  const queryClient = useQueryClient();
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

  // Check if user is ready for API calls
  const isUserReady = isLoaded && isSignedIn && !!user?.id;

  // Use React Query for transaction reminders
  const { data: transactionReminders = [], isLoading: transactionLoading } = useQuery({
    queryKey: ['transaction-reminders', user?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/transaction-reminders?days=30');
      return response.json();
    },
    enabled: isUserReady,
    staleTime: 0,
    retry: 2,
  });

  // Use React Query for expense reminders
  const { data: expenseReminders = [], isLoading: expenseLoading } = useQuery({
    queryKey: ['expense-reminders', user?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/expense-reminders/upcoming');
      return response.json();
    },
    enabled: isUserReady,
    staleTime: 0,
    retry: 2,
  });

  // Use React Query for categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/categories');
      return response.json();
    },
    enabled: isUserReady,
    staleTime: 0,
    retry: 2,
  });



  const getReminderPriority = useCallback((dueDate: Date): 'high' | 'medium' | 'low' | 'normal' => {
    const today = new Date();

    if (isToday(dueDate)) return "high";
    if (isTomorrow(dueDate)) return "medium";
    if (isWithinInterval(dueDate, { start: today, end: addDays(today, 7) })) return "low";
    return "normal";
  }, []);

  // Combine both reminder types into unified list with memoization
  const unifiedReminders: UnifiedReminder[] = useMemo(() => {
    const automaticReminders = Array.isArray(transactionReminders) ? transactionReminders.map(reminder => ({
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
    })) : [];

    const manualReminders = Array.isArray(expenseReminders) ? expenseReminders.map(reminder => ({
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
    })) : [];

    return [...automaticReminders, ...manualReminders].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [transactionReminders, expenseReminders, getReminderPriority]);

  // Create reminder mutation
  const createReminderMutation = useMutation({
    mutationFn: async (reminderData: any) => {
      const response = await apiRequest('POST', '/api/expense-reminders', reminderData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-reminders', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['transaction-reminders', user?.id] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Reminder Created",
        description: "Payment reminder has been set successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create reminder",
        variant: "destructive",
      });
    },
  });

  // Complete reminder mutation
  const completeReminderMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('PUT', `/api/expense-reminders/${id}`, { isCompleted: true });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-reminders', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['transaction-reminders', user?.id] });
      toast({
        title: "Reminder Completed",
        description: "Reminder marked as completed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete reminder",
        variant: "destructive",
      });
    },
  });

  // Delete reminder mutation
  const deleteReminderMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/expense-reminders/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-reminders', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['transaction-reminders', user?.id] });
      toast({
        title: "Reminder Deleted",
        description: "Reminder has been removed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete reminder",
        variant: "destructive",
      });
    },
  });

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
    createReminderMutation.mutate(newReminder);
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
      ? "text-green-600 dark:text-green-400" 
      : "text-red-600 dark:text-red-400";
  };

  const getSourceIcon = (source: 'automatic' | 'manual') => {
    return source === 'automatic' ? Zap : User;
  };

  const formatReminderDescription = (reminder: UnifiedReminder) => {
    if (reminder.isRecurring && reminder.source === 'automatic') {
      // For recurring transactions, description contains frequency
      const frequency = reminder.description;
      const typeKey = reminder.type === 'expense' ? 'Recurring expense' : 'Recurring income';
      const frequencyKey = frequency === 'weekly' ? 'weekly' : frequency === 'monthly' ? 'monthly' : frequency;
      return `${t(typeKey)} (${t(frequencyKey)})`;
    }
    return reminder.description;
  };

  const getDateLocale = () => {
    const currentLang = i18n.language || 'en';
    if (currentLang.startsWith('es')) {
      return 'es-pe';
    } else if (currentLang.startsWith('sk')) {
      return 'sk-sk';
    } else {
      return 'en-us';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(getDateLocale(), {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const allCategories = Array.isArray(categories) ? (categories as Category[]) : [];
  const isLoading = transactionLoading || expenseLoading;

  if (isLoading) {
    return (
      <RequirePlan plan="standard">
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {t('upcomingReminders.title')}
                <Badge className="bg-blue-600 text-white">
                  <Crown className="h-3 w-3 mr-1" />
                  {t('plans.standard')}+
                </Badge>
              </CardTitle>
              <CardDescription>
                {t('upcomingReminders.description')}
              </CardDescription>
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

  return (
    <RequirePlan plan="standard">
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t('upcomingReminders.title')}
              <Badge className="bg-blue-600 text-white">
                <Crown className="h-3 w-3 mr-1" />
                {t('plans.standard')}+
              </Badge>
            </CardTitle>
            <CardDescription>
              {t('upcomingReminders.description')}
            </CardDescription>
          </div>
          <div className="mt-4">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={resetForm} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('upcomingReminders.addReminder')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{t('upcomingReminders.createReminder')}</DialogTitle>
                  <DialogDescription>
                    {t('upcomingReminders.description')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">{t('upcomingReminders.form.title')} *</Label>
                    <Input
                      id="title"
                      value={newReminder.title}
                      onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
                      placeholder={t('upcomingReminders.form.titlePlaceholder')}
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">{t('upcomingReminders.form.description')}</Label>
                    <Textarea
                      id="description"
                      value={newReminder.description}
                      onChange={(e) => setNewReminder({ ...newReminder, description: e.target.value })}
                      placeholder={t('upcomingReminders.form.descriptionPlaceholder')}
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="amount">{t('upcomingReminders.form.amount')}</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={newReminder.amount}
                        onChange={(e) => setNewReminder({ ...newReminder, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="dueDate">{t('upcomingReminders.form.dueDate')} *</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={newReminder.dueDate}
                        onChange={(e) => setNewReminder({ ...newReminder, dueDate: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="category">{t('upcomingReminders.form.category')}</Label>
                      <Select 
                        value={newReminder.categoryId} 
                        onValueChange={(value) => setNewReminder({ ...newReminder, categoryId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('upcomingReminders.form.selectCategory')} />
                        </SelectTrigger>
                        <SelectContent>
                          {allCategories.map((category: Category) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              {category.name} ({t(`types.${category.type}`)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="reminderDays">{t('upcomingReminders.form.remindMe')}</Label>
                      <Select 
                        value={newReminder.reminderDaysBefore.toString()} 
                        onValueChange={(value) => setNewReminder({ ...newReminder, reminderDaysBefore: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">{t('upcomingReminders.form.onDueDate')}</SelectItem>
                          <SelectItem value="1">{t('upcomingReminders.form.oneDayBefore')}</SelectItem>
                          <SelectItem value="3">{t('upcomingReminders.form.threeDaysBefore')}</SelectItem>
                          <SelectItem value="7">{t('upcomingReminders.form.oneWeekBefore')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="recurring"
                        checked={newReminder.isRecurring}
                        onCheckedChange={(checked) => 
                          setNewReminder({ ...newReminder, isRecurring: checked as boolean })
                        }
                      />
                      <label htmlFor="recurring" className="text-sm font-medium">
                        {t('upcomingReminders.form.recurringReminder')}
                      </label>
                    </div>

                    {newReminder.isRecurring && (
                      <div className="grid grid-cols-2 gap-4 pl-6">
                        <div>
                          <Label htmlFor="frequency">{t('upcomingReminders.form.frequency')}</Label>
                          <Select
                            value={newReminder.recurringFrequency}
                            onValueChange={(value) => setNewReminder({ 
                              ...newReminder, 
                              recurringFrequency: value as "weekly" | "monthly" | "yearly" 
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="weekly">{t('upcomingReminders.form.weekly')}</SelectItem>
                              <SelectItem value="monthly">{t('upcomingReminders.form.monthly')}</SelectItem>
                              <SelectItem value="yearly">{t('upcomingReminders.form.yearly')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="endDate">{t('upcomingReminders.form.endDate')}</Label>
                          <Input
                            id="endDate"
                            type="date"
                            value={newReminder.recurringEndDate}
                            onChange={(e) => setNewReminder({ 
                              ...newReminder,
                              recurringEndDate: e.target.value 
                            })}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                      {t('common.cancel')}
                    </Button>
                    <Button 
                      onClick={handleSubmit}
                      disabled={!newReminder.title || !newReminder.dueDate}
                      className="flex-1"
                    >
                      {t('upcomingReminders.createReminder')}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {unifiedReminders.length > 0 ? (
            <div className="space-y-3">
              {unifiedReminders.slice(0, 8).map((reminder) => {
                const priorityColor = getPriorityColor(reminder.priority);
                const TypeIcon = getTypeIcon(reminder.type);
                const typeColor = getTypeColor(reminder.type);
                const SourceIcon = getSourceIcon(reminder.source);

                return (
                  <div key={reminder.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border rounded-lg gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="flex items-center gap-1 shrink-0">
                        <TypeIcon className={`h-4 w-4 ${typeColor}`} />
                        <SourceIcon className={`h-3 w-3 ${reminder.source === 'automatic' ? 'text-blue-600' : 'text-purple-600'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm truncate">{reminder.title}</p>
                          {reminder.isRecurring && (
                            <Repeat className="h-3 w-3 text-gray-500 shrink-0" />
                          )}
                          <Badge className={`text-xs px-1 py-0.5 ${priorityColor} shrink-0`}>
                            {reminder.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{formatReminderDescription(reminder)}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 flex-wrap">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span className="shrink-0">{formatDate(reminder.dueDate)}</span>
                          {reminder.categoryName && (
                            <>
                              <span className="hidden sm:inline">•</span>
                              <span className="text-xs">{reminder.categoryName}</span>
                            </>
                          )}
                          <span className="hidden sm:inline">•</span>
                          <span className={`${reminder.source === 'automatic' ? 'text-blue-600' : 'text-purple-600'} text-xs`}>
                            {reminder.source === 'automatic' ? t('Auto') : t('Manual')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      {reminder.amount && (
                        <span className="text-sm font-medium">${parseFloat(reminder.amount).toFixed(2)}</span>
                      )}
                      {reminder.source === 'manual' && (
                        <div className="flex gap-1">
                          {reminder.canComplete && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => completeReminderMutation.mutate(parseInt(reminder.id.split('_')[1]))}
                              className="h-8 w-8 p-0"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {reminder.canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteReminderMutation.mutate(parseInt(reminder.id.split('_')[1]))}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {unifiedReminders.length > 8 && (
                <p className="text-xs text-gray-500 text-center">
                  +{unifiedReminders.length - 8} more reminders
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-300">No upcoming reminders</p>
              <p className="text-sm text-gray-500 mt-1">
                Create future-dated transactions or add manual reminders to see them here
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </RequirePlan>
  );
}