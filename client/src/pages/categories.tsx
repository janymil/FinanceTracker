import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit3, Trash2, TrendingUp, DollarSign } from "lucide-react";
import { categoryIcons } from "@/lib/icons-registry";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: "income" | "expense";
  transactionCount: number;
  isInUse: boolean;
}

const categoryColors = [
  { name: "Blue", value: "#3B82F6" },
  { name: "Green", value: "#10B981" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Red", value: "#EF4444" },
  { name: "Orange", value: "#F97316" },
  { name: "Pink", value: "#EC4899" },
  { name: "Indigo", value: "#6366F1" },
  { name: "Teal", value: "#14B8A6" },
];

export default function Categories() {
  const { isReady, user } = useClerkUserReady();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategory, setNewCategory] = useState({
    name: "",
    icon: "other",
    color: "#3B82F6",
    type: "expense" as "income" | "expense"
  });

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/categories");
      return response.json();
    },
    enabled: isReady && !!user?.id
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: typeof newCategory) => {
      const res = await apiRequest("POST", "/api/categories", categoryData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setIsDialogOpen(false);
      setNewCategory({ name: "", icon: "dollar-sign", color: "#3B82F6", type: "expense" });
      toast({
        title: "Category Created",
        description: "New category has been added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & typeof newCategory) => {
      const res = await apiRequest("PUT", `/api/categories/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setEditingCategory(null);
      setIsDialogOpen(false);
      toast({
        title: "Category Updated",
        description: "Category has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/categories/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({
        title: "Category Deleted",
        description: "Category has been removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const expenseCategories = categories.filter((cat: Category) => cat.type === "expense");
  const incomeCategories = categories.filter((cat: Category) => cat.type === "income");

  const handleSubmit = () => {
    if (!newCategory.name.trim()) return;

    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, ...newCategory });
    } else {
      createCategoryMutation.mutate(newCategory);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setNewCategory({
      name: category.name,
      icon: category.icon,
      color: category.color,
      type: category.type,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number, isInUse: boolean) => {
    if (isInUse) {
      toast({
        title: "Cannot Delete",
        description: "This category is currently in use by transactions",
        variant: "destructive",
      });
      return;
    }
    deleteCategoryMutation.mutate(id);
  };

  const CategoryCard = ({ category }: { category: Category }) => {
    const IconComponent = categoryIcons[category.icon as keyof typeof categoryIcons] || categoryIcons["other"];
    
    return (
      <Card className="group relative hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div 
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${category.color}20` }}
              >
                <IconComponent 
                  className="h-5 w-5" 
                  style={{ color: category.color }}
                />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {category.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {category.transactionCount} transactions
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleEdit(category)}
              >
                <Edit3 className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(category.id, category.isInUse)}
                disabled={category.isInUse}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          {category.isInUse && (
            <Badge variant="secondary" className="text-xs">
              In use
            </Badge>
          )}
        </CardContent>
      </Card>
    );
  };

  if (!user) {
    return null;
  }

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Category Management
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Organize your income and expense sources
              </p>
            </div>
          </div>
        </div>

        {/* Tabs for Expense and Income Categories */}
        <Tabs defaultValue="expenses" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="expenses" className="flex items-center gap-2 text-xs sm:text-sm">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Expense Categories</span>
                <span className="sm:hidden">Expenses</span>
              </TabsTrigger>
              <TabsTrigger value="income" className="flex items-center gap-2 text-xs sm:text-sm">
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Income Categories</span>
                <span className="sm:hidden">Income</span>
              </TabsTrigger>
            </TabsList>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={() => {
                    setEditingCategory(null);
                    setNewCategory({ name: "", icon: "dollar-sign", color: "#3B82F6", type: "expense" });
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingCategory ? "Edit Category" : "Create New Category"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingCategory ? "Update the category details" : "Add a new category to organize your transactions"}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Category Name</Label>
                    <Input
                      id="name"
                      value={newCategory.name}
                      onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                      placeholder="Enter category name"
                    />
                  </div>

                  <div>
                    <Label>Category Type</Label>
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant={newCategory.type === "expense" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setNewCategory({ ...newCategory, type: "expense" })}
                      >
                        Expense
                      </Button>
                      <Button
                        variant={newCategory.type === "income" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setNewCategory({ ...newCategory, type: "income" })}
                      >
                        Income
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label>Icon</Label>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {Object.entries(categoryIcons).map(([key, IconComponent]) => (
                        <Button
                          key={key}
                          variant={newCategory.icon === key ? "default" : "outline"}
                          size="sm"
                          onClick={() => setNewCategory({ ...newCategory, icon: key })}
                          className="h-10"
                        >
                          <IconComponent className="h-4 w-4" />
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Color</Label>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {categoryColors.map((color) => (
                        <Button
                          key={color.value}
                          variant={newCategory.color === color.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => setNewCategory({ ...newCategory, color: color.value })}
                          className="h-10"
                          style={{
                            backgroundColor: newCategory.color === color.value ? color.value : 'transparent',
                            borderColor: color.value,
                          }}
                        >
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: color.value }}
                          />
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSubmit}
                      disabled={!newCategory.name.trim()}
                    >
                      {editingCategory ? "Update" : "Create"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Expense Categories */}
          <TabsContent value="expenses" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Expense Categories</CardTitle>
                <CardDescription>
                  Manage categories for your expenses and spending
                </CardDescription>
              </CardHeader>
              <CardContent>
                {expenseCategories.length === 0 ? (
                  <div className="text-center py-8">
                    <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No Expense Categories
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      Create your first expense category to organize your spending
                    </p>
                    <Button onClick={() => setIsDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Expense Category
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {expenseCategories.map((category: Category) => (
                      <CategoryCard key={category.id} category={category} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Income Categories */}
          <TabsContent value="income" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Income Categories</CardTitle>
                <CardDescription>
                  Manage categories for your income sources
                </CardDescription>
              </CardHeader>
              <CardContent>
                {incomeCategories.length === 0 ? (
                  <div className="text-center py-8">
                    <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No Income Categories
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      Create your first income category to organize your revenue sources
                    </p>
                    <Button onClick={() => setIsDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Income Category
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {incomeCategories.map((category: Category) => (
                      <CategoryCard key={category.id} category={category} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}