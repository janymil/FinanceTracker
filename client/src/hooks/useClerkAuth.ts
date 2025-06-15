
import { useUser, useAuth as useClerkAuthOriginal } from "@clerk/clerk-react";

export function useClerkAuth() {
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn, isLoaded: authLoaded } = useClerkAuthOriginal();

  return {
    user,
    isLoading: !userLoaded || !authLoaded,
    isAuthenticated: !!isSignedIn && !!user,
    isUnauthenticated: authLoaded && !isSignedIn,
  };
}
