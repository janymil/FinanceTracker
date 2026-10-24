import AchievementsCard from "@/components/achievements-card";

import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Target, Plus, Calendar, DollarSign, TrendingUp, Crown, Edit2, Trash2, Copy } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import RequirePlan from "@/components/require-plan";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/context/CurrencyContext";

interface Goal {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  category: string;
  description?: string;
  createdAt: string;
}

interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: string;
}

export default function Goals() {
  const { isReady, user } = useClerkUserReady();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { currency } = useCurrency();
  const displayCurrency = currency || '$';
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [newGoal, setNewGoal] = useState({
    name: "",
    targetAmount: "",
    targetDate: "",
    category: "",
    description: ""
  });
  const [editGoal, setEditGoal] = useState({
    name: "",
    targetAmount: "",
    currentAmount: "",
    targetDate: "",
    category: "",
    description: ""
  });

  if (!user) {
    return null;
  }



  // Get auth headers for Clerk authentication
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    try {
      if (typeof window !== 'undefined' && window.Clerk?.session) {
        const token = await window.Clerk.session.getToken();
        if (token) {
          return { Authorization: `Bearer ${token}` };
        }
      }
    } catch (error) {
      console.warn('Failed to get Clerk token:', error);
    }
    return {};
  };

  // Fetch goals
  const fetchGoals = async () => {
    if (!isReady) return;
    
    setIsLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/goals', {
        headers: authHeaders,
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setGoals(data);
      } else {
        console.error('Failed to fetch goals:', response.status);
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch categories
  const fetchCategories = async () => {
    if (!isReady) return;
    
    setCategoriesLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/categories', {
        headers: authHeaders,
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        // Filter only goal categories
        const goalCategories = data.filter((cat: Category) => cat.type === 'goal');
        setCategories(goalCategories);
      } else {
        console.error('Failed to fetch categories:', response.status);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setCategoriesLoading(false);
    }
  };

  useEffect(() => {
    if (isReady) {
      fetchGoals();
      fetchCategories();
    }
  }, [isReady]);

  const createGoal = async (goalData: any) => {
    try {
      // Validate date before sending
      if (!goalData.targetDate || goalData.targetDate === '') {
        throw new Error(t('goals.errors.select_target_date'));
      }
      
      // Ensure date is in proper format
      const targetDate = new Date(goalData.targetDate);
      if (isNaN(targetDate.getTime())) {
        throw new Error(t('goals.errors.valid_target_date'));
      }
      
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        credentials: 'include',
        body: JSON.stringify({
          ...goalData,
          targetDate: targetDate.toISOString()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('goals.errors.failed_create'));
      }
      
      await fetchGoals(); // Refresh goals
      setIsDialogOpen(false);
      setNewGoal({ name: "", targetAmount: "", targetDate: "", category: "", description: "" });
      toast({
        title: t('goals.toasts.goal_created'),
        description: t('goals.toasts.goal_created_desc'),
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateGoal = async ({ id, data }: { id: number; data: any }) => {
    try {
      // Validate date if provided
      if (data.targetDate) {
        const targetDate = new Date(data.targetDate);
        if (isNaN(targetDate.getTime())) {
          throw new Error(t('goals.errors.valid_target_date'));
        }
        data.targetDate = targetDate.toISOString();
      }
      
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/goals/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('goals.errors.failed_update'));
      }
      
      await fetchGoals(); // Refresh goals
      setIsEditDialogOpen(false);
      setEditingGoal(null);
      toast({
        title: t('goals.toasts.goal_updated'),
        description: t('goals.toasts.goal_updated_desc'),
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteGoal = async (id: number) => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/goals/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('goals.errors.failed_delete'));
      }
      
      await fetchGoals(); // Refresh goals
      toast({
        title: t('goals.toasts.goal_deleted'),
        description: t('goals.toasts.goal_deleted_desc'),
      });
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const duplicateGoal = async (goal: Goal) => {
    try {
      const duplicateData = {
        name: `${goal.name} (${t('goals.copy')})`,
        targetAmount: goal.targetAmount,
        targetDate: goal.targetDate,
        category: goal.category,
        description: goal.description,
      };
      
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        credentials: 'include',
        body: JSON.stringify(duplicateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('goals.errors.failed_duplicate'));
      }
      
      await fetchGoals(); // Refresh goals
      toast({
        title: t('goals.toasts.goal_duplicated'),
        description: t('goals.toasts.goal_duplicated_desc'),
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateGoal = () => {
    createGoal({
      name: newGoal.name,
      targetAmount: parseFloat(newGoal.targetAmount),
      targetDate: newGoal.targetDate,
      category: newGoal.category,
      description: newGoal.description,
    });
  };

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setEditGoal({
      name: goal.name,
      targetAmount: goal.targetAmount.toString(),
      currentAmount: goal.currentAmount.toString(),
      targetDate: goal.targetDate.split('T')[0], // Format date for input
      category: goal.category,
      description: goal.description || ""
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateGoal = () => {
    if (!editingGoal) return;
    
    updateGoal({
      id: editingGoal.id,
      data: {
        name: editGoal.name,
        targetAmount: parseFloat(editGoal.targetAmount),
        currentAmount: parseFloat(editGoal.currentAmount),
        targetDate: editGoal.targetDate,
        category: editGoal.category,
        description: editGoal.description,
      }
    });
  };

  const handleDeleteGoal = (id: number) => {
    deleteGoal(id);
  };

  const handleDuplicateGoal = (goal: Goal) => {
    duplicateGoal(goal);
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getGoalStatus = (current: number, target: number, targetDate: string) => {
    const progress = (current / target) * 100;
    const daysLeft = Math.ceil((new Date(targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    if (progress >= 100) return { status: t('goals.status.completed'), color: "bg-green-500", textColor: "text-green-600" };
    if (daysLeft < 0) return { status: t('goals.status.overdue'), color: "bg-red-500", textColor: "text-red-600" };
    if (progress >= 75) return { status: t('goals.status.on_track'), color: "bg-blue-500", textColor: "text-blue-600" };
    if (progress >= 50) return { status: t('goals.status.in_progress'), color: "bg-yellow-500", textColor: "text-yellow-600" };
    return { status: t('goals.status.just_started'), color: "bg-gray-500", textColor: "text-gray-600" };
  };

  return (
    <RequirePlan plan="standard">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {t('goals.title')}
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                {t('goals.subtitle')}
              </p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('goals.create_goal')}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{t('goals.create_new_goal')}</DialogTitle>
                  <DialogDescription>
                    {t('goals.create_goal_desc')}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">{t('goals.form.goal_name')}</Label>
                    <Input
                      id="name"
                      placeholder={t('goals.form.goal_name_placeholder')}
                      value={newGoal.name}
                      onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="amount">{t('goals.form.target_amount', { currency: displayCurrency })}</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="10000"
                      value={newGoal.targetAmount}
                      onChange={(e) => setNewGoal({ ...newGoal, targetAmount: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="date">{t('goals.form.target_date')}</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newGoal.targetDate}
                      onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="category">{t('goals.form.category')}</Label>
                    <Select value={newGoal.category} onValueChange={(value) => setNewGoal({ ...newGoal, category: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('goals.form.select_category')} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.name.toLowerCase().replace(/\s+/g, '_')}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">{t('goals.form.description_optional')}</Label>
                    <Input
                      id="description"
                      placeholder={t('goals.form.description_placeholder')}
                      value={newGoal.description}
                      onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button onClick={handleCreateGoal}>
                    {t('goals.create_goal')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Goal Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>{t('goals.edit_goal')}</DialogTitle>
                  <DialogDescription>
                    {t('goals.edit_goal_desc')}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-1">
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-name">{t('goals.form.goal_name')}</Label>
                      <Input
                        id="edit-name"
                        placeholder={t('goals.form.goal_name_placeholder')}
                        value={editGoal.name}
                        onChange={(e) => setEditGoal({ ...editGoal, name: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-amount">{t('goals.form.target_amount', { currency: displayCurrency })}</Label>
                      <Input
                        id="edit-amount"
                        type="number"
                        placeholder="10000"
                        value={editGoal.targetAmount}
                        onChange={(e) => setEditGoal({ ...editGoal, targetAmount: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-current">{t('goals.form.current_amount', { currency: displayCurrency })}</Label>
                      <Input
                        id="edit-current"
                        type="number"
                        placeholder="5000"
                        value={editGoal.currentAmount}
                        onChange={(e) => setEditGoal({ ...editGoal, currentAmount: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-date">{t('goals.form.target_date')}</Label>
                      <Input
                        id="edit-date"
                        type="date"
                        value={editGoal.targetDate}
                        onChange={(e) => setEditGoal({ ...editGoal, targetDate: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-category">{t('goals.form.category')}</Label>
                      <Select value={editGoal.category} onValueChange={(value) => setEditGoal({ ...editGoal, category: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('goals.form.select_category')} />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.name.toLowerCase().replace(/\s+/g, '_')}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-description">{t('goals.form.description_optional')}</Label>
                      <Input
                        id="edit-description"
                        placeholder={t('goals.form.description_placeholder')}
                        value={editGoal.description}
                        onChange={(e) => setEditGoal({ ...editGoal, description: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button onClick={handleUpdateGoal}>
                    {t('goals.update_goal')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Goals Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : goals.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {t('goals.empty.no_goals_yet')}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {t('goals.empty.create_first_goal')}
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('goals.empty.create_first_goal_button')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {goals.map((goal: Goal) => {
              const progress = getProgressPercentage(goal.currentAmount, goal.targetAmount);
              const status = getGoalStatus(goal.currentAmount, goal.targetAmount, goal.targetDate);
              const daysLeft = Math.ceil((new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

              return (
                <Card key={goal.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{goal.name}</CardTitle>
                      <Badge variant="outline" className={status.textColor}>
                        {status.status}
                      </Badge>
                    </div>
                    {goal.category && (
                      <div className="mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {(() => {
                            // Get current language from URL
                            const currentLang = window.location.pathname.split('/')[1]; // es, sk, en
                            const langCode = currentLang === 'es' ? 'es-pe' : currentLang === 'sk' ? 'sk-sk' : 'en-us';
                            
                            // Complete translation mapping from server categoryTranslations.ts
                            const translations: Record<string, Record<string, string>> = {
                              // Original category names
                              'Emergency Fund': { 'en-us': 'Emergency Fund', 'es-pe': 'Fondo de emergencia', 'sk-sk': 'Núdzový fond' },
                              'Vacation': { 'en-us': 'Vacation', 'es-pe': 'Vacaciones', 'sk-sk': 'Dovolenka' },
                              'House Down Payment': { 'en-us': 'House Down Payment', 'es-pe': 'Pago inicial de casa', 'sk-sk': 'Záloha na dom' },
                              'Car Purchase': { 'en-us': 'Car Purchase', 'es-pe': 'Compra de auto', 'sk-sk': 'Kúpa auta' },
                              'Debt Payoff': { 'en-us': 'Debt Payoff', 'es-pe': 'Pago de deudas', 'sk-sk': 'Splácanie dlhov' },
                              'Retirement': { 'en-us': 'Retirement', 'es-pe': 'Jubilación', 'sk-sk': 'Dôchodok' },
                              'Other': { 'en-us': 'Other', 'es-pe': 'Otro', 'sk-sk': 'Iné' },
                              // Database values (processed category names from dropdown)
                              'fondo_de_emergencia': { 'en-us': 'Emergency Fund', 'es-pe': 'Fondo de emergencia', 'sk-sk': 'Núdzový fond' },
                              'emergency_fund': { 'en-us': 'Emergency Fund', 'es-pe': 'Fondo de emergencia', 'sk-sk': 'Núdzový fond' },
                              'núdzový_fond': { 'en-us': 'Emergency Fund', 'es-pe': 'Fondo de emergencia', 'sk-sk': 'Núdzový fond' },
                              'vacation': { 'en-us': 'Vacation', 'es-pe': 'Vacaciones', 'sk-sk': 'Dovolenka' },
                              'vacaciones': { 'en-us': 'Vacation', 'es-pe': 'Vacaciones', 'sk-sk': 'Dovolenka' },
                              'dovolenka': { 'en-us': 'Vacation', 'es-pe': 'Vacaciones', 'sk-sk': 'Dovolenka' },
                              'house_down_payment': { 'en-us': 'House Down Payment', 'es-pe': 'Pago inicial de casa', 'sk-sk': 'Záloha na dom' },
                              'pago_inicial_de_casa': { 'en-us': 'House Down Payment', 'es-pe': 'Pago inicial de casa', 'sk-sk': 'Záloha na dom' },
                              'záloha_na_dom': { 'en-us': 'House Down Payment', 'es-pe': 'Pago inicial de casa', 'sk-sk': 'Záloha na dom' },
                              'car_purchase': { 'en-us': 'Car Purchase', 'es-pe': 'Compra de auto', 'sk-sk': 'Kúpa auta' },
                              'compra_de_auto': { 'en-us': 'Car Purchase', 'es-pe': 'Compra de auto', 'sk-sk': 'Kúpa auta' },
                              'kúpa_auta': { 'en-us': 'Car Purchase', 'es-pe': 'Compra de auto', 'sk-sk': 'Kúpa auta' },
                              'debt_payoff': { 'en-us': 'Debt Payoff', 'es-pe': 'Pago de deudas', 'sk-sk': 'Splácanie dlhov' },
                              'pago_de_deudas': { 'en-us': 'Debt Payoff', 'es-pe': 'Pago de deudas', 'sk-sk': 'Splácanie dlhov' },
                              'splácanie_dlhov': { 'en-us': 'Debt Payoff', 'es-pe': 'Pago de deudas', 'sk-sk': 'Splácanie dlhov' },
                              'retirement': { 'en-us': 'Retirement', 'es-pe': 'Jubilación', 'sk-sk': 'Dôchodok' },
                              'jubilación': { 'en-us': 'Retirement', 'es-pe': 'Jubilación', 'sk-sk': 'Dôchodok' },
                              'dôchodok': { 'en-us': 'Retirement', 'es-pe': 'Jubilación', 'sk-sk': 'Dôchodok' },
                              'other': { 'en-us': 'Other', 'es-pe': 'Otro', 'sk-sk': 'Iné' },
                              'otro': { 'en-us': 'Other', 'es-pe': 'Otro', 'sk-sk': 'Iné' },
                              'iné': { 'en-us': 'Other', 'es-pe': 'Otro', 'sk-sk': 'Iné' },
                              // Additional collaborative goal categories
                              'Wedding': { 'en-us': 'Wedding', 'es-pe': 'Boda', 'sk-sk': 'Svadba' },
                              'wedding': { 'en-us': 'Wedding', 'es-pe': 'Boda', 'sk-sk': 'Svadba' },
                              'boda': { 'en-us': 'Wedding', 'es-pe': 'Boda', 'sk-sk': 'Svadba' },
                              'svadba': { 'en-us': 'Wedding', 'es-pe': 'Boda', 'sk-sk': 'Svadba' },
                              'Home': { 'en-us': 'Home', 'es-pe': 'Casa', 'sk-sk': 'Dom' },
                              'home': { 'en-us': 'Home', 'es-pe': 'Casa', 'sk-sk': 'Dom' },
                              'casa': { 'en-us': 'Home', 'es-pe': 'Casa', 'sk-sk': 'Dom' },
                              'dom': { 'en-us': 'Home', 'es-pe': 'Casa', 'sk-sk': 'Dom' },
                              'Education': { 'en-us': 'Education', 'es-pe': 'Educación', 'sk-sk': 'Vzdelanie' },
                              'education': { 'en-us': 'Education', 'es-pe': 'Educación', 'sk-sk': 'Vzdelanie' },
                              'educación': { 'en-us': 'Education', 'es-pe': 'Educación', 'sk-sk': 'Vzdelanie' },
                              'vzdelanie': { 'en-us': 'Education', 'es-pe': 'Educación', 'sk-sk': 'Vzdelanie' },
                              'Emergency': { 'en-us': 'Emergency', 'es-pe': 'Emergencia', 'sk-sk': 'Núdzové' },
                              'emergency': { 'en-us': 'Emergency', 'es-pe': 'Emergencia', 'sk-sk': 'Núdzové' },
                              'emergencia': { 'en-us': 'Emergency', 'es-pe': 'Emergencia', 'sk-sk': 'Núdzové' },
                              'núdzové': { 'en-us': 'Emergency', 'es-pe': 'Emergencia', 'sk-sk': 'Núdzové' },
                              'Investment': { 'en-us': 'Investment', 'es-pe': 'Inversión', 'sk-sk': 'Investícia' },
                              'investment': { 'en-us': 'Investment', 'es-pe': 'Inversión', 'sk-sk': 'Investícia' },
                              'inversión': { 'en-us': 'Investment', 'es-pe': 'Inversión', 'sk-sk': 'Investícia' },
                              'investícia': { 'en-us': 'Investment', 'es-pe': 'Inversión', 'sk-sk': 'Investícia' }
                            };
                            
                            const translation = translations[goal.category];
                            if (translation && translation[langCode]) {
                              return translation[langCode];
                            }
                            
                            return goal.category;
                          })()}
                        </Badge>
                      </div>
                    )}
                    <CardDescription>{goal.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600 dark:text-gray-300">{t('goals.card.progress')}</span>
                          <span className="text-sm font-medium">{progress.toFixed(1)}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>

                      {/* Amount Progress */}
                      <div className="flex items-center justify-between">
                        <div className="text-center">
                          <p className="text-sm text-gray-600 dark:text-gray-300">{t('goals.card.current')}</p>
                          <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                            {displayCurrency}{goal.currentAmount.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-600 dark:text-gray-300">{t('goals.card.target')}</p>
                          <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                            {displayCurrency}{goal.targetAmount.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Time Left */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <Calendar className="h-4 w-4 mr-1" />
                          {daysLeft > 0 ? t('goals.card.days_left', { days: daysLeft }) : daysLeft === 0 ? t('goals.card.due_today') : t('goals.card.days_overdue', { days: Math.abs(daysLeft) })}
                        </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <DollarSign className="h-4 w-4 mr-1" />
                          {t('goals.card.amount_left', { amount: `${displayCurrency}${(goal.targetAmount - goal.currentAmount).toLocaleString()}` })}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex space-x-2 pt-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => handleEditGoal(goal)}
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          {t('goals.buttons.edit')}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleDuplicateGoal(goal)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button aria-label={t('a11y.delete')} size="sm" variant="outline">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('goals.delete.title')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('goals.delete.description', { name: goal.name })}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteGoal(goal.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                {t('goals.delete.confirm')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <AchievementsCard className="mt-6" />
      </div>
    </RequirePlan>
  );
}