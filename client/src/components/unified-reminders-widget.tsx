import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from 'react-i18next';
import { 
  Bell, 
  Clock, 
  Calendar,
  Plus,
  CheckCircle,
  AlertTriangle,
  Trash2,
  Edit,
  Crown,
  ExternalLink,
  Copy,
  TrendingUp,
  TrendingDown,
  Repeat,
  User,
  Zap
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

export default function UnifiedRemindersWidget() {
  const { toast } = useToast();
  const { isReady, user } = useClerkUserReady();
  const { t } = useTranslation();
  
  // Helper function to translate category names using centralized system
  const getLocalizedCategoryName = (categoryName: string): string => {
    // Try to translate using the predefined category translation keys
    const translationKey = categoryName;
    const translated = t(translationKey);
    
    // If translation key exists (not same as key), return translated
    if (translated !== translationKey) {
      return translated;
    }
    
    // For custom categories or untranslatable ones, return original name
    return categoryName;
  };

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ExpenseReminder | null>(null);
  
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
    enabled: isReady && !!user?.id,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Fetch manual expense reminders
  const { data: expenseReminders = [], isLoading: expenseLoading } = useQuery<ExpenseReminder[]>({
    queryKey: ["/api/expense-reminders/upcoming"],
    enabled: isReady && !!user?.id,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    enabled: isReady && !!user?.id,
  });

  const getReminderPriority = (dueDate: Date): 'high' | 'medium' | 'low' | 'normal' => {
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
      ? "text-green-600 dark:text-green-400" 
      : "text-red-600 dark:text-red-400";
  };

  const getSourceIcon = (source: 'automatic' | 'manual') => {
    return source === 'automatic' ? Zap : User;
  };

  // Safely combine and sort all reminders
  const unifiedReminders: UnifiedReminder[] = [
    // Transform transaction reminders (only if it's an array)
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
    // Transform expense reminders (only if it's an array)
    ...(Array.isArray(expenseReminders) ? expenseReminders.map(reminder => ({
      id: `manual_${reminder.id}`,
      title: reminder.title,
      description: reminder.description || '',
      amount: reminder.amount,
      dueDate: new Date(reminder.dueDate),
      type: 'expense' as const,
      categoryName: t('upcomingReminders.customReminder'),
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
        title: t('upcomingReminders.reminderCreated'),
        description: t('upcomingReminders.reminderCreatedDescription'),
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('upcomingReminders.failedToCreate'),
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
        title: t('upcomingReminders.reminderCompleted'),
        description: t('upcomingReminders.reminderCompletedDescription'),
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('upcomingReminders.failedToComplete'),
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
        title: t('upcomingReminders.reminderDeleted'),
        description: t('upcomingReminders.reminderDeletedDescription'),
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('upcomingReminders.failedToDelete'),
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
    setEditingReminder(null);
  };

  const handleSubmit = () => {
    if (!newReminder.title || !newReminder.dueDate) return;
    createReminder(newReminder);
  };

  const allCategories = Array.isArray(categories) ? (categories as Category[]) : [];

  const isLoading = transactionLoading || expenseLoading;

  return (
    <RequirePlan plan="standard">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
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
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('upcomingReminders.addReminder')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingReminder ? t('upcomingReminders.editReminder') : t('upcomingReminders.createReminder')}
                  </DialogTitle>
                  <DialogDescription>
                    {t('upcomingReminders.reminderDescription')}
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
                              {getLocalizedCategoryName(category.name)} ({t(`types.${category.type}`)})
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
                          <SelectItem value="1">{t('upcomingReminders.form.dayBefore', { count: 1 })}</SelectItem>
                          <SelectItem value="3">{t('upcomingReminders.form.daysBefore', { count: 3 })}</SelectItem>
                          <SelectItem value="7">{t('upcomingReminders.form.weekBefore')}</SelectItem>
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
                              <SelectItem value="weekly">{t('recurring.weekly')}</SelectItem>
                              <SelectItem value="monthly">{t('recurring.monthly')}</SelectItem>
                              <SelectItem value="yearly">{t('recurring.yearly')}</SelectItem>
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

                  <div className="space-y-4 border-t pt-4">
                    <div>
                      <Label htmlFor="paymentUrl">{t('upcomingReminders.form.paymentUrl')}</Label>
                      <Input
                        id="paymentUrl"
                        value={newReminder.paymentUrl}
                        onChange={(e) => setNewReminder({ ...newReminder, paymentUrl: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="referenceNote">{t('upcomingReminders.form.referenceNote')}</Label>
                      <Input
                        id="referenceNote"
                        value={newReminder.referenceNote}
                        onChange={(e) => setNewReminder({ ...newReminder, referenceNote: e.target.value })}
                        placeholder={t('upcomingReminders.form.referenceNotePlaceholder')}
                      />
                    </div>
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
                      {editingReminder ? t('upcomingReminders.editReminder') : t('upcomingReminders.createReminder')}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            </div>
          ) : unifiedReminders.length > 0 ? (
            <div className="space-y-3">
              {unifiedReminders.slice(0, 8).map((reminder) => {
                const priorityColor = getPriorityColor(reminder.priority);
                const TypeIcon = getTypeIcon(reminder.type);
                const typeColor = getTypeColor(reminder.type);
                const SourceIcon = getSourceIcon(reminder.source);
                
                return (
                  <div key={reminder.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <TypeIcon className={`h-4 w-4 ${typeColor}`} />
                        <SourceIcon className={`h-3 w-3 ${reminder.source === 'automatic' ? 'text-blue-600' : 'text-purple-600'}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{reminder.title}</p>
                          {reminder.isRecurring && (
                            <Repeat className="h-3 w-3 text-gray-500" />
                          )}
                          <Badge className={`text-xs px-1 py-0.5 ${priorityColor}`}>
                            {t(`upcomingReminders.priority.${reminder.priority}`)}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300">{reminder.description}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                          <Calendar className="h-3 w-3" />
                          {format(reminder.dueDate, 'MMM dd, yyyy')}
                          {reminder.categoryName && (
                            <>
                              <span>•</span>
                              <span>{getLocalizedCategoryName(reminder.categoryName)}</span>
                            </>
                          )}
                          <span>•</span>
                          <span className={reminder.source === 'automatic' ? 'text-blue-600' : 'text-purple-600'}>
                            {reminder.source === 'automatic' ? t('common.auto') : t('common.manual')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {reminder.amount && (
                        <span className="text-sm font-medium">${reminder.amount}</span>
                      )}
                      {reminder.source === 'manual' && (
                        <div className="flex gap-1">
                          {reminder.canComplete && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => completeReminder(parseInt(reminder.id.split('_')[1]))}
                            >
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                          )}
                          {reminder.canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteReminder(parseInt(reminder.id.split('_')[1]))}
                            >
                              <Trash2 className="h-3 w-3" />
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
              <p className="text-gray-600 dark:text-gray-300">{t('upcomingReminders.noReminders')}</p>
              <p className="text-sm text-gray-500 mt-1">
                {t('upcomingReminders.noRemindersDescription')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </RequirePlan>
  );
}