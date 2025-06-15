
import { SignInButton, SignUpButton, SignOutButton, UserButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { useClerkAuth } from "@/hooks/useClerkAuth";

export function ClerkAuthButtons() {
  const { isAuthenticated, isLoading } = useClerkAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-4">
        <UserButton afterSignOutUrl="/" />
        <SignOutButton>
          <Button variant="outline">Sign Out</Button>
        </SignOutButton>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <SignInButton mode="modal">
        <Button variant="outline">Sign In with Clerk</Button>
      </SignInButton>
      <SignUpButton mode="modal">
        <Button>Sign Up with Clerk</Button>
      </SignUpButton>
    </div>
  );
}
