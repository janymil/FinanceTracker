import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
  Copy
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isTomorrow, isWithinInterval, addDays } from "date-fns";
import RequirePlan from "@/components/require-plan";

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

export default function FinancialRemindersWidget() {
  const { t } = useTranslation();
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

  const { data: reminders = [], isLoading } = useQuery<ExpenseReminder[]>({
    queryKey: ["/api/expense-reminders"],
    enabled: true,
  });

  const { data: upcomingReminders = [] } = useQuery<ExpenseReminder[]>({
    queryKey: ["/api/expense-reminders/upcoming"],
    enabled: true,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
  });

  const createReminder = async (reminderData: any) => {
    try {
      const response = await apiRequest('POST', '/api/expense-reminders', reminderData);
      await queryClient.invalidateQueries({ queryKey: ["/api/expense-reminders"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/expense-reminders/upcoming"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: t("expense_reminders.reminder_created"),
        description: t("expense_reminders.created_successfully"),
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const completeReminder = async (id: number) => {
    try {
      const response = await apiRequest('POST', `/api/expense-reminders/${id}/complete`);
      await queryClient.invalidateQueries({ queryKey: ["/api/expense-reminders"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/expense-reminders/upcoming"] });
      toast({
        title: t("expense_reminders.reminder_completed"),
        description: t("expense_reminders.completed_successfully"),
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteReminder = async (id: number) => {
    try {
      const response = await apiRequest('DELETE', `/api/expense-reminders/${id}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/expense-reminders"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/expense-reminders/upcoming"] });
      toast({
        title: t("expense_reminders.reminder_deleted"),
        description: t("expense_reminders.deleted_successfully"),
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
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

  const getReminderPriority = (reminder: ExpenseReminder) => {
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

  const allCategories = Array.isArray(categories) ? (categories as Category[]) : [];

  return (
    <RequirePlan plan="standard">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Expense Reminders
                <Badge className="bg-blue-600 text-white">
                  <Crown className="h-3 w-3 mr-1" />
                  Standard+
                </Badge>
              </CardTitle>
              <CardDescription>
                Never miss important payments, expenses, or upcoming income
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
                    {editingReminder ? t("expense_reminders.edit_reminder") : t("expense_reminders.create_reminder")}
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
                      placeholder={t("expense_reminders.placeholder_notes")}
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
                          <SelectValue placeholder={t("expense_reminders.select_category")} />
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

                  {/* Smart Bill Assistant Section */}
                  <div className="space-y-4 border-t pt-4">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Smart Bill Assistant
                    </div>
                    <div>
                      <Label htmlFor="paymentUrl">Payment URL (Optional)</Label>
                      <Input
                        id="paymentUrl"
                        type="url"
                        value={newReminder.paymentUrl}
                        onChange={(e) => setNewReminder({ ...newReminder, paymentUrl: e.target.value })}
                        placeholder="https://example.com/pay"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Link to where you can pay this bill
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="referenceNote">Reference Note (Optional)</Label>
                      <Input
                        id="referenceNote"
                        value={newReminder.referenceNote}
                        onChange={(e) => setNewReminder({ ...newReminder, referenceNote: e.target.value })}
                        placeholder="Account #123456, Reference: ABC789"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Account number or other reference information
                      </p>
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
                      {editingReminder ? t("expense_reminders.update_reminder") : t("expense_reminders.create_reminder_button")}
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
          ) : upcomingReminders.length > 0 ? (
            <div className="space-y-3">
              {upcomingReminders.slice(0, 5).map((reminder: ExpenseReminder) => {
                const priority = getReminderPriority(reminder);
                const priorityColor = getPriorityColor(priority);
                
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
                        <div className="flex items-center gap-2">
                          <h5 className="font-medium text-sm">{reminder.title}</h5>
                          {reminder.amount && (
                            <Badge variant="outline" className="text-xs">
                              ${reminder.amount}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300">
                          Due: {format(new Date(reminder.dueDate), "MMM dd, yyyy")}
                        </p>
                        {reminder.description && (
                          <p className="text-xs text-gray-500 mt-1">{reminder.description}</p>
                        )}
                        {/* Smart Bill Assistant Display */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {reminder.paymentUrl && (
                            <a 
                              href={reminder.paymentUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded-md transition-colors"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Pay Now
                            </a>
                          )}
                          {reminder.referenceNote && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(reminder.referenceNote || '');
                                toast({
                                  title: "Copied!",
                                  description: t("expense_reminders.copied_to_clipboard"),
                                });
                              }}
                              className="inline-flex items-center gap-1 text-xs bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded-md transition-colors"
                            >
                              <Copy className="h-3 w-3" />
                              Copy: {reminder.referenceNote}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => completeReminder(reminder.id)}
                      >
                        <CheckCircle className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteReminder(reminder.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              
              {upcomingReminders.length > 5 && (
                <p className="text-xs text-gray-500 text-center">
                  +{upcomingReminders.length - 5} more reminders
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-300">No upcoming expense reminders</p>
              <p className="text-sm text-gray-500 mt-1">
                Create reminders for important payments and expenses
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </RequirePlan>
  );
}