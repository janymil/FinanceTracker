import { useUser, useAuth, SignInButton, SignUpButton, UserButton } from "@clerk/clerk-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ClerkTest() {
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();

  if (!userLoaded || !authLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading Clerk...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Clerk Authentication Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSignedIn && user ? (
            <div className="space-y-4">
              <div className="text-center">
                <UserButton afterSignOutUrl="/clerk-test" />
              </div>
              <div className="space-y-2">
                <p><strong>Status:</strong> ✅ Signed In</p>
                <p><strong>User ID:</strong> {user.id}</p>
                <p><strong>Email:</strong> {user.primaryEmailAddress?.emailAddress}</p>
                <p><strong>First Name:</strong> {user.firstName}</p>
                <p><strong>Last Name:</strong> {user.lastName}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-center text-gray-600">Not signed in</p>
              <div className="flex gap-2">
                <SignInButton mode="modal">
                  <Button variant="outline" className="flex-1">Sign In</Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button className="flex-1">Sign Up</Button>
                </SignUpButton>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}