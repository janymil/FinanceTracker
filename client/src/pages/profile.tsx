import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useUser, UserProfile, UserButton } from "@clerk/clerk-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { User, Bell, Palette, CreditCard } from "lucide-react";

export default function ProfilePage() {
  const { user } = useUser();
  const { user: authUser } = useAuth();

  if (!user || !authUser) {
    return <div>Loading...</div>;
  }

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
            <span className="hidden sm:inline">Profile</span>
            <span className="sm:hidden">Prof</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1 text-xs md:text-sm">
            <Bell className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Notifications</span>
            <span className="sm:hidden">Not</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-1 text-xs md:text-sm">
            <Palette className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Preferences</span>
            <span className="sm:hidden">Pref</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center gap-1 text-xs md:text-sm">
            <CreditCard className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Subscription</span>
            <span className="sm:hidden">Sub</span>
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
              <UserProfile />
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
              <CardTitle>Subscription</CardTitle>
              <CardDescription>
                Manage your subscription plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Current Plan: {authUser.plan || 'Free'}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}