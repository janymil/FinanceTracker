import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Users, UserPlus, Edit, Trash2, Crown, Shield, TrendingUp, Search, Filter, RefreshCw, Zap, Clock, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { CountryBlockingPanel } from "@/components/admin/CountryBlockingPanel";

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  plan: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  freeUsers: number;
  standardUsers: number;
  premiumUsers: number;
  totalTransactions: number;
  totalRevenue: number;
}

export default function AdminAnalytics() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [userTypeFilter, setUserTypeFilter] = useState("all"); // New filter for dev/prod
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    email: "",
    firstName: "",
    lastName: "",
    plan: "free"
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [isSyncingUsers, setIsSyncingUsers] = useState(false);
  
  // AI Functions Management State
  const [editingLimit, setEditingLimit] = useState<any>(null);
  const [editingUserOverride, setEditingUserOverride] = useState<any>(null);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [showUserOverrideDialog, setShowUserOverrideDialog] = useState(false);
  const [isSavingLimit, setIsSavingLimit] = useState(false);
  const [isSavingUserOverride, setIsSavingUserOverride] = useState(false);
  
  const { toast } = useToast();
  const { t } = useTranslation();

  // Check authentication status on component mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await fetch('/api/admin-analytics/auth-status', {
          credentials: 'include'
        });
        const data = await response.json();
        console.log('Admin auth status:', data);
        if (data.authenticated) {
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      }
    };

    checkAuthStatus();
  }, []);

  // Custom fetcher for admin endpoints that uses session cookies instead of Clerk tokens
  const adminFetch = async (url: string) => {
    const response = await fetch(url, {
      credentials: 'include', // Include session cookies
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }

    return response.json();
  };

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-analytics-users'],
    queryFn: () => adminFetch('/api/admin-analytics/users'),
    enabled: isAuthenticated,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-analytics-overview'],
    queryFn: () => adminFetch('/api/admin-analytics/overview'),
    enabled: isAuthenticated,
  });

  // AI Cache Management Queries
  const { data: aiCacheGlobal, isLoading: aiCacheGlobalLoading, refetch: refetchGlobal } = useQuery({
    queryKey: ['admin-ai-cache-global'],
    queryFn: () => adminFetch('/api/admin-analytics/ai-cache/global'),
    enabled: isAuthenticated,
  });

  const { data: aiCacheFunctions = [], isLoading: aiCacheFunctionsLoading, refetch: refetchFunctions } = useQuery({
    queryKey: ['admin-ai-cache-functions'],
    queryFn: () => adminFetch('/api/admin-analytics/ai-cache/functions'),
    enabled: isAuthenticated,
  });

  const { data: aiCacheUsers = [], isLoading: aiCacheUsersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-ai-cache-users'],
    queryFn: () => adminFetch('/api/admin-analytics/ai-cache/users'),
    enabled: isAuthenticated,
  });

  const { data: ttlConfig = {}, isLoading: ttlConfigLoading } = useQuery({
    queryKey: ['admin-ai-cache-ttl-config'],
    queryFn: () => adminFetch('/api/admin-analytics/ai-cache/ttl-config'),
    enabled: isAuthenticated,
  });

  // AI Functions Management Queries
  const { data: aiFunctionStats = [], isLoading: aiFunctionStatsLoading, refetch: refetchFunctionStats } = useQuery({
    queryKey: ['admin-ai-functions-stats'],
    queryFn: () => adminFetch('/api/admin-analytics/ai-functions/stats'),
    enabled: isAuthenticated,
  });

  const { data: aiUserStats = [], isLoading: aiUserStatsLoading, refetch: refetchUserStats } = useQuery({
    queryKey: ['admin-ai-functions-users'],
    queryFn: () => adminFetch('/api/admin-analytics/ai-functions/users'),
    enabled: isAuthenticated,
  });

  const { data: aiGlobalStats, isLoading: aiGlobalStatsLoading, refetch: refetchGlobalStats } = useQuery({
    queryKey: ['admin-ai-functions-global'],
    queryFn: () => adminFetch('/api/admin-analytics/ai-functions/global'),
    enabled: isAuthenticated,
  });

  const { data: aiUsageLimits = [], isLoading: aiUsageLimitsLoading, refetch: refetchUsageLimits } = useQuery({
    queryKey: ['admin-ai-functions-limits'],
    queryFn: () => adminFetch('/api/admin-analytics/ai-functions/limits'),
    enabled: isAuthenticated,
  });

  const { data: aiUserOverrides = [], isLoading: aiUserOverridesLoading, refetch: refetchUserOverrides } = useQuery({
    queryKey: ['admin-ai-functions-user-overrides'],
    queryFn: () => adminFetch('/api/admin-analytics/ai-functions/user-overrides'),
    enabled: isAuthenticated,
  });

  // AI Cache Management Functions
  const clearFunctionCache = async (functionKey: string) => {
    try {
      const response = await fetch(`/api/admin-analytics/ai-cache/function/${functionKey}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to clear function cache');
      }

      const result = await response.json();
      toast({
        title: t("common.success"),
        description: result.message,
      });

      // Refetch all cache data
      refetchGlobal();
      refetchFunctions();
      refetchUsers();
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("admin.failed_to_clear_function_cache"),
        variant: "destructive",
      });
    }
  };

  const clearUserCache = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin-analytics/ai-cache/user/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to clear user cache');
      }

      const result = await response.json();
      toast({
        title: t("common.success"),
        description: result.message,
      });

      // Refetch all cache data
      refetchGlobal();
      refetchFunctions();
      refetchUsers();
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("admin.failed_to_clear_user_cache"),
        variant: "destructive",
      });
    }
  };

  const cleanupExpiredCache = async () => {
    try {
      const response = await fetch('/api/admin-analytics/ai-cache/expired', {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to cleanup expired cache');
      }

      const result = await response.json();
      toast({
        title: t("common.success"),
        description: result.message,
      });

      // Refetch all cache data
      refetchGlobal();
      refetchFunctions();
      refetchUsers();
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("admin.failed_to_cleanup_expired_cache"),
        variant: "destructive",
      });
    }
  };

  // AI Functions Management Functions
  const openEditLimitDialog = (plan: string, functionName: string) => {
    const existingLimit = aiUsageLimits.find((l: any) => l.plan === plan && l.functionName === functionName);
    setEditingLimit(existingLimit || {
      plan,
      functionName,
      monthlyRequestLimit: 0,
      monthlyCostLimit: '0.00',
      dailyRequestLimit: 0,
      dailyCostLimit: '0.00',
      cooldownSeconds: 0,
      description: ''
    });
    setShowLimitDialog(true);
  };

  const saveLimitChanges = async () => {
    if (!editingLimit) return;
    
    setIsSavingLimit(true);
    try {
      const response = await fetch('/api/admin-analytics/ai-functions/limits', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingLimit),
      });

      if (!response.ok) {
        throw new Error('Failed to save limit');
      }

      toast({
        title: "Success",
        description: "Usage limit saved successfully",
      });

      setShowLimitDialog(false);
      setEditingLimit(null);
      refetchUsageLimits();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save usage limit",
        variant: "destructive",
      });
    } finally {
      setIsSavingLimit(false);
    }
  };

  const openAddUserOverrideDialog = () => {
    setEditingUserOverride({
      userId: '',
      functionName: '',
      monthlyRequestLimit: null,
      monthlyCostLimit: null,
      dailyRequestLimit: null,
      dailyCostLimit: null,
      cooldownSeconds: null,
      isBlocked: false,
      reason: '',
      expiresAt: null
    });
    setShowUserOverrideDialog(true);
  };

  const saveUserOverrideChanges = async () => {
    if (!editingUserOverride) return;
    
    setIsSavingUserOverride(true);
    try {
      const response = await fetch('/api/admin-analytics/ai-functions/user-overrides', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingUserOverride),
      });

      if (!response.ok) {
        throw new Error('Failed to save user override');
      }

      toast({
        title: "Success",
        description: "User override saved successfully",
      });

      setShowUserOverrideDialog(false);
      setEditingUserOverride(null);
      refetchUserOverrides();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save user override",
        variant: "destructive",
      });
    } finally {
      setIsSavingUserOverride(false);
    }
  };

  const deleteUserOverride = async (userId: string, functionName: string) => {
    try {
      const response = await fetch(`/api/admin-analytics/ai-functions/user-overrides/${userId}/${functionName}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete user override');
      }

      toast({
        title: "Success",
        description: "User override deleted successfully",
      });

      refetchUserOverrides();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete user override",
        variant: "destructive",
      });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);

    try {
      const response = await fetch('/api/admin-analytics/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        throw new Error('Invalid admin password');
      }

      setIsAuthenticated(true);
      setPassword("");

      // Fetch data immediately after successful authentication
      await queryClient.invalidateQueries({ queryKey: ['/api/admin-analytics/users'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/admin-analytics/overview'] });

      toast({
        title: t("common.success"),
        description: "Admin login successful",
      });
    } catch (error) {
      toast({
        title: t("common.error"),
        description: "Invalid admin password",
        variant: "destructive",
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const createUser = async (userData: any) => {
    setIsCreatingUser(true);
    try {
      const response = await fetch('/api/admin-analytics/users', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        throw new Error('Failed to create user');
      }

      // Force immediate refetch of data
      await queryClient.refetchQueries({ queryKey: ['admin-analytics-users'] });
      await queryClient.refetchQueries({ queryKey: ['admin-analytics-overview'] });
      setNewUser({ email: "", firstName: "", lastName: "", plan: "free" });
      toast({
        title: t("common.success"),
        description: "User created successfully",
      });
    } catch (error) {
      toast({
        title: t("common.error"),
        description: "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const updateUser = async ({ id, userData }: { id: string; userData: any }) => {
    setIsUpdatingUser(true);
    try {
      const response = await fetch(`/api/admin-analytics/users/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          plan: userData.plan
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      // Force immediate refetch of data
      await queryClient.refetchQueries({ queryKey: ['admin-analytics-users'] });
      await queryClient.refetchQueries({ queryKey: ['admin-analytics-overview'] });
      setEditingUser(null);
      toast({
        title: t("common.success"),
        description: "User updated successfully",
      });
    } catch (error) {
      toast({
        title: t("common.error"),
        description: "Failed to update user",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const deleteUser = async (userId: string) => {
    setIsDeletingUser(true);
    try {
      console.log('Attempting to delete user:', userId);
      
      const response = await fetch(`/api/admin-analytics/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const responseData = await response.json();
      console.log('Delete response:', responseData);

      if (!response.ok) {
        throw new Error(responseData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Force immediate refetch of data
      await queryClient.refetchQueries({ queryKey: ['admin-analytics-users'] });
      await queryClient.refetchQueries({ queryKey: ['admin-analytics-overview'] });
      
      toast({
        title: t("common.success"),
        description: "User deleted successfully",
      });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: t("common.error"),
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setIsDeletingUser(false);
    }
  };

  const syncClerkUsers = async () => {
    setIsSyncingUsers(true);
    try {
      const response = await fetch('/api/admin-analytics/sync-clerk-users', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to sync users with Clerk');
      }

      const result = await response.json();

      // Force immediate refetch of data
      await queryClient.refetchQueries({ queryKey: ['admin-analytics-users'] });
      await queryClient.refetchQueries({ queryKey: ['admin-analytics-overview'] });

      toast({
        title: "Sync Complete",
        description: `Updated ${result.updatedUsers} out of ${result.totalUsers} users with Clerk data`,
      });

      if (result.errors > 0) {
        console.warn('Some users failed to sync:', result.details);
      }
    } catch (error) {
      toast({
        title: t("common.error"),
        description: "Failed to sync users with Clerk",
        variant: "destructive",
      });
    } finally {
      setIsSyncingUsers(false);
    }
  };

  // Helper function to determine if user is from production or development
  const isProductionUser = (userId: string) => {
    // Production users have longer Clerk IDs starting with "user_2y"
    // Dev users typically have shorter IDs or different patterns
    return userId.startsWith('user_2y') && userId.length > 20;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  // Payment information helper functions
  const getPaymentStatusBadge = (user: any) => {
    if (user.plan === 'free') {
      return <Badge variant="secondary">Free Plan</Badge>;
    }
    
    if (user.graceStatus === 'active') {
      return <Badge variant="destructive">Grace Period</Badge>;
    } else if (user.graceStatus === 'expired') {
      return <Badge variant="destructive">Grace Expired</Badge>;
    } else if (user.stripeCustomerId) {
      return <Badge variant="default">Active Subscription</Badge>;
    } else {
      return <Badge variant="outline">No Payment Info</Badge>;
    }
  };

  const getGracePeriodInfo = (user: any) => {
    if (!user.gracePeriodActive) {
      return <span className="text-sm text-gray-500">None</span>;
    }

    const daysRemaining = user.daysUntilExpiry;
    if (daysRemaining > 0) {
      return (
        <div className="text-sm">
          <div className="text-orange-600 font-medium">{daysRemaining} days left</div>
          <div className="text-xs text-gray-500">
            Expires: {formatDate(user.graceExpiresAt)}
          </div>
        </div>
      );
    } else {
      return (
        <div className="text-sm">
          <div className="text-red-600 font-medium">Expired</div>
          <div className="text-xs text-gray-500">
            {formatDate(user.graceExpiresAt)}
          </div>
        </div>
      );
    }
  };

  const getPaymentFailureInfo = (user: any) => {
    const failureCount = user.paymentFailureCount || 0;
    const unresolved = user.paymentFailures?.filter((f: any) => !f.resolved).length || 0;
    
    if (failureCount === 0) {
      return <span className="text-sm text-green-600">No failures</span>;
    }

    return (
      <div className="text-sm">
        <div className="text-red-600 font-medium">
          {failureCount} total
        </div>
        {unresolved > 0 && (
          <div className="text-xs text-red-500">
            {unresolved} unresolved
          </div>
        )}
        {user.lastPaymentFailureNotified && (
          <div className="text-xs text-gray-500">
            Last notified: {formatDate(user.lastPaymentFailureNotified)}
          </div>
        )}
      </div>
    );
  };

  const getStripeInfo = (user: any) => {
    if (!user.stripeCustomerId) {
      return <span className="text-sm text-gray-500">No Stripe ID</span>;
    }

    return (
      <div className="text-xs font-mono space-y-1">
        <div title={user.stripeCustomerId}>
          <span className="text-gray-500">Customer:</span><br />
          <span className="text-blue-600">{user.stripeCustomerId.substring(0, 12)}...</span>
        </div>
        {user.stripeSubscriptionId && (
          <div title={user.stripeSubscriptionId}>
            <span className="text-gray-500">Subscription:</span><br />
            <span className="text-green-600">{user.stripeSubscriptionId.substring(0, 12)}...</span>
          </div>
        )}
      </div>
    );
  };

  const filteredUsers = users.filter((user: User) => {
    const matchesSearch = !searchTerm || 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.id?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPlan = planFilter === "all" || user.plan === planFilter;

    const matchesUserType = userTypeFilter === "all" || 
      (userTypeFilter === "prod" && isProductionUser(user.id)) ||
      (userTypeFilter === "dev" && !isProductionUser(user.id));

    return matchesSearch && matchesPlan && matchesUserType;
  });

  const getPlanBadge = (plan: string) => {
    const variants = {
      free: { variant: "secondary" as const, icon: Users },
      standard: { variant: "default" as const, icon: TrendingUp },
      premium: { variant: "default" as const, icon: Crown }
    };

    const config = variants[plan as keyof typeof variants] || variants.free;
    const IconComponent = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <IconComponent className="h-3 w-3" />
        {plan.charAt(0).toUpperCase() + plan.slice(1)}
      </Badge>
    );
  };

  // Payment information helper functions
  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Shield className="h-12 w-12 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Kaptia Admin Access</CardTitle>
            <CardDescription>
              Authorized administrator login for Kaptia system analytics
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Security Notice */}
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Internal Admin Portal</strong><br />
                  This is the official Kaptia administrative interface for authorized personnel only.
                </div>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="password">Administrator Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  required
                  className="mt-1"
                  autoComplete="current-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoggingIn || !password}
              >
                {isLoggingIn ? "Authenticating..." : "Access Admin Panel"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (usersLoading || statsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto p-4 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">System Analytics</h1>
              <p className="text-gray-600 text-sm md:text-base">Monitor application metrics and user management</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              const lang = window.location.pathname.split('/')[1] || 'sk';
              window.location.href = `/${lang}/admin-watch`;
            }}
          >
            Open Watch
          </Button>
        </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7 h-auto">
          <TabsTrigger value="overview" className="text-xs md:text-sm px-2 py-2">Overview</TabsTrigger>
          <TabsTrigger value="users" className="text-xs md:text-sm px-2 py-2">Users</TabsTrigger>
          <TabsTrigger value="ai-cache" className="text-xs md:text-sm px-2 py-2">AI Cache</TabsTrigger>
          <TabsTrigger value="ai-management" className="text-xs md:text-sm px-2 py-2">AI Mgmt</TabsTrigger>
          <TabsTrigger value="ai-functions" className="text-xs md:text-sm px-2 py-2">AI Functions</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs md:text-sm px-2 py-2">Analytics</TabsTrigger>
          <TabsTrigger value="country-blocking" className="text-xs md:text-sm px-2 py-2">Countries</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                <p className="text-xs text-muted-foreground">
                  +{stats?.activeUsers || 0} active this month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Premium Users</CardTitle>
                <Crown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.premiumUsers || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.standardUsers || 0} standard users
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalTransactions || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Across all users
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                <Crown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats?.totalRevenue || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Monthly recurring revenue
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Plan Distribution</CardTitle>
              <CardDescription>Current user subscription breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{stats?.freeUsers || 0}</div>
                  <div className="text-sm text-gray-500">Free Users</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats?.standardUsers || 0}</div>
                  <div className="text-sm text-gray-500">Standard Users</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{stats?.premiumUsers || 0}</div>
                  <div className="text-sm text-gray-500">Premium Users</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Plans</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="prod">Production</SelectItem>
                    <SelectItem value="dev">Development</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button 
                onClick={syncClerkUsers}
                disabled={isSyncingUsers}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={cn("h-4 w-4 mr-1", isSyncingUsers && "animate-spin")} />
                <span className="hidden sm:inline">{isSyncingUsers ? "Syncing..." : "Sync"}</span>
                <span className="sm:hidden">Sync</span>
              </Button>

              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Add User</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>
                    Add a new user to the system
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="user@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={newUser.firstName}
                      onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={newUser.lastName}
                      onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                      placeholder="Doe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="plan">Plan</Label>
                    <Select value={newUser.plan} onValueChange={(value) => setNewUser({ ...newUser, plan: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={() => createUser(newUser)}
                    disabled={isCreatingUser}
                    className="w-full"
                  >
                    {isCreatingUser ? "Creating..." : "Create User"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-lg">Users ({filteredUsers.length})</CardTitle>
              <CardDescription>
                Manage user accounts and subscriptions
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-48">User</TableHead>
                    <TableHead className="min-w-48">Email</TableHead>
                    <TableHead className="min-w-24">Plan</TableHead>
                    <TableHead className="min-w-32">Payment Status</TableHead>
                    <TableHead className="min-w-28">Grace Period</TableHead>
                    <TableHead className="min-w-24">Failures</TableHead>
                    <TableHead className="min-w-32">Stripe Info</TableHead>
                    <TableHead className="min-w-24">Created</TableHead>
                    <TableHead className="min-w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user: User) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {user.profileImageUrl ? (
                            <img
                              src={user.profileImageUrl}
                              alt="Profile"
                              className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                              <Users className="h-4 w-4 text-gray-500" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">
                              {user.firstName && user.lastName 
                                ? `${user.firstName} ${user.lastName}`
                                : user.email?.split('@')[0] || 'No name'
                              }
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              {isProductionUser(user.id) ? (
                                <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs">PROD</span>
                              ) : (
                                <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs">DEV</span>
                              )}
                              <span className="truncate max-w-20 text-xs">{user.id}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="truncate max-w-48 text-sm" title={user.email || "No email"}>
                          {user.email || "No email"}
                        </div>
                      </TableCell>
                      <TableCell>{getPlanBadge(user.plan)}</TableCell>
                      <TableCell>
                        {getPaymentStatusBadge(user)}
                      </TableCell>
                      <TableCell>
                        {getGracePeriodInfo(user)}
                      </TableCell>
                      <TableCell>
                        {getPaymentFailureInfo(user)}
                      </TableCell>
                      <TableCell>
                        {getStripeInfo(user)}
                      </TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => setEditingUser(user)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit User</DialogTitle>
                                <DialogDescription>
                                  Update user information and subscription plan
                                </DialogDescription>
                              </DialogHeader>
                              {editingUser && (
                                <div className="space-y-4">
                                  <div>
                                    <Label htmlFor="editEmail">Email</Label>
                                    <Input
                                      id="editEmail"
                                      type="email"
                                      value={editingUser.email || ""}
                                      onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="editFirstName">First Name</Label>
                                    <Input
                                      id="editFirstName"
                                      value={editingUser.firstName || ""}
                                      onChange={(e) => setEditingUser({ ...editingUser, firstName: e.target.value })}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="editLastName">Last Name</Label>
                                    <Input
                                      id="editLastName"
                                      value={editingUser.lastName || ""}
                                      onChange={(e) => setEditingUser({ ...editingUser, lastName: e.target.value })}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="editPlan">Plan</Label>
                                    <Select 
                                      value={editingUser.plan} 
                                      onValueChange={(value) => setEditingUser({ ...editingUser, plan: value })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="free">Free</SelectItem>
                                        <SelectItem value="standard">Standard</SelectItem>
                                        <SelectItem value="premium">Premium</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <Button 
                                    onClick={() => updateUser({ 
                                      id: editingUser.id, 
                                      userData: editingUser 
                                    })}
                                    disabled={isUpdatingUser}
                                    className="w-full"
                                  >
                                    {isUpdatingUser ? "Updating..." : "Update User"}
                                  </Button>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                <Trash2 className="h-3 w-3 text-red-600" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the user and all their data. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => deleteUser(user.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete User
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
          </div>
        </TabsContent>

        <TabsContent value="ai-cache" className="space-y-6">
          {/* Global AI Cache Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                Global AI Cache Statistics
              </CardTitle>
              <CardDescription>
                Overview of AI cache performance across all functions and users
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aiCacheGlobalLoading ? (
                <div className="text-center py-6">Loading global statistics...</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{aiCacheGlobal?.totalEntries || 0}</div>
                    <div className="text-sm text-gray-500">Total Entries</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{aiCacheGlobal?.totalUsers || 0}</div>
                    <div className="text-sm text-gray-500">Active Users</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{aiCacheGlobal?.totalFunctions || 0}</div>
                    <div className="text-sm text-gray-500">AI Functions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{aiCacheGlobal?.totalHits || 0}</div>
                    <div className="text-sm text-gray-500">Total Hits</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{aiCacheGlobal?.errorRate || 0}%</div>
                    <div className="text-sm text-gray-500">Error Rate</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cache Management Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Cache Management Actions</CardTitle>
              <CardDescription>Manage and clean up AI cache entries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 flex-wrap">
                <Button 
                  onClick={cleanupExpiredCache}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Clock className="h-4 w-4" />
                  Cleanup Expired
                </Button>
                <Button 
                  onClick={() => {
                    refetchGlobal();
                    refetchFunctions();
                    refetchUsers();
                  }}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh Data
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* AI Functions Cache Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>AI Functions Cache Statistics</CardTitle>
              <CardDescription>Cache performance breakdown by AI function</CardDescription>
            </CardHeader>
            <CardContent>
              {aiCacheFunctionsLoading ? (
                <div className="text-center py-6">Loading function statistics...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Function
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          TTL (hours)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Entries
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Hits
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Avg Hits
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Errors
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Users
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {aiCacheFunctions.map((func: any) => (
                        <tr key={func.functionKey} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                              {func.functionKey}
                            </code>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {ttlConfig[func.functionKey] || 'N/A'}h
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {func.totalEntries}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {func.totalHits}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {func.avgHitsPerEntry}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={func.errorEntries > 0 ? 'text-red-600' : 'text-green-600'}>
                              {func.errorEntries}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {func.uniqueUsers}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <Button
                              onClick={() => clearFunctionCache(func.functionKey)}
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Clear
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {aiCacheFunctions.length === 0 && (
                    <div className="text-center py-6 text-gray-500">No cache entries found</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Cache Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>User Cache Statistics</CardTitle>
              <CardDescription>Cache usage breakdown by individual users</CardDescription>
            </CardHeader>
            <CardContent>
              {aiCacheUsersLoading ? (
                <div className="text-center py-6">Loading user statistics...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Plan
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Entries
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Hits
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Avg Hits
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Functions
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Access
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {aiCacheUsers.map((user: any) => (
                        <tr key={user.userId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div>
                              <div className="font-medium">{user.userEmail}</div>
                              <div className="text-xs text-gray-500 font-mono">{user.userId}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                              user.userPlan === 'premium' && "bg-purple-100 text-purple-800",
                              user.userPlan === 'standard' && "bg-blue-100 text-blue-800",
                              user.userPlan === 'free' && "bg-gray-100 text-gray-800"
                            )}>
                              {user.userPlan}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.totalEntries}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.totalHits}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.avgHitsPerEntry}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.uniqueFunctions}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.lastAccessed ? new Date(user.lastAccessed).toLocaleDateString() : 'Never'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <Button
                              onClick={() => clearUserCache(user.userId)}
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Clear
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {aiCacheUsers.length === 0 && (
                    <div className="text-center py-6 text-gray-500">No user cache data found</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-management" className="space-y-6">
          {/* AI Functions Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                AI Functions Management
              </CardTitle>
              <CardDescription>
                Manage AI function usage, set limitations, and monitor performance across all users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* AI Functions Grid */}
                <div className="md:col-span-2 space-y-4">
                  <h4 className="font-semibold text-gray-900">Active AI Functions</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {[
                      { name: 'financial-tips', title: 'Financial Tips', plan: 'Premium', ttl: '7 days', icon: '💡' },
                      { name: 'daily-recommendations', title: 'Daily Recommendations', plan: 'Premium', ttl: '1 day', icon: '📋' },
                      { name: 'contextual-tips', title: 'Contextual Tips', plan: 'Premium', ttl: '3 days', icon: '🎯' },
                      { name: 'expense-predictions', title: 'Expense Predictions', plan: 'Premium', ttl: '2 days', icon: '📈' },
                      { name: 'financial-health-score', title: 'Health Score', plan: 'Standard+', ttl: '1 day', icon: '❤️' },
                      { name: 'spending-insights', title: 'Spending Insights', plan: 'Premium', ttl: '3 days', icon: '🔍' },
                      { name: 'trend-predictions', title: 'Trend Predictions', plan: 'Premium', ttl: '2 days', icon: '📊' },
                      { name: 'categorizeExpense', title: 'Auto Categorization', plan: 'Standard+', ttl: 'Real-time', icon: '🏷️' },
                      { name: 'parseBankStatement', title: 'Bank Statement Parser', plan: 'Standard+', ttl: 'No cache', icon: '📄' }
                    ].map((func) => (
                      <div key={func.name} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{func.icon}</span>
                            <h5 className="font-medium text-sm">{func.title}</h5>
                          </div>
                          <Badge variant={func.plan === 'Premium' ? 'default' : 'secondary'} className="text-xs">
                            {func.plan}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500 space-y-1">
                          <div>Cache TTL: {func.ttl}</div>
                          <div className="font-mono text-gray-400">{func.name}</div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs h-7"
                            onClick={() => {
                              if (func.name !== 'categorizeExpense' && func.name !== 'parseBankStatement') {
                                clearFunctionCache(func.name);
                              }
                            }}
                            disabled={func.name === 'categorizeExpense' || func.name === 'parseBankStatement'}
                          >
                            Clear Cache
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Global AI Stats */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900">Global Usage Stats</h4>
                  <div className="space-y-3">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{aiCacheGlobal?.totalUsers || 0}</div>
                      <div className="text-sm text-blue-700">Active AI Users</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{aiCacheGlobal?.totalHits || 0}</div>
                      <div className="text-sm text-green-700">Total AI Requests</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{aiCacheGlobal?.totalFunctions || 0}</div>
                      <div className="text-sm text-purple-700">Functions In Use</div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {aiCacheGlobal?.errorRate ? `${aiCacheGlobal.errorRate}%` : '0%'}
                      </div>
                      <div className="text-sm text-orange-700">Error Rate</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* User AI Usage Limits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-600" />
                AI Usage Limitations & Control
              </CardTitle>
              <CardDescription>
                Set and manage AI usage limitations per user or plan tier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Plan-based Limitations */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Current Plan Limitations</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">Free Plan</Badge>
                      </div>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>❌ No AI features</li>
                        <li>❌ Manual categorization only</li>
                        <li>❌ No insights or predictions</li>
                      </ul>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">Standard Plan</Badge>
                      </div>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>✅ Auto categorization</li>
                        <li>✅ Financial health score</li>
                        <li>✅ Bank statement parsing</li>
                        <li>❌ No advanced AI insights</li>
                      </ul>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="default">Premium Plan</Badge>
                      </div>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>✅ All Standard features</li>
                        <li>✅ AI financial tips</li>
                        <li>✅ Spending insights</li>
                        <li>✅ Expense predictions</li>
                        <li>✅ Daily recommendations</li>
                        <li>✅ Trend analysis</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Rate Limiting Info */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Rate Limiting & Performance</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>Current Implementation:</strong>
                        <ul className="mt-2 space-y-1 text-gray-600">
                          <li>• Cache-based rate limiting via TTL</li>
                          <li>• Plan-based feature access control</li>
                          <li>• External Fly.io processing with fallback</li>
                          <li>• User isolation in cache system</li>
                        </ul>
                      </div>
                      <div>
                        <strong>Performance Optimizations:</strong>
                        <ul className="mt-2 space-y-1 text-gray-600">
                          <li>• Function-specific cache TTL (1-7 days)</li>
                          <li>• Smart cache invalidation</li>
                          <li>• Privacy-first design (no sensitive data cached)</li>
                          <li>• Automatic expired cache cleanup</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Emergency Controls */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Emergency Controls</h4>
                  <div className="flex gap-3 flex-wrap">
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => {
                        if (confirm('This will clear ALL AI cache entries. Are you sure?')) {
                          // Clear all function caches
                          ['financial-tips', 'daily-recommendations', 'contextual-tips', 'expense-predictions', 'financial-health-score', 'spending-insights', 'trend-predictions'].forEach(func => {
                            clearFunctionCache(func);
                          });
                        }
                      }}
                    >
                      🚨 Clear All AI Cache
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={cleanupExpiredCache}
                    >
                      🧹 Cleanup Expired
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        refetchGlobal();
                        refetchFunctions();
                        refetchUsers();
                      }}
                    >
                      🔄 Refresh All Data
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top AI Users */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Top AI Users
              </CardTitle>
              <CardDescription>
                Users with highest AI function usage and potential optimization opportunities
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aiCacheUsersLoading ? (
                <div className="text-center py-6">Loading user data...</div>
              ) : (
                <div className="space-y-4">
                  {aiCacheUsers
                    .sort((a: any, b: any) => b.totalHits - a.totalHits)
                    .slice(0, 10)
                    .map((user: any) => (
                      <div key={user.userId} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="font-medium text-sm">{user.userEmail}</div>
                            <div className="text-xs text-gray-500">{user.userPlan} plan</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-center">
                            <div className="font-semibold text-blue-600">{user.totalHits}</div>
                            <div className="text-xs text-gray-500">Total Requests</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-green-600">{user.uniqueFunctions}</div>
                            <div className="text-xs text-gray-500">Functions Used</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-purple-600">{user.avgHitsPerEntry}</div>
                            <div className="text-xs text-gray-500">Avg Hits</div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => clearUserCache(user.userId)}
                            className="text-xs"
                          >
                            Clear Cache
                          </Button>
                        </div>
                      </div>
                    ))}
                  {aiCacheUsers.length === 0 && (
                    <div className="text-center py-6 text-gray-500">No AI usage data available</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-functions" className="space-y-6">
          {/* AI Functions Usage Analytics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                AI Functions Usage Analytics
              </CardTitle>
              <CardDescription>
                Track actual OpenAI API calls, costs, and user usage patterns across all AI functions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Global AI Usage Stats */}
                <div className="md:col-span-1 space-y-4">
                  <h4 className="font-semibold text-gray-900">Global API Usage</h4>
                  <div className="space-y-3">
                    {aiGlobalStatsLoading ? (
                      <div className="text-center py-6">Loading...</div>
                    ) : (
                      <>
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            ${aiGlobalStats?.monthlyCost?.toFixed(4) || '0.0000'}
                          </div>
                          <div className="text-sm text-blue-700">Total API Costs (Month)</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {aiGlobalStats?.monthlyApiCalls?.toLocaleString() || '0'}
                          </div>
                          <div className="text-sm text-green-700">API Calls (Month)</div>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">
                            {aiGlobalStats?.monthlyUniqueUsers || 0}
                          </div>
                          <div className="text-sm text-purple-700">Unique Users</div>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-orange-600">
                            {aiGlobalStats?.errorRate?.toFixed(1) || '0.0'}%
                          </div>
                          <div className="text-sm text-orange-700">Error Rate</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* AI Functions Usage Breakdown */}
                <div className="md:col-span-2 space-y-4">
                  <h4 className="font-semibold text-gray-900">Function Usage Breakdown</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Function</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">API Calls</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Cost</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Cost</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error Rate</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {aiFunctionStatsLoading ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                              Loading function statistics...
                            </td>
                          </tr>
                        ) : aiFunctionStats.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                              No AI function usage data available yet
                            </td>
                          </tr>
                        ) : (
                          aiFunctionStats.map((func: any) => {
                            // Map function names to display info
                            const functionInfo: Record<string, any> = {
                              'categorizeExpense': { title: 'Expense Categorization', model: 'gpt-4o-mini' },
                              'generateFinancialTips': { title: 'Financial Tips', model: 'gpt-4o' },
                              'generateContextualFinancialTips': { title: 'Contextual Tips', model: 'gpt-4o' },
                              'generateDailyRecommendations': { title: 'Daily Recommendations', model: 'gpt-4o' },
                              'generateSpendingInsights': { title: 'Spending Insights', model: 'gpt-4o' },
                              'generateAIFinancialHealthScore': { title: 'Health Score', model: 'gpt-4o' },
                              'generateTrendPredictions': { title: 'Trend Predictions', model: 'gpt-4o' },
                              'generateExpensePredictions': { title: 'Expense Predictions', model: 'gpt-4o' },
                              'parseBankStatement': { title: 'Bank Statement Parser', model: 'gpt-4o' },
                              'generateFinancialMascot': { title: 'DALL-E Mascot', model: 'dall-e-3' },
                            }[func.functionName as keyof typeof functionInfo] || { title: func.functionName, model: 'unknown' };
                            
                            return (
                              <tr key={func.functionName} className="hover:bg-gray-50">
                                <td className="px-4 py-4">
                                  <div>
                                    <div className="font-medium text-sm">{functionInfo.title}</div>
                                    <div className="text-xs text-gray-500 font-mono">{func.functionName}</div>
                                    <div className="text-xs text-blue-600">{functionInfo.model}</div>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-900">{func.totalRequests.toLocaleString()}</td>
                                <td className="px-4 py-4 text-sm text-gray-900">${func.totalCost.toFixed(4)}</td>
                                <td className="px-4 py-4 text-sm text-gray-500">
                                  ${func.avgCostPerRequest.toFixed(6)}
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-500">{func.uniqueUsers}</td>
                                <td className="px-4 py-4 text-sm text-gray-500">
                                  {func.errorRate.toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Usage Limits Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-600" />
                AI Usage Limits Management
              </CardTitle>
              <CardDescription>
                Configure and manage OpenAI API usage limits per plan and individual users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Current Plan Limits */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">Plan-Based Usage Limits</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Free Plan */}
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="secondary">Free Plan</Badge>
                        <span className="text-sm text-gray-500">0 users</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Monthly API Cost:</span>
                          <span className="font-medium">$0.00</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Monthly Requests:</span>
                          <span className="font-medium">0</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          No AI features available
                        </div>
                      </div>
                    </div>

                    {/* Standard Plan */}
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="outline">Standard Plan</Badge>
                        <span className="text-sm text-gray-500">0 users</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Monthly API Cost:</span>
                          <span className="font-medium">$10.00</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Monthly Requests:</span>
                          <span className="font-medium">1,000</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          Basic AI: categorization, health score, parsing
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="w-full mt-3">
                        Edit Limits
                      </Button>
                    </div>

                    {/* Premium Plan */}
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="default">Premium Plan</Badge>
                        <span className="text-sm text-gray-500">0 users</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Monthly API Cost:</span>
                          <span className="font-medium">$25.00</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Monthly Requests:</span>
                          <span className="font-medium">5,000</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          Full AI: all functions including DALL-E
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="w-full mt-3">
                        Edit Limits
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Per-Function Limits */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">Per-Function Limits (Premium Plan)</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">AI Function</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monthly Requests</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monthly Cost</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Daily Requests</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cooldown</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {[
                          { name: 'categorizeExpense', title: 'Expense Categorization', monthlyRequests: 2000, monthlyCost: 5.00, dailyRequests: 100, cooldown: 0 },
                          { name: 'generateFinancialTips', title: 'Financial Tips', monthlyRequests: 50, monthlyCost: 8.00, dailyRequests: 5, cooldown: 3600 },
                          { name: 'generateContextualFinancialTips', title: 'Contextual Tips', monthlyRequests: 100, monthlyCost: 6.00, dailyRequests: 10, cooldown: 1800 },
                          { name: 'generateDailyRecommendations', title: 'Daily Recommendations', monthlyRequests: 100, monthlyCost: 4.00, dailyRequests: 10, cooldown: 86400 },
                          { name: 'generateSpendingInsights', title: 'Spending Insights', monthlyRequests: 50, monthlyCost: 5.00, dailyRequests: 5, cooldown: 3600 },
                          { name: 'generateAIFinancialHealthScore', title: 'Health Score', monthlyRequests: 200, monthlyCost: 3.00, dailyRequests: 20, cooldown: 0 },
                          { name: 'generateTrendPredictions', title: 'Trend Predictions', monthlyRequests: 30, monthlyCost: 6.00, dailyRequests: 3, cooldown: 7200 },
                          { name: 'generateExpensePredictions', title: 'Expense Predictions', monthlyRequests: 30, monthlyCost: 6.00, dailyRequests: 3, cooldown: 7200 },
                          { name: 'parseBankStatement', title: 'Bank Statement Parser', monthlyRequests: 50, monthlyCost: 2.00, dailyRequests: 10, cooldown: 0 },
                          { name: 'generateFinancialMascot', title: 'DALL-E Mascot', monthlyRequests: 10, monthlyCost: 2.00, dailyRequests: 2, cooldown: 86400 },
                        ].map((func) => (
                          <tr key={func.name} className="hover:bg-gray-50">
                            <td className="px-4 py-4">
                              <div className="font-medium text-sm">{func.title}</div>
                              <div className="text-xs text-gray-500 font-mono">{func.name}</div>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-900">{func.monthlyRequests.toLocaleString()}</td>
                            <td className="px-4 py-4 text-sm text-gray-900">${func.monthlyCost.toFixed(2)}</td>
                            <td className="px-4 py-4 text-sm text-gray-900">{func.dailyRequests}</td>
                            <td className="px-4 py-4 text-sm text-gray-500">
                              {func.cooldown === 0 ? 'None' : 
                               func.cooldown >= 86400 ? `${Math.floor(func.cooldown / 86400)}d` :
                               func.cooldown >= 3600 ? `${Math.floor(func.cooldown / 3600)}h` :
                               func.cooldown >= 60 ? `${Math.floor(func.cooldown / 60)}m` :
                               `${func.cooldown}s`}
                            </td>
                            <td className="px-4 py-4">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-xs"
                                onClick={() => openEditLimitDialog('premium', func.name)}
                              >
                                Edit
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* User-Specific Overrides */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">User-Specific Overrides</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h5 className="font-medium text-gray-900">Custom User Limits</h5>
                        <p className="text-sm text-gray-500">Override default plan limits for specific users</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={openAddUserOverrideDialog}>
                        Add User Override
                      </Button>
                    </div>
                    
                    {aiUserOverridesLoading ? (
                      <div className="text-center py-8 text-gray-500">Loading user overrides...</div>
                    ) : aiUserOverrides.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No user-specific overrides configured
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {aiUserOverrides.map((override: any) => (
                          <div key={`${override.userId}-${override.functionName}`} className="flex items-center justify-between p-3 bg-white rounded border">
                            <div>
                              <div className="font-medium text-sm">{override.userEmail}</div>
                              <div className="text-xs text-gray-500">{override.functionName} • {override.userPlan} plan</div>
                              {override.isBlocked && (
                                <div className="text-xs text-red-600 mt-1">🚫 Blocked: {override.reason}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right text-xs text-gray-500">
                                {override.monthlyRequestLimit && <div>Monthly: {override.monthlyRequestLimit} requests</div>}
                                {override.monthlyCostLimit && <div>Cost: ${override.monthlyCostLimit}</div>}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs text-red-600"
                                onClick={() => deleteUserOverride(override.userId, override.functionName)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Emergency Controls */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">Emergency Controls</h4>
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-red-800">Emergency API Controls</span>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      <Button variant="destructive" size="sm">
                        🚨 Disable All AI Functions
                      </Button>
                      <Button variant="outline" size="sm" className="border-red-300 text-red-700 hover:bg-red-50">
                        💰 Set Global Cost Emergency Limit
                      </Button>
                      <Button variant="outline" size="sm" className="border-orange-300 text-orange-700 hover:bg-orange-50">
                        ⚠️ Enable AI Function Monitoring Only
                      </Button>
                    </div>
                    <div className="text-xs text-red-600 mt-2">
                      Emergency controls will immediately affect all users and AI function calls
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top AI Spenders */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-orange-600" />
                Top AI API Spenders
              </CardTitle>
              <CardDescription>
                Users with highest OpenAI API costs and usage patterns for cost optimization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {aiUserStatsLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading user statistics...</div>
                ) : aiUserStats.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No AI usage data available yet. Usage tracking will appear here once AI functions are called.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {aiUserStats
                      .sort((a: any, b: any) => b.totalCost - a.totalCost)
                      .slice(0, 10)
                      .map((user: any) => (
                        <div key={user.userId} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                          <div className="flex items-center gap-4">
                            <div>
                              <div className="font-medium text-sm">{user.userEmail}</div>
                              <div className="text-xs text-gray-500">{user.userPlan} plan</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-center">
                              <div className="font-semibold text-red-600">${user.totalCost.toFixed(4)}</div>
                              <div className="text-xs text-gray-500">Total Cost</div>
                            </div>
                            <div className="text-center">
                              <div className="font-semibold text-blue-600">{user.totalRequests}</div>
                              <div className="text-xs text-gray-500">API Calls</div>
                            </div>
                            <div className="text-center">
                              <div className="font-semibold text-green-600">{user.uniqueFunctions}</div>
                              <div className="text-xs text-gray-500">Functions</div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => {
                                setEditingUserOverride({
                                  userId: user.userId,
                                  functionName: '',
                                  monthlyRequestLimit: null,
                                  monthlyCostLimit: null,
                                  dailyRequestLimit: null,
                                  dailyCostLimit: null,
                                  cooldownSeconds: null,
                                  isBlocked: false,
                                  reason: '',
                                  expiresAt: null
                                });
                                setShowUserOverrideDialog(true);
                              }}
                            >
                              Set Limits
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
                
                {/* Remove the old hidden example */}
                <div className="hidden space-y-4">
                  {/* Example structure for when data is available */}
                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-medium text-sm">user@example.com</div>
                        <div className="text-xs text-gray-500">Premium plan</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="font-semibold text-red-600">$12.45</div>
                        <div className="text-xs text-gray-500">Total Cost</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-blue-600">245</div>
                        <div className="text-xs text-gray-500">API Calls</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-green-600">7</div>
                        <div className="text-xs text-gray-500">Functions</div>
                      </div>
                      <Button variant="outline" size="sm" className="text-xs">
                        Set Limits
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit Limit Dialog */}
          <Dialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Usage Limit</DialogTitle>
                <DialogDescription>
                  Configure usage limits for {editingLimit?.plan} plan - {editingLimit?.functionName}
                </DialogDescription>
              </DialogHeader>
              {editingLimit && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="monthlyRequests">Monthly Request Limit</Label>
                    <Input
                      id="monthlyRequests"
                      type="number"
                      value={editingLimit.monthlyRequestLimit}
                      onChange={(e) => setEditingLimit({
                        ...editingLimit,
                        monthlyRequestLimit: parseInt(e.target.value) || 0
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="monthlyCost">Monthly Cost Limit ($)</Label>
                    <Input
                      id="monthlyCost"
                      type="number"
                      step="0.01"
                      value={editingLimit.monthlyCostLimit}
                      onChange={(e) => setEditingLimit({
                        ...editingLimit,
                        monthlyCostLimit: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dailyRequests">Daily Request Limit</Label>
                    <Input
                      id="dailyRequests"
                      type="number"
                      value={editingLimit.dailyRequestLimit}
                      onChange={(e) => setEditingLimit({
                        ...editingLimit,
                        dailyRequestLimit: parseInt(e.target.value) || 0
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cooldown">Cooldown (seconds)</Label>
                    <Input
                      id="cooldown"
                      type="number"
                      value={editingLimit.cooldownSeconds}
                      onChange={(e) => setEditingLimit({
                        ...editingLimit,
                        cooldownSeconds: parseInt(e.target.value) || 0
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={editingLimit.description}
                      onChange={(e) => setEditingLimit({
                        ...editingLimit,
                        description: e.target.value
                      })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={saveLimitChanges} disabled={isSavingLimit} className="flex-1">
                      {isSavingLimit ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button variant="outline" onClick={() => setShowLimitDialog(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Add/Edit User Override Dialog */}
          <Dialog open={showUserOverrideDialog} onOpenChange={setShowUserOverrideDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>User Override</DialogTitle>
                <DialogDescription>
                  Set custom AI usage limits for a specific user
                </DialogDescription>
              </DialogHeader>
              {editingUserOverride && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="userId">User ID</Label>
                    <Input
                      id="userId"
                      value={editingUserOverride.userId}
                      onChange={(e) => setEditingUserOverride({
                        ...editingUserOverride,
                        userId: e.target.value
                      })}
                      placeholder="Enter Clerk user ID"
                    />
                  </div>
                  <div>
                    <Label htmlFor="functionNameOverride">Function Name</Label>
                    <Select 
                      value={editingUserOverride.functionName} 
                      onValueChange={(value) => setEditingUserOverride({
                        ...editingUserOverride,
                        functionName: value
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select function" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="categorizeExpense">Expense Categorization</SelectItem>
                        <SelectItem value="generateFinancialTips">Financial Tips</SelectItem>
                        <SelectItem value="generateContextualFinancialTips">Contextual Tips</SelectItem>
                        <SelectItem value="generateDailyRecommendations">Daily Recommendations</SelectItem>
                        <SelectItem value="generateSpendingInsights">Spending Insights</SelectItem>
                        <SelectItem value="generateAIFinancialHealthScore">Health Score</SelectItem>
                        <SelectItem value="generateTrendPredictions">Trend Predictions</SelectItem>
                        <SelectItem value="generateExpensePredictions">Expense Predictions</SelectItem>
                        <SelectItem value="parseBankStatement">Bank Statement Parser</SelectItem>
                        <SelectItem value="generateFinancialMascot">DALL-E Mascot</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="monthlyRequestsOverride">Monthly Request Limit (optional)</Label>
                    <Input
                      id="monthlyRequestsOverride"
                      type="number"
                      value={editingUserOverride.monthlyRequestLimit || ''}
                      onChange={(e) => setEditingUserOverride({
                        ...editingUserOverride,
                        monthlyRequestLimit: e.target.value ? parseInt(e.target.value) : null
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="monthlyCostOverride">Monthly Cost Limit ($, optional)</Label>
                    <Input
                      id="monthlyCostOverride"
                      type="number"
                      step="0.01"
                      value={editingUserOverride.monthlyCostLimit || ''}
                      onChange={(e) => setEditingUserOverride({
                        ...editingUserOverride,
                        monthlyCostLimit: e.target.value || null
                      })}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isBlocked"
                      checked={editingUserOverride.isBlocked}
                      onChange={(e) => setEditingUserOverride({
                        ...editingUserOverride,
                        isBlocked: e.target.checked
                      })}
                    />
                    <Label htmlFor="isBlocked">Block user from this function</Label>
                  </div>
                  {editingUserOverride.isBlocked && (
                    <div>
                      <Label htmlFor="reason">Reason for blocking</Label>
                      <Input
                        id="reason"
                        value={editingUserOverride.reason}
                        onChange={(e) => setEditingUserOverride({
                          ...editingUserOverride,
                          reason: e.target.value
                        })}
                        placeholder="Enter reason for blocking"
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button onClick={saveUserOverrideChanges} disabled={isSavingUserOverride} className="flex-1">
                      {isSavingUserOverride ? "Saving..." : "Save Override"}
                    </Button>
                    <Button variant="outline" onClick={() => setShowUserOverrideDialog(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Analytics</CardTitle>
              <CardDescription>
                Detailed analytics and insights coming soon
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Advanced analytics dashboard will be available in the next update</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="country-blocking" className="space-y-4">
          <CountryBlockingPanel />
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}