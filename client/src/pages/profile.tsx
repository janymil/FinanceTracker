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
import { User, Bell, Palette, CreditCard, ExternalLink, Settings, Trash2 } from "lucide-react";
import { SubscriptionSchedule } from "../components/subscription-schedule";
import { useTranslation } from "react-i18next";

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useUser();
  const { user: authUser } = useAuth();
  const { getAuthHeaders } = useClerkUserReady();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  if (!user || !authUser) {
    return <div>{t('profile.Loading...')}</div>;
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
          toast({
            title: t('profile.No Stripe Subscription'),
            description: t('You currently have premium access but no Stripe subscription. Contact support or visit the pricing page to set up billing.'),
            variant: "destructive",
          });
          return;
        }
        throw new Error(errorData.message || t('Failed to create customer portal session'));
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error: any) {
      console.error('Error creating customer portal session:', error);
      const errorMessage = error?.message || t('Unknown error occurred');
      toast({
        title: t('Error'),
        description: t('Failed to open subscription management: {{errorMessage}}', { errorMessage }),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('Profile Settings')}</h1>
        <p className="text-muted-foreground">
          {t('Manage your account settings and preferences')}
        </p>
      </div>

      {/* User Profile Header */}
      <div className="flex items-center space-x-4 mb-8 p-6 border rounded-lg bg-card">
        <Avatar className="h-20 w-20">
          <AvatarImage src={user.imageUrl} alt={user.fullName || t('User')} />
          <AvatarFallback>
            {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.primaryEmailAddress?.emailAddress.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h2 className="text-2xl font-semibold">{user.fullName || t('User')}</h2>
          <p className="text-muted-foreground">{user.primaryEmailAddress?.emailAddress}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="bg-premium text-premium-foreground">
              {t('{{plan}} Plan', { plan: authUser.plan || 'Free' })}
            </Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center gap-1 text-xs md:text-sm">
            <User className="h-3 w-3 md:h-4 md:w-4" />
            <span>{t('Profile')}</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1 text-xs md:text-sm">
            <Bell className="h-3 w-3 md:h-4 md:w-4" />
            <span>{t('Notifications')}</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-1 text-xs md:text-sm">
            <Palette className="h-3 w-3 md:h-4 md:w-4" />
            <span>{t('Preferences')}</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center gap-1 text-xs md:text-sm">
            <CreditCard className="h-3 w-3 md:h-4 md:w-4" />
            <span>{t('Subscription')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>{t('Account Management')}</CardTitle>
              <CardDescription>
                {t("Manage your profile details, security settings, password, and connected accounts through Clerk's secure interface")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Mobile Navigation Hint */}
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg md:hidden">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  💡 <strong>{t('Tip')}:</strong> {t('Use the menu button (☰) in the top-left corner below to access Account Settings and Security options.')}
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
              <CardTitle>{t('Notification Settings')}</CardTitle>
              <CardDescription>
                {t('Manage your notification preferences')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>{t('Notification settings will be managed here.')}</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>{t('Preferences')}</CardTitle>
              <CardDescription>
                {t('Customize your app preferences')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>{t('App preferences will be managed here.')}</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <Card>
            <CardHeader>
              <CardTitle>{t('Subscription Management')}</CardTitle>
              <CardDescription>
                {t('Manage your subscription plan, billing, and payment methods')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Subscription Schedule - Shows upcoming plan changes */}
              <SubscriptionSchedule />

              {/* Current Plan Status */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-semibold text-lg">{t('Current Plan')}</h3>
                  <p className="text-muted-foreground">
                    {t('You are currently on the {{plan}} plan', { plan: authUser.plan || 'Free' })}
                  </p>
                </div>
                <Badge variant="secondary" className="bg-premium text-premium-foreground">
                  {t(authUser.plan || 'Free')}
                </Badge>
              </div>

              {/* Plan Features */}
              <div className="grid gap-4">
                <h4 className="font-medium">{t('Plan Features')}</h4>
                {authUser.plan === 'free' && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>{t('• Basic expense and income tracking')}</p>
                    <p>{t('• Manual categorization')}</p>
                    <p>{t('• Up to 100 transaction entries')}</p>
                    <p>{t('• Simple financial overview')}</p>
                    <p>{t('• Personalized financial tips')}</p>
                  </div>
                )}
                {authUser.plan === 'standard' && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>{t('• Everything in Free plan')}</p>
                    <p>{t('• Goals and budget management')}</p>
                    <p>{t('• Interactive charts and reports')}</p>
                    <p>{t('• AI expense categorization')}</p>
                    <p>{t('• Receipt OCR scanning')}</p>
                    <p>{t('• Mobile QR code upload')}</p>
                    <p>{t('• Calendar view and reminders')}</p>
                    <p>{t('• Unlimited transaction history')}</p>
                  </div>
                )}
                {authUser.plan === 'premium' && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>{t('• Everything in Standard plan')}</p>
                    <p>{t('• AI financial tips and insights')}</p>
                    <p>{t('• Advanced trends analysis')}</p>
                    <p>{t('• Expense prediction')}</p>
                    <p>{t('• Daily personalized recommendations')}</p>
                    <p>{t('• Cloud receipt storage')}</p>
                    <p>{t('• Cloud data backup')}</p>
                    <p>{t('• Data management (CSV, PDF)')}</p>
                    <p>{t('• Priority email support')}</p>
                  </div>
                )}
              </div>

              {/* Subscription Management Actions */}
              {authUser.plan !== 'free' && (
                <div className="space-y-4">
                  <h4 className="font-medium">{t('Subscription Management')}</h4>
                  <div className="grid gap-3">
                    <Button
                      onClick={handleManageSubscription}
                      disabled={isLoading}
                      className="flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      {isLoading ? t('Opening...') : t('Manage Subscription')}
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                    <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        <strong>{t('Note')}:</strong> {t('If you received premium access through admin upgrade or special promotion, you may not have a Stripe subscription to manage. Contact support if you need billing assistance.')}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("This will open Stripe's secure customer portal where you can:")}
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                      <li>{t('• Update payment methods')}</li>
                      <li>{t('• Change subscription plan')}</li>
                      <li>{t('• View billing history')}</li>
                      <li>{t('• Download invoices')}</li>
                      <li>{t('• Cancel subscription')}</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Upgrade Options for Free Users */}
              {authUser.plan === 'free' && (
                <div className="space-y-4">
                  <h4 className="font-medium">{t('Upgrade Your Plan')}</h4>
                  <div className="grid gap-3">
                    <Button
                      onClick={() => window.location.href = '/subscribe'}
                      className="flex items-center gap-2"
                    >
                      <CreditCard className="h-4 w-4" />
                      {t('View Pricing Plans')}
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {t('Upgrade to Standard ($4.99/month) or Premium ($9.99/month) for advanced features')}
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