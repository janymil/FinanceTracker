import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useUser, UserProfile, UserButton } from "@clerk/clerk-react";
import { useClerkUserReady } from "../hooks/useClerkUserReady";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { useToast } from "../hooks/use-toast";
import { User, Bell, Palette, CreditCard, ExternalLink, Settings, Trash2 } from "@/lib/icons-registry";
import { SubscriptionSchedule } from "../components/subscription-schedule";

export default function ProfilePage() {
  const { user } = useUser();
  const { user: authUser } = useAuth();
  const { getAuthHeaders } = useClerkUserReady();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  if (!user || !authUser) {
    return <div>Loading...</div>;
  }

  const handleManageSubscription = async () => {
    setIsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/create-customer-portal-session', {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 400 && errorData.message?.includes('No active subscription')) {
          // User doesn't have Stripe subscription - redirect to pricing page
          toast({
            title: "No Stripe Subscription",
            description: "You currently have premium access but no Stripe subscription. Contact support or visit the pricing page to set up billing.",
            variant: "destructive",
          });
          return;
        }
        throw new Error(errorData.message || 'Failed to create customer portal session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error: any) {
      console.error('Error creating customer portal session:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      toast({
        title: "Error",
        description: `Failed to open subscription management: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      {/* User Profile Header */}
      <div className="flex items-center space-x-4 mb-8 p-6 border rounded-lg bg-card">
        <Avatar className="h-20 w-20">
          <AvatarImage src={user.imageUrl} alt={user.fullName || "User"} />
          <AvatarFallback>
            {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.primaryEmailAddress?.emailAddress.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h2 className="text-2xl font-semibold">{user.fullName || "User"}</h2>
          <p className="text-muted-foreground">{user.primaryEmailAddress?.emailAddress}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="bg-premium text-premium-foreground">
              {authUser.plan || 'Free'} Plan
            </Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center gap-1 text-xs md:text-sm">
            <User className="h-3 w-3 md:h-4 md:w-4" />
            <span>Profile</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1 text-xs md:text-sm">
            <Bell className="h-3 w-3 md:h-4 md:w-4" />
            <span>Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-1 text-xs md:text-sm">
            <Palette className="h-3 w-3 md:h-4 md:w-4" />
            <span>Preferences</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center gap-1 text-xs md:text-sm">
            <CreditCard className="h-3 w-3 md:h-4 md:w-4" />
            <span>Subscription</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Account Management</CardTitle>
              <CardDescription>
                Manage your profile details, security settings, password, and connected accounts through Clerk's secure interface
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Mobile Navigation Hint */}
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg md:hidden">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  💡 <strong>Tip:</strong> Use the menu button (☰) in the top-left corner below to access Account Settings and Security options.
                </p>
              </div>
              
              {/* Clerk UserProfile with improved mobile styling */}
              <div className="clerk-profile-mobile w-full overflow-x-auto">
                <div className="min-w-[600px] md:min-w-0">
                  <UserProfile />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Manage your notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Notification settings will be managed here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>
                Customize your app preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>App preferences will be managed here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Management</CardTitle>
              <CardDescription>
                Manage your subscription plan, billing, and payment methods
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Subscription Schedule - Shows upcoming plan changes */}
              <SubscriptionSchedule />

              {/* Current Plan Status */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-semibold text-lg">Current Plan</h3>
                  <p className="text-muted-foreground">
                    You are currently on the {authUser.plan || 'Free'} plan
                  </p>
                </div>
                <Badge variant="secondary" className="bg-premium text-premium-foreground">
                  {authUser.plan || 'Free'}
                </Badge>
              </div>

              {/* Plan Features */}
              <div className="grid gap-4">
                <h4 className="font-medium">Plan Features</h4>
                {authUser.plan === 'free' && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• Basic expense and income tracking</p>
                    <p>• Manual categorization</p>
                    <p>• Up to 100 transaction entries</p>
                    <p>• Simple financial overview</p>
                    <p>• Personalized financial tips</p>
                  </div>
                )}
                {authUser.plan === 'standard' && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• Everything in Free plan</p>
                    <p>• Goals and budget management</p>
                    <p>• Interactive charts and reports</p>
                    <p>• AI expense categorization</p>
                    <p>• Receipt OCR scanning</p>
                    <p>• Mobile QR code upload</p>
                    <p>• Calendar view and reminders</p>
                    <p>• Unlimited transaction history</p>
                  </div>
                )}
                {authUser.plan === 'premium' && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• Everything in Standard plan</p>
                    <p>• AI financial tips and insights</p>
                    <p>• Advanced trends analysis</p>
                    <p>• Expense prediction</p>
                    <p>• Daily personalized recommendations</p>
                    <p>• Cloud receipt storage</p>
                    <p>• Cloud data backup</p>
                    <p>• Data management (CSV, PDF)</p>
                    <p>• Priority email support</p>
                  </div>
                )}
              </div>

              {/* Subscription Management Actions */}
              {authUser.plan !== 'free' && (
                <div className="space-y-4">
                  <h4 className="font-medium">Subscription Management</h4>
                  <div className="grid gap-3">
                    <Button
                      onClick={handleManageSubscription}
                      disabled={isLoading}
                      className="flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      {isLoading ? 'Opening...' : 'Manage Subscription'}
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                    <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        <strong>Note:</strong> If you received premium access through admin upgrade or special promotion, 
                        you may not have a Stripe subscription to manage. Contact support if you need billing assistance.
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This will open Stripe's secure customer portal where you can:
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                      <li>• Update payment methods</li>
                      <li>• Change subscription plan</li>
                      <li>• View billing history</li>
                      <li>• Download invoices</li>
                      <li>• Cancel subscription</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Upgrade Options for Free Users */}
              {authUser.plan === 'free' && (
                <div className="space-y-4">
                  <h4 className="font-medium">Upgrade Your Plan</h4>
                  <div className="grid gap-3">
                    <Button
                      onClick={() => window.location.href = '/subscribe'}
                      className="flex items-center gap-2"
                    >
                      <CreditCard className="h-4 w-4" />
                      View Pricing Plans
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Upgrade to Standard ($4.99/month) or Premium ($9.99/month) for advanced features
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}