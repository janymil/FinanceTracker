import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn, clearUserSession, clearCacheOnUserChange } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { useEffect } from "react";

export function useAuth() {
  const { user: clerkUser, isLoaded: userLoaded, isSignedIn: clerkIsSignedIn } = useUser();
  const { isSignedIn: authIsSignedIn, isLoaded: authLoaded, signOut } = useClerkAuth();

  const clerkReady = userLoaded && authLoaded;
  // Trust Clerk as the source of truth for the session. The database row can be
  // temporarily missing (server sync delay) - that must never hide the app shell.
  const signedIn = clerkReady && (authIsSignedIn ?? clerkIsSignedIn) === true && !!clerkUser?.id;

  // IMPORTANT: every hook below is called unconditionally and before any return,
  // otherwise React throws "Rendered more hooks than during the previous render"
  // when Clerk finishes loading (which used to crash Header/Sidebar/Dashboard).
  const { data: dbUser, isLoading: dbUserLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({
      on401: "returnNull",
    }),
    enabled: signedIn,
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

  // Security: Clear cache when user changes to prevent data leakage
  useEffect(() => {
    if (clerkUser?.id) {
      clearCacheOnUserChange(clerkUser.id);
    } else if (authLoaded && !authIsSignedIn) {
      // User logged out - clear all session data
      clearUserSession();
    }
  }, [clerkUser?.id, authLoaded, authIsSignedIn]);

  if (!clerkReady) {
    return {
      user: null,
      clerkUser: null,
      isLoading: true,
      isAuthenticated: false,
      isUnauthenticated: false,
    };
  }

  return {
    user: dbUser ?? null,
    clerkUser: clerkUser ?? null,
    isLoading: signedIn && dbUserLoading,
    isAuthenticated: signedIn,
    isUnauthenticated: !signedIn,
  };
}
