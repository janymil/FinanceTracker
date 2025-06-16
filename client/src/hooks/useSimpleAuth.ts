import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";

export function useSimpleAuth() {
  const { user: clerkUser, isLoaded: userLoaded } = useUser();
  const { isSignedIn, isLoaded: authLoaded } = useClerkAuth();
  
  const isLoading = !userLoaded || !authLoaded;
  const isAuthenticated = !!isSignedIn && !!clerkUser && userLoaded && authLoaded;
  const isUnauthenticated = authLoaded && !isSignedIn;

  return {
    user: clerkUser,
    clerkUser,
    isLoading,
    isAuthenticated,
    isUnauthenticated,
  };
}