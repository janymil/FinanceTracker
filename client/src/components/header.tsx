import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Crown, 
  ChevronDown, 
  User, 
  Settings, 
  LogOut, 
  Menu,
  Plus,
  Bell,
  Search,
  Repeat,
  HelpCircle
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import RequirePlan from "@/components/require-plan";
import { Link } from "wouter";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: "income" | "expense";
}

async function apiRequest(method: string, url: string, data?: any) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Network error");
  }

  return response;
}

interface HeaderProps {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
}

export default function Header({ onMenuClick, sidebarCollapsed }: HeaderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [newTransaction, setNewTransaction] = useState({
    amount: "",
    description: "",
    date: new Date().toISOString().split('T')[0],
    type: "expense" as "income" | "expense",
    categoryId: "",
    isRecurring: false,
    recurringFrequency: "monthly" as "weekly" | "monthly" | "yearly",
    recurringEndDate: "",
    paymentUrl: "",
    referenceNote: "",
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    enabled: !!user,
  });

  const createTransactionMutation = useMutation({
    mutationFn: async (transactionData: typeof newTransaction) => {
      const res = await apiRequest("POST", "/api/transactions", {
        ...transactionData,
        amount: parseFloat(transactionData.amount),
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      setIsDialogOpen(false);
      setNewTransaction({
        amount: "",
        description: "",
        date: new Date().toISOString().split('T')[0],
        type: "expense",
        categoryId: "",
        isRecurring: false,
        recurringFrequency: "monthly",
        recurringEndDate: "",
        paymentUrl: "",
        referenceNote: "",
      });
      toast({
        title: "Transaction Added",
        description: "Transaction has been created successfully",
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

  const handleSubmit = () => {
    if (!newTransaction.amount || !newTransaction.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createTransactionMutation.mutate(newTransaction);
  };



  return (
    <header className={cn(
      "bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 h-16 fixed top-0 right-0 z-40 transition-all duration-300",
      sidebarCollapsed ? "lg:left-16" : "lg:left-64",
      "left-0"
    )}>
      <div className="flex items-center justify-between h-full px-4">
        {/* Left side - Mobile menu button and quick actions */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuClick}
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Quick add transaction button */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                size="sm" 
                className="bg-primary hover:bg-primary/90"
                onClick={() => {
                  setNewTransaction({
                    amount: "",
                    description: "",
                    date: new Date().toISOString().split('T')[0],
                    type: "expense",
                    categoryId: "",
                    isRecurring: false,
                    recurringFrequency: "monthly",
                    recurringEndDate: "",
                    paymentUrl: "",
                    referenceNote: "",
                  });
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Transaction</DialogTitle>
                <DialogDescription>
                  Record a new income or expense transaction
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={newTransaction.amount}
                      onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newTransaction.date}
                      onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newTransaction.description}
                    onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                    placeholder="What was this transaction for?"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="type">Type</Label>
                    <Select
                      value={newTransaction.type}
                      onValueChange={(value: "income" | "expense") => 
                        setNewTransaction({ ...newTransaction, type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={newTransaction.categoryId}
                      onValueChange={(value) => setNewTransaction({ ...newTransaction, categoryId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {(categories as Category[])
                          .filter((cat: Category) => cat.type === newTransaction.type)
                          .map((category: Category) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              {category.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Premium Features - Standard/Premium only */}
                <RequirePlan plan="standard">
                  <div className="space-y-4 border-t pt-4">
                    {/* Smart Bill Assistant - for expenses only */}
                    {newTransaction.type === "expense" && (
                      <div className="space-y-4">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Smart Bill Assistant
                        </div>
                        <div>
                          <Label htmlFor="paymentUrl">Payment URL (Optional)</Label>
                          <Input
                            id="paymentUrl"
                            type="url"
                            value={newTransaction.paymentUrl}
                            onChange={(e) => setNewTransaction({ ...newTransaction, paymentUrl: e.target.value })}
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
                            value={newTransaction.referenceNote}
                            onChange={(e) => setNewTransaction({ ...newTransaction, referenceNote: e.target.value })}
                            placeholder="Invoice number, account reference, etc."
                          />
                        </div>
                      </div>
                    )}

                    {/* Recurring transaction options */}
                    <div className={newTransaction.type === "expense" ? "border-t pt-4 space-y-4" : "space-y-4"}>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="recurring"
                          checked={newTransaction.isRecurring}
                          onCheckedChange={(checked) => 
                            setNewTransaction({ ...newTransaction, isRecurring: checked as boolean })
                          }
                        />
                        <label htmlFor="recurring" className="flex items-center text-sm font-medium">
                          <Repeat className="h-4 w-4 mr-2" />
                          Make this a recurring transaction
                        </label>
                      </div>

                      {newTransaction.isRecurring && (
                        <div className="grid grid-cols-2 gap-4 pl-6">
                          <div>
                            <Label htmlFor="frequency">Frequency</Label>
                            <Select
                              value={newTransaction.recurringFrequency}
                              onValueChange={(value) => setNewTransaction({ 
                                ...newTransaction, 
                                recurringFrequency: value as "weekly" | "monthly" | "yearly" 
                              })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select frequency" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="yearly">Yearly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="endDate">End Date (Optional)</Label>
                            <Input
                              id="endDate"
                              type="date"
                              value={newTransaction.recurringEndDate}
                              onChange={(e) => setNewTransaction({ 
                                ...newTransaction, 
                                recurringEndDate: e.target.value 
                              })}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </RequirePlan>

                
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={!newTransaction.amount || !newTransaction.description || createTransactionMutation.isPending}
                >
                  Add Transaction
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Center - Date selector or breadcrumb */}
        <div className="hidden md:flex items-center">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long',
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })}
          </h1>
        </div>

        {/* Right side - User menu and premium status */}
        <div className="flex items-center space-x-3">
          {/* Search button */}
          <Button variant="ghost" size="sm" className="hidden sm:flex">
            <Search className="h-4 w-4" />
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></span>
          </Button>

          {/* Premium status */}
          {user?.plan === 'premium' ? (
            <Badge className="bg-premium text-white hidden sm:flex">
              <Crown className="h-3 w-3 mr-1" />
              Premium
            </Badge>
          ) : (
            <Link href="/subscribe">
              <Button size="sm" className="bg-premium hover:bg-premium/90 text-white hidden sm:flex">
                <Crown className="h-4 w-4 mr-1" />
                Upgrade
              </Button>
            </Link>
          )}

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 h-auto p-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.profileImageUrl} alt={user?.firstName || "User"} />
                  <AvatarFallback className="bg-primary text-white">
                    {user?.firstName?.[0] || user?.email?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden lg:block">
                  {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-500 hidden lg:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user?.email}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <User className="h-4 w-4 mr-2" />
                  Profile & Account Configuration
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/help">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Help & Documentation
                </Link>
              </DropdownMenuItem>
              {user?.plan !== 'premium' && (
                <DropdownMenuItem asChild>
                  <Link href="/subscribe">
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade to Premium
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => window.location.href = '/api/logout'}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}