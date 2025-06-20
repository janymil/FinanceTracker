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
import { Users, UserPlus, Edit, Trash2, Crown, Shield, TrendingUp, Search, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

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
        title: "Success",
        description: "Admin login successful",
      });
    } catch (error) {
      toast({
        title: "Error",
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
      
      await queryClient.invalidateQueries({ queryKey: ['/api/admin-analytics/users'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/admin-analytics/overview'] });
      setNewUser({ email: "", firstName: "", lastName: "", plan: "free" });
      toast({
        title: "Success",
        description: "User created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
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
      const response = await fetch(`/api/admin-analytics/users/${id}/plan`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update user plan');
      }
      
      await queryClient.invalidateQueries({ queryKey: ['/api/admin-analytics/users'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/admin-analytics/overview'] });
      setEditingUser(null);
      toast({
        title: "Success",
        description: "User plan updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user plan",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const deleteUser = async (userId: string) => {
    setIsDeletingUser(true);
    try {
      const response = await fetch(`/api/admin-analytics/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete user');
      }
      
      await queryClient.invalidateQueries({ queryKey: ['/api/admin-analytics/users'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/admin-analytics/overview'] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setIsDeletingUser(false);
    }
  };

  const syncUsersFromClerk = async () => {
    setIsSyncingUsers(true);
    try {
      const response = await fetch('/api/admin-analytics/sync-users', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to sync users');
      }
      
      const result = await response.json();
      
      await queryClient.invalidateQueries({ queryKey: ['/api/admin-analytics/users'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/admin-analytics/overview'] });
      
      toast({
        title: "Success",
        description: `${result.message}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sync users from Clerk",
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Shield className="h-12 w-12 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">FinanzerPro Admin Access</CardTitle>
            <CardDescription>
              Authorized administrator login for FinanzerPro system analytics
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Security Notice */}
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Internal Admin Portal</strong><br />
                  This is the official FinanzerPro administrative interface for authorized personnel only.
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
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">System Analytics</h1>
            <p className="text-gray-600">Monitor application metrics and user management</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-3">
          <TabsTrigger value="overview" className="text-xs md:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="users" className="text-xs md:text-sm">User Management</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs md:text-sm">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

        <TabsContent value="users" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-full sm:w-80"
                />
              </div>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Filter by plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="prod">Production</SelectItem>
                  <SelectItem value="dev">Development</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add User
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

          <Card>
            <CardHeader>
              <CardTitle>Users ({filteredUsers.length})</CardTitle>
              <CardDescription>
                Manage user accounts and subscriptions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user: User) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          {user.profileImageUrl ? (
                            <img
                              src={user.profileImageUrl}
                              alt="Profile"
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <Users className="h-4 w-4 text-gray-500" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium">
                              {user.firstName && user.lastName 
                                ? `${user.firstName} ${user.lastName}`
                                : user.firstName || user.lastName
                                ? (user.firstName || '') + ' ' + (user.lastName || '')
                                : user.email?.includes('@clerk.user') 
                                ? user.id?.split('_')[1]?.slice(0, 8) || 'Anonymous'
                                : user.email?.split('@')[0] || 'Anonymous'
                              }
                            </div>
                            <div className="text-sm text-gray-500 flex items-center gap-2">
                              {isProductionUser(user.id) ? (
                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">PROD</span>
                              ) : (
                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">DEV</span>
                              )}
                              <span className="truncate max-w-32">{user.id}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.email || "No email"}</TableCell>
                      <TableCell>{getPlanBadge(user.plan)}</TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setEditingUser(user)}
                              >
                                <Edit className="h-4 w-4" />
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
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4 text-red-600" />
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
            </CardContent>
          </Card>
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
      </Tabs>
    </div>
  );
}