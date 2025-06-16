import { useUser } from "@clerk/clerk-react";

export function useClerkUserReady() {
  const { isLoaded, isSignedIn, user } = useUser();
  
  // Only consider ready when Clerk is fully loaded AND user is signed in AND user data exists
  const isReady = isLoaded && isSignedIn && !!user?.id;
  
  // For debugging authentication timing issues
  if (process.env.NODE_ENV === 'development') {
    console.log('Clerk Auth State:', { isLoaded, isSignedIn, hasUserId: !!user?.id, isReady });
  }

  return { isReady, user, isLoaded, isSignedIn };
}