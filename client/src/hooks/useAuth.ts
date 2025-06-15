import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export function useAuth() {
  const { user: clerkUser, isLoaded: userLoaded } = useUser();
  const { isSignedIn, isLoaded: authLoaded } = useClerkAuth();
  
  // Get our database user record that syncs with Clerk
  const { data: user, isLoading: dbUserLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!clerkUser && isSignedIn,
    retry: (failureCount, error: any) => {
      return failureCount < 3 && error?.status !== 401;
    },
    staleTime: 5 * 60 * 1000, // Increase stale time to 5 minutes
    refetchOnWindowFocus: true, // Re-enable refetch on focus to handle reconnections
    refetchInterval: false,
    // Add retry delay to handle temporary server issues
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const isLoading = !userLoaded || !authLoaded || (isSignedIn && dbUserLoading);
  const isAuthenticated = !!isSignedIn && !!clerkUser && !!user;
  const isUnauthenticated = authLoaded && !isSignedIn;

  return {
    user,
    clerkUser,
    isLoading,
    isAuthenticated,
    isUnauthenticated,
  };
}