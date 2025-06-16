import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Target, Plus, Calendar, DollarSign, TrendingUp, Crown, Edit2, Trash2, Copy } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import RequirePlan from "@/components/require-plan";

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

export default function Goals() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
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

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ["/api/goals"],
    enabled: !!user,
  });

  const createGoalMutation = useMutation({
    mutationFn: async (goalData: any) => {
      const res = await apiRequest("POST", "/api/goals", goalData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      setIsDialogOpen(false);
      setNewGoal({ name: "", targetAmount: "", targetDate: "", category: "", description: "" });
      toast({
        title: "Goal Created",
        description: "Your financial goal has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/goals/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      setIsEditDialogOpen(false);
      setEditingGoal(null);
      toast({
        title: "Goal Updated",
        description: "Your financial goal has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/goals/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({
        title: "Goal Deleted",
        description: "Your financial goal has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const duplicateGoalMutation = useMutation({
    mutationFn: async (goal: Goal) => {
      const duplicateData = {
        name: `${goal.name} (Copy)`,
        targetAmount: goal.targetAmount,
        targetDate: goal.targetDate,
        category: goal.category,
        description: goal.description,
      };
      const res = await apiRequest("POST", "/api/goals", duplicateData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      toast({
        title: "Goal Duplicated",
        description: "Your financial goal has been duplicated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateGoal = () => {
    createGoalMutation.mutate({
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
    
    updateGoalMutation.mutate({
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
    deleteGoalMutation.mutate(id);
  };

  const handleDuplicateGoal = (goal: Goal) => {
    duplicateGoalMutation.mutate(goal);
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getGoalStatus = (current: number, target: number, targetDate: string) => {
    const progress = (current / target) * 100;
    const daysLeft = Math.ceil((new Date(targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    if (progress >= 100) return { status: "Completed", color: "bg-green-500", textColor: "text-green-600" };
    if (daysLeft < 0) return { status: "Overdue", color: "bg-red-500", textColor: "text-red-600" };
    if (progress >= 75) return { status: "On Track", color: "bg-blue-500", textColor: "text-blue-600" };
    if (progress >= 50) return { status: "In Progress", color: "bg-yellow-500", textColor: "text-yellow-600" };
    return { status: "Just Started", color: "bg-gray-500", textColor: "text-gray-600" };
  };

  return (
    <RequirePlan plan="standard">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Financial Goals
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Set and track your financial objectives with AI-powered insights
              </p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Goal
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create New Goal</DialogTitle>
                  <DialogDescription>
                    Set a new financial goal to track your progress towards your objectives.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Goal Name</Label>
                    <Input
                      id="name"
                      placeholder="Emergency Fund"
                      value={newGoal.name}
                      onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Target Amount ($)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="10000"
                      value={newGoal.targetAmount}
                      onChange={(e) => setNewGoal({ ...newGoal, targetAmount: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="date">Target Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newGoal.targetDate}
                      onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={newGoal.category} onValueChange={(value) => setNewGoal({ ...newGoal, category: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="emergency">Emergency Fund</SelectItem>
                        <SelectItem value="vacation">Vacation</SelectItem>
                        <SelectItem value="house">House Down Payment</SelectItem>
                        <SelectItem value="car">Car Purchase</SelectItem>
                        <SelectItem value="debt">Debt Payoff</SelectItem>
                        <SelectItem value="retirement">Retirement</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Input
                      id="description"
                      placeholder="Save for 6 months of expenses"
                      value={newGoal.description}
                      onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateGoal} disabled={createGoalMutation.isPending}>
                    {createGoalMutation.isPending ? "Creating..." : "Create Goal"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Goal Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Edit Goal</DialogTitle>
                  <DialogDescription>
                    Update your financial goal details and track your progress.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-name">Goal Name</Label>
                    <Input
                      id="edit-name"
                      placeholder="Emergency Fund"
                      value={editGoal.name}
                      onChange={(e) => setEditGoal({ ...editGoal, name: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-amount">Target Amount ($)</Label>
                    <Input
                      id="edit-amount"
                      type="number"
                      placeholder="10000"
                      value={editGoal.targetAmount}
                      onChange={(e) => setEditGoal({ ...editGoal, targetAmount: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-current">Current Amount ($)</Label>
                    <Input
                      id="edit-current"
                      type="number"
                      placeholder="5000"
                      value={editGoal.currentAmount}
                      onChange={(e) => setEditGoal({ ...editGoal, currentAmount: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-date">Target Date</Label>
                    <Input
                      id="edit-date"
                      type="date"
                      value={editGoal.targetDate}
                      onChange={(e) => setEditGoal({ ...editGoal, targetDate: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-category">Category</Label>
                    <Select value={editGoal.category} onValueChange={(value) => setEditGoal({ ...editGoal, category: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="emergency">Emergency Fund</SelectItem>
                        <SelectItem value="vacation">Vacation</SelectItem>
                        <SelectItem value="house">House Down Payment</SelectItem>
                        <SelectItem value="car">Car Purchase</SelectItem>
                        <SelectItem value="debt">Debt Payoff</SelectItem>
                        <SelectItem value="retirement">Retirement</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-description">Description (Optional)</Label>
                    <Input
                      id="edit-description"
                      placeholder="Save for 6 months of expenses"
                      value={editGoal.description}
                      onChange={(e) => setEditGoal({ ...editGoal, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateGoal} disabled={updateGoalMutation.isPending}>
                    {updateGoalMutation.isPending ? "Updating..." : "Update Goal"}
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
                No Goals Yet
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Create your first financial goal to start tracking your progress
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Goal
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
                    <CardDescription>{goal.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Progress</span>
                          <span className="text-sm font-medium">{progress.toFixed(1)}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>

                      {/* Amount Progress */}
                      <div className="flex items-center justify-between">
                        <div className="text-center">
                          <p className="text-sm text-gray-600 dark:text-gray-300">Current</p>
                          <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                            ${goal.currentAmount.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-600 dark:text-gray-300">Target</p>
                          <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                            ${goal.targetAmount.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Time Left */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <Calendar className="h-4 w-4 mr-1" />
                          {daysLeft > 0 ? `${daysLeft} days left` : daysLeft === 0 ? 'Due today' : `${Math.abs(daysLeft)} days overdue`}
                        </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <DollarSign className="h-4 w-4 mr-1" />
                          ${(goal.targetAmount - goal.currentAmount).toLocaleString()} left
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
                          Edit
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
                            <Button size="sm" variant="outline">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Goal</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{goal.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteGoal(goal.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
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
      </div>
    </RequirePlan>
  );
}