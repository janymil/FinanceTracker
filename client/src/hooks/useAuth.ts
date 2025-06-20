import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export function useAuth() {
  const { user: clerkUser, isLoaded: userLoaded } = useUser();
  const { isSignedIn, isLoaded: authLoaded } = useClerkAuth();
  
  // Simple authentication state based on Clerk
  const isAuthenticated = userLoaded && authLoaded && isSignedIn && !!clerkUser?.id;
  const isUnauthenticated = authLoaded && !isSignedIn;
  const isLoading = !userLoaded || !authLoaded;

  // Get database user record - only when authenticated
  const { data: user, isLoading: dbUserLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn(),
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    user,
    clerkUser,
    isLoading: isLoading || (isAuthenticated && dbUserLoading),
    isAuthenticated: isAuthenticated && !!user,
    isUnauthenticated,
  };
}