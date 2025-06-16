import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { useEffect, useState } from "react";

export function useAuth() {
  const { user: clerkUser, isLoaded: userLoaded } = useUser();
  const { isSignedIn, isLoaded: authLoaded, signOut } = useClerkAuth();
  const [sessionRetryCount, setSessionRetryCount] = useState(0);
  
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
  
  // Handle session persistence and server restart scenarios
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'clerk-db-jwt-error') {
        console.log('JWT error detected, clearing authentication');
        signOut();
        localStorage.removeItem('clerk-db-jwt-error');
      }
    };
    
    // Handle server restart scenarios - try to maintain session
    const handleServerReconnect = () => {
      if (isSignedIn && clerkUser && sessionRetryCount < 3) {
        console.log('Server reconnected, refreshing user session...');
        setSessionRetryCount(prev => prev + 1);
        // Force a session refresh by invalidating queries
        window.location.reload();
      }
    };
    
    // Listen for server reconnection
    const handleOnline = () => {
      if (isSignedIn && clerkUser) {
        handleServerReconnect();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [signOut, isSignedIn, clerkUser, sessionRetryCount]);
  
  // Get our database user record that syncs with Clerk
  const { data: user, isLoading: dbUserLoading, error: userError } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ 
      on401: "returnNull",
      onError: (error: any) => {
        // Handle JWT token errors by triggering sign out only if it's not a server restart
        if (error?.message?.includes('jwt') || error?.message?.includes('token')) {
          // Check if this might be a server restart (network error followed by auth error)
          const isServerRestart = error?.message?.includes('fetch') || error?.code === 'NETWORK_ERROR';
          
          if (!isServerRestart && sessionRetryCount >= 3) {
            console.log('JWT/Token error after retries, triggering sign out');
            localStorage.setItem('clerk-db-jwt-error', 'true');
            window.dispatchEvent(new StorageEvent('storage', {
              key: 'clerk-db-jwt-error',
              newValue: 'true'
            }));
          }
        }
      }
    }),
    enabled: !!clerkUser && isSignedIn,
    retry: (failureCount, error: any) => {
      // Be more lenient with retries for potential server restart scenarios
      if (error?.message?.includes('jwt') || error?.message?.includes('token') || error?.status === 401) {
        // Allow retries if we suspect server restart
        if (error?.message?.includes('fetch') || error?.code === 'NETWORK_ERROR') {
          return failureCount < 5;
        }
        return failureCount < 2;
      }
      return failureCount < 3;
    },
    staleTime: 2 * 60 * 1000, // Reduce stale time to refresh more frequently
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // Periodic refresh every 30 seconds
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    networkMode: 'always', // Always try the query even if offline
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