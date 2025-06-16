
import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useUser, UserProfile, UserButton } from "@clerk/clerk-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Switch } from "../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../components/ui/alert-dialog";
import { useToast } from "../hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  User, 
  Bell, 
  Shield, 
  Palette, 
  Download, 
  Crown, 
  Mail,
  Phone,
  Globe,
  CreditCard,
  Trash2,
  Camera,
  Save,
  Lock
} from "lucide-react";

interface UserSettings {
  notifications: {
    email: boolean;
    push: boolean;
    transactionReminders: boolean;
    budgetAlerts: boolean;
    weeklyReports: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'private';
    dataCollection: boolean;
    analytics: boolean;
  };
  preferences: {
    theme: 'light' | 'dark' | 'system';
    currency: string;
    language: string;
    dateFormat: string;
    dashboardLayout: 'compact' | 'comfortable';
  };
}

export default function ProfilePage() {
  const { user, clerkUser } = useAuth();
  const { user: clerkUserDirect } = useUser();
  const { toast } = useToast();
  
  // Form states
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    website: ''
  });

  // Update form data when user data loads
  useEffect(() => {
    if (user && clerkUser) {
      setProfileData({
        firstName: clerkUser.firstName || user.firstName || '',
        lastName: clerkUser.lastName || user.lastName || '',
        email: clerkUser.emailAddresses?.[0]?.emailAddress || user.email || '',
        phone: clerkUser.phoneNumbers?.[0]?.phoneNumber || user.phone || '',
        website: user.website || ''
      });
    }
  }, [user, clerkUser]);



  const [settings, setSettings] = useState<UserSettings>({
    notifications: {
      email: true,
      push: true,
      transactionReminders: true,
      budgetAlerts: true,
      weeklyReports: false
    },
    privacy: {
      profileVisibility: 'private',
      dataCollection: true,
      analytics: true
    },
    preferences: {
      theme: 'system',
      currency: 'USD',
      language: 'en',
      dateFormat: 'MM/DD/YYYY',
      dashboardLayout: 'comfortable'
    }
  });

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof profileData) => {
      const response = await apiRequest('PUT', '/api/profile', data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }
      return response.json();
    },
    onSuccess: (result) => {
      // Invalidate user auth cache to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      
      // Update local state with the new data
      setProfileData({
        firstName: result.firstName || '',
        lastName: result.lastName || '',
        email: result.email || '',
        phone: result.phone || '',
        website: result.website || ''
      });
      
      toast({ title: "Profile updated successfully" });
    },
    onError: (error: Error) => {
      console.error('Profile update error:', error);
      toast({ 
        title: "Failed to update profile", 
        description: error.message || "Please try again later",
        variant: "destructive" 
      });
    }
  });



  const updateSettingsMutation = useMutation({
    mutationFn: async (data: UserSettings) => {
      const response = await fetch('/api/user-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Settings updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update settings", variant: "destructive" });
    }
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileData);
  };



  const handleSettingsUpdate = (section: keyof UserSettings, key: string, value: any) => {
    const newSettings = {
      ...settings,
      [section]: {
        ...settings[section],
        [key]: value
      }
    };
    setSettings(newSettings);
    updateSettingsMutation.mutate(newSettings);
  };

  const currencies = [
    { code: 'USD', name: 'US Dollar ($)' },
    { code: 'EUR', name: 'Euro (€)' },
    { code: 'GBP', name: 'British Pound (£)' },
    { code: 'JPY', name: 'Japanese Yen (¥)' },
    { code: 'CAD', name: 'Canadian Dollar (C$)' },
    { code: 'AUD', name: 'Australian Dollar (A$)' }
  ];

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <Avatar className="h-20 w-20">
          <AvatarImage src={user?.profileImageUrl} alt={user?.firstName || "User"} />
          <AvatarFallback className="bg-primary text-white text-xl">
            {user?.firstName?.[0] || user?.email?.[0] || "U"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Profile Settings</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
          <div className="flex items-center gap-2 mt-2">
            {user?.plan === 'premium' ? (
              <Badge className="bg-premium text-white">
                <Crown className="h-3 w-3 mr-1" />
                Premium
              </Badge>
            ) : user?.plan === 'standard' ? (
              <Badge className="bg-blue-600 text-white">
                <Crown className="h-3 w-3 mr-1" />
                Standard
              </Badge>
            ) : (
              <Badge variant="secondary">Free Plan</Badge>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm">
          <Camera className="h-4 w-4 mr-2" />
          Change Photo
        </Button>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security">
            <Lock className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="preferences">
            <Palette className="h-4 w-4 mr-2" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="subscription">
            <CreditCard className="h-4 w-4 mr-2" />
            Subscription
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Manage your profile details, name, email addresses, and connected accounts through Clerk's secure interface
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden min-h-[600px]">
                <UserProfile 
                  routing="hash"
                  appearance={{
                    elements: {
                      rootBox: "w-full min-h-[500px]",
                      card: "border-0 shadow-none min-h-[500px]",
                      navbar: "hidden",
                      pageScrollBox: "p-4 min-h-[400px]",
                      profileSectionPrimaryButton: "bg-primary hover:bg-primary/90",
                      formButtonPrimary: "bg-primary hover:bg-primary/90"
                    }
                  }}
                />
              </div>
              
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Profile Management</h4>
                <p className="text-sm text-muted-foreground">
                  Use the interface above to update your:
                </p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li>• Full name and profile picture</li>
                  <li>• Email addresses and verification</li>
                  <li>• Username and display preferences</li>
                  <li>• Connected social accounts</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Security</CardTitle>
                <CardDescription>
                  Manage your password, two-factor authentication, and security settings through Clerk's secure interface
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden min-h-[600px]">
                  <UserProfile 
                    routing="hash"
                    path="/security"
                    appearance={{
                      elements: {
                        rootBox: "w-full min-h-[500px]",
                        card: "border-0 shadow-none min-h-[500px]",
                        navbar: "hidden", // Hide navbar to show only security content
                        pageScrollBox: "p-4 min-h-[400px]",
                        profileSectionPrimaryButton: "bg-primary hover:bg-primary/90",
                        formButtonPrimary: "bg-primary hover:bg-primary/90"
                      }
                    }}
                  />
                </div>
                
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Security Features</h4>
                  <p className="text-sm text-muted-foreground">
                    Use the security interface above to manage:
                  </p>
                  <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                    <li>• Change your account password</li>
                    <li>• Enable two-factor authentication (2FA)</li>
                    <li>• View active sessions and devices</li>
                    <li>• Review security activity logs</li>
                    <li>• Manage backup codes</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Privacy Settings</CardTitle>
                <CardDescription>
                  Control how your data is used and shared
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Profile Visibility</Label>
                    <p className="text-sm text-muted-foreground">
                      Control who can see your profile information
                    </p>
                  </div>
                  <Select
                    value={settings.privacy.profileVisibility}
                    onValueChange={(value: 'public' | 'private') => 
                      handleSettingsUpdate('privacy', 'profileVisibility', value)
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="public">Public</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Data Collection</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow us to collect usage data to improve the service
                    </p>
                  </div>
                  <Switch
                    checked={settings.privacy.dataCollection}
                    onCheckedChange={(checked) => 
                      handleSettingsUpdate('privacy', 'dataCollection', checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Analytics</Label>
                    <p className="text-sm text-muted-foreground">
                      Help us understand app usage patterns
                    </p>
                  </div>
                  <Switch
                    checked={settings.privacy.analytics}
                    onCheckedChange={(checked) => 
                      handleSettingsUpdate('privacy', 'analytics', checked)
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how you want to be notified about important updates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.email}
                  onCheckedChange={(checked) => 
                    handleSettingsUpdate('notifications', 'email', checked)
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive push notifications in your browser
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.push}
                  onCheckedChange={(checked) => 
                    handleSettingsUpdate('notifications', 'push', checked)
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Transaction Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Get reminders for upcoming transactions
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.transactionReminders}
                  onCheckedChange={(checked) => 
                    handleSettingsUpdate('notifications', 'transactionReminders', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Budget Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when approaching budget limits
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.budgetAlerts}
                  onCheckedChange={(checked) => 
                    handleSettingsUpdate('notifications', 'budgetAlerts', checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Weekly Reports</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive weekly financial summary reports
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.weeklyReports}
                  onCheckedChange={(checked) => 
                    handleSettingsUpdate('notifications', 'weeklyReports', checked)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>App Preferences</CardTitle>
              <CardDescription>
                Customize your app experience and display settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select
                    value={settings.preferences.theme}
                    onValueChange={(value: 'light' | 'dark' | 'system') => 
                      handleSettingsUpdate('preferences', 'theme', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select
                    value={settings.preferences.currency}
                    onValueChange={(value) => 
                      handleSettingsUpdate('preferences', 'currency', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select
                    value={settings.preferences.language}
                    onValueChange={(value) => 
                      handleSettingsUpdate('preferences', 'language', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Date Format</Label>
                  <Select
                    value={settings.preferences.dateFormat}
                    onValueChange={(value) => 
                      handleSettingsUpdate('preferences', 'dateFormat', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Dashboard Layout</Label>
                <Select
                  value={settings.preferences.dashboardLayout}
                  onValueChange={(value: 'compact' | 'comfortable') => 
                    handleSettingsUpdate('preferences', 'dashboardLayout', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="comfortable">Comfortable</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Choose how dense you want the dashboard information to be
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Current Plan</CardTitle>
                <CardDescription>
                  Manage your subscription and billing information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {user?.plan === 'premium' ? (
                      <Badge className="bg-premium text-white">
                        <Crown className="h-4 w-4 mr-1" />
                        Premium Plan
                      </Badge>
                    ) : user?.plan === 'standard' ? (
                      <Badge className="bg-blue-600 text-white">
                        <Crown className="h-4 w-4 mr-1" />
                        Standard Plan
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Free Plan</Badge>
                    )}
                    <div>
                      <p className="font-medium">
                        {user?.plan === 'premium' && '$9.99/month'}
                        {user?.plan === 'standard' && '$4.99/month'}
                        {user?.plan === 'free' && 'Free'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {user?.plan !== 'free' ? 'Next billing date: January 15, 2025' : 'No billing required'}
                      </p>
                    </div>
                  </div>
                  {user?.plan !== 'premium' ? (
                    <Button>
                      <Crown className="h-4 w-4 mr-2" />
                      Upgrade Plan
                    </Button>
                  ) : (
                    <Button variant="outline">
                      Manage Billing
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {user?.plan !== 'free' && (
              <Card>
                <CardHeader>
                  <CardTitle>Billing Information</CardTitle>
                  <CardDescription>
                    Your payment method and billing history
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">•••• •••• •••• 4242</p>
                        <p className="text-sm text-muted-foreground">Expires 12/26</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Update
                    </Button>
                  </div>
                  
                  <Button variant="outline" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download Billing History
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>
                  Irreversible actions that will affect your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {user?.plan !== 'free' && (
                  <div className="flex items-center justify-between p-3 border border-orange-200 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                    <div>
                      <p className="font-medium">Cancel Subscription</p>
                      <p className="text-sm text-muted-foreground">
                        You'll lose access to premium features at the end of your billing period
                      </p>
                    </div>
                    <Button variant="outline">
                      Cancel Plan
                    </Button>
                  </div>
                )}
                
                <div className="flex items-center justify-between p-3 border border-destructive rounded-lg bg-destructive/5">
                  <div>
                    <p className="font-medium">Delete Account</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your account and all associated data
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete your account
                          and remove all your data from our servers.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive hover:bg-destructive/90">
                          Delete Account
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
