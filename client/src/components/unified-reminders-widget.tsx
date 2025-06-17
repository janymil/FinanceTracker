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
    queryFn: () => fetch("/api/transaction-reminders?days=30").then(res => res.json()),
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

  // Combine and sort all reminders
  const unifiedReminders: UnifiedReminder[] = [
    // Transform transaction reminders
    ...transactionReminders.map(reminder => ({
      id: `auto_${reminder.id}`,
      title: reminder.title,
      description: reminder.description,
      amount: reminder.amount,
      dueDate: new Date(reminder.dueDate),
      type: reminder.type,
      categoryName: reminder.categoryName,
      isRecurring: reminder.isRecurring,
      source: 'automatic' as const,
      priority: getReminderPriority(new Date(reminder.dueDate)) as 'high' | 'medium' | 'low' | 'normal',
      canEdit: false,
      canComplete: false,
    })),
    // Transform expense reminders
    ...expenseReminders.map(reminder => ({
      id: `manual_${reminder.id}`,
      title: reminder.title,
      description: reminder.description || '',
      amount: reminder.amount,
      dueDate: new Date(reminder.dueDate),
      type: 'expense' as const,
      categoryName: 'Custom Reminder',
      isRecurring: reminder.isRecurring,
      source: 'manual' as const,
      priority: getReminderPriority(new Date(reminder.dueDate)) as 'high' | 'medium' | 'low' | 'normal',
      canEdit: true,
      canComplete: true,
      paymentUrl: reminder.paymentUrl,
      referenceNote: reminder.referenceNote,
    }))
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
        description: "Expense reminder has been set successfully",
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
                Upcoming Payments & Reminders
                <Badge className="bg-blue-600 text-white">
                  <Crown className="h-3 w-3 mr-1" />
                  Standard+
                </Badge>
              </CardTitle>
              <CardDescription>
                Automatic reminders from transactions and manual payment reminders
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Reminder
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingReminder ? "Edit Reminder" : "Create Payment Reminder"}
                  </DialogTitle>
                  <DialogDescription>
                    Set up a reminder for an upcoming expense, payment, or income
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={newReminder.title}
                      onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
                      placeholder="e.g., Rent payment, Insurance bill"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newReminder.description}
                      onChange={(e) => setNewReminder({ ...newReminder, description: e.target.value })}
                      placeholder="Additional notes about this payment"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="amount">Amount</Label>
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
                      <Label htmlFor="dueDate">Due Date *</Label>
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
                      <Label htmlFor="category">Category</Label>
                      <Select 
                        value={newReminder.categoryId} 
                        onValueChange={(value) => setNewReminder({ ...newReminder, categoryId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {allCategories.map((category: Category) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              {category.name} ({category.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="reminderDays">Remind me</Label>
                      <Select 
                        value={newReminder.reminderDaysBefore.toString()} 
                        onValueChange={(value) => setNewReminder({ ...newReminder, reminderDaysBefore: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">On due date</SelectItem>
                          <SelectItem value="1">1 day before</SelectItem>
                          <SelectItem value="3">3 days before</SelectItem>
                          <SelectItem value="7">1 week before</SelectItem>
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
                        Recurring reminder
                      </label>
                    </div>

                    {newReminder.isRecurring && (
                      <div className="grid grid-cols-2 gap-4 pl-6">
                        <div>
                          <Label htmlFor="frequency">Frequency</Label>
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
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="yearly">Yearly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="endDate">End Date</Label>
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
                      <Label htmlFor="paymentUrl">Payment URL</Label>
                      <Input
                        id="paymentUrl"
                        value={newReminder.paymentUrl}
                        onChange={(e) => setNewReminder({ ...newReminder, paymentUrl: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="referenceNote">Reference Note</Label>
                      <Input
                        id="referenceNote"
                        value={newReminder.referenceNote}
                        onChange={(e) => setNewReminder({ ...newReminder, referenceNote: e.target.value })}
                        placeholder="Account number, reference ID, etc."
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSubmit}
                      disabled={!newReminder.title || !newReminder.dueDate}
                      className="flex-1"
                    >
                      {editingReminder ? "Update" : "Create"} Reminder
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
                            {reminder.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300">{reminder.description}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                          <Calendar className="h-3 w-3" />
                          {format(reminder.dueDate, 'MMM dd, yyyy')}
                          {reminder.categoryName && (
                            <>
                              <span>•</span>
                              <span>{reminder.categoryName}</span>
                            </>
                          )}
                          <span>•</span>
                          <span className={reminder.source === 'automatic' ? 'text-blue-600' : 'text-purple-600'}>
                            {reminder.source === 'automatic' ? 'Auto' : 'Manual'}
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