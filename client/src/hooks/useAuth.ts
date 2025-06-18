import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn, clearUserSession, clearCacheOnUserChange } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { useEffect } from "react";

export function useAuth() {
  const { user: clerkUser, isLoaded: userLoaded } = useUser();
  const { isSignedIn, isLoaded: authLoaded, signOut } = useClerkAuth();
  
  // Don't proceed if Clerk isn't loaded yet
  if (!userLoaded || !authLoaded) {
    return {
      user: null,
      clerkUser: null,
      isLoading: true,
      isAuthenticated: false,
      isUnauthenticated: false,
    };
  }
  
  // Clear authentication state on JWT errors to force re-authentication
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'clerk-db-jwt-error') {
        console.log('JWT error detected, clearing authentication');
        signOut();
        localStorage.removeItem('clerk-db-jwt-error');
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [signOut]);
  
  // Get our database user record that syncs with Clerk
  const canFetchUser = userLoaded && authLoaded && isSignedIn && !!clerkUser?.id;
  
  const { data: user, isLoading: dbUserLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ 
      on401: "returnNull"
    }),
    enabled: canFetchUser,
    retry: (failureCount, error: any) => {
      // Don't retry on JWT/auth errors
      if (error?.message?.includes('jwt') || error?.message?.includes('token') || error?.status === 401) {
        return false;
      }
      return failureCount < 3;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: false,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const isLoading = !userLoaded || !authLoaded || dbUserLoading;
  const isAuthenticated = canFetchUser && !!user?.id;
  const isUnauthenticated = authLoaded && !isSignedIn;
  
  // Security: Clear cache when user changes to prevent data leakage
  useEffect(() => {
    if (clerkUser?.id) {
      clearCacheOnUserChange(clerkUser.id);
    } else if (authLoaded && !isSignedIn) {
      // User logged out - clear all session data
      clearUserSession();
    }
  }, [clerkUser?.id, authLoaded, isSignedIn]);

  return {
    user,
    clerkUser,
    isLoading,
    isAuthenticated,
    isUnauthenticated,
  };
}