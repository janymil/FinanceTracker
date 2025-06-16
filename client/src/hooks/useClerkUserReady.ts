import { useUser } from "@clerk/clerk-react";

export function useClerkUserReady() {
  const { isLoaded, isSignedIn, user } = useUser();
  
  // Only consider ready when Clerk is fully loaded AND user is signed in AND user data exists
  const isReady = isLoaded && isSignedIn && !!user?.id;
  
  // Remove excessive auth logging

  return { isReady, user, isLoaded, isSignedIn };
}