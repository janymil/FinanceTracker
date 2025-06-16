import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
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
  
  // Simplified: use Clerk user directly without database dependency for faster loading
  const isLoading = !userLoaded || !authLoaded;
  const isAuthenticated = !!isSignedIn && !!clerkUser;
  const isUnauthenticated = authLoaded && !isSignedIn;

  return {
    user: clerkUser, // Use Clerk user directly
    clerkUser,
    isLoading,
    isAuthenticated,
    isUnauthenticated,
  };
}