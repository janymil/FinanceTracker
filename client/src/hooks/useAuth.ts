import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { useEffect, useState } from "react";

export function useAuth() {
  const { user: clerkUser, isLoaded: userLoaded } = useUser();
  const { isSignedIn, isLoaded: authLoaded, signOut, getToken } = useClerkAuth();
  const [sessionPersisted, setSessionPersisted] = useState(false);
  const [sessionRecovered, setSessionRecovered] = useState(false);
  
  // Session recovery on page load
  useEffect(() => {
    if (authLoaded && !isSignedIn && !sessionRecovered) {
      const storedToken = localStorage.getItem('clerk-session-token');
      const storedUserId = localStorage.getItem('clerk-user-id');
      
      if (storedToken && storedUserId) {
        console.log('Attempting session recovery from localStorage');
        // Token exists, let Clerk handle the recovery
        setSessionRecovered(true);
      } else {
        setSessionRecovered(true);
      }
    }
  }, [authLoaded, isSignedIn, sessionRecovered]);
  
  // Don't proceed if Clerk isn't loaded yet or session recovery is in progress
  if (!userLoaded || !authLoaded || !sessionRecovered) {
    return {
      user: null,
      clerkUser: null,
      isLoading: true,
      isAuthenticated: false,
      isUnauthenticated: false,
    };
  }
  
  // Session persistence: Store token when user is authenticated
  useEffect(() => {
    if (isSignedIn && clerkUser && !sessionPersisted) {
      getToken().then(token => {
        if (token) {
          localStorage.setItem('clerk-session-token', token);
          localStorage.setItem('clerk-user-id', clerkUser.id);
          setSessionPersisted(true);
        }
      }).catch(console.warn);
    }
  }, [isSignedIn, clerkUser, getToken, sessionPersisted]);

  // Clear authentication state on JWT errors to force re-authentication
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'clerk-db-jwt-error') {
        console.log('JWT error detected, clearing authentication');
        localStorage.removeItem('clerk-session-token');
        localStorage.removeItem('clerk-user-id');
        signOut();
        localStorage.removeItem('clerk-db-jwt-error');
        setSessionPersisted(false);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [signOut]);
  
  // Get our database user record that syncs with Clerk
  const { data: user, isLoading: dbUserLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ 
      on401: "returnNull",
      onError: (error: any) => {
        // Handle JWT token errors by triggering sign out
        if (error?.message?.includes('jwt') || error?.message?.includes('token')) {
          console.log('JWT/Token error, triggering sign out');
          localStorage.setItem('clerk-db-jwt-error', 'true');
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'clerk-db-jwt-error',
            newValue: 'true'
          }));
        }
      }
    }),
    enabled: !!clerkUser && isSignedIn,
    retry: (failureCount, error: any) => {
      // Don't retry on JWT/auth errors
      if (error?.message?.includes('jwt') || error?.message?.includes('token') || error?.status === 401) {
        return false;
      }
      return failureCount < 3;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: false,
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