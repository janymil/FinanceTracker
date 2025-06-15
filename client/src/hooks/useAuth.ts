import { useUser, useAuth as useClerkAuth, useClerk } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { User } from "@shared/schema";

// Clear all Clerk-related data from browser storage
function clearClerkAuth() {
  // Clear localStorage
  Object.keys(localStorage).forEach(key => {
    if (key.includes('clerk') || key.includes('__clerk')) {
      localStorage.removeItem(key);
    }
  });

  // Clear sessionStorage
  Object.keys(sessionStorage).forEach(key => {
    if (key.includes('clerk') || key.includes('__clerk')) {
      sessionStorage.removeItem(key);
    }
  });

  // Clear cookies
  document.cookie.split(";").forEach(cookie => {
    const eqPos = cookie.indexOf("=");
    const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
    if (name.trim().includes('clerk') || name.trim().includes('__session')) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
  });
}

export function useAuth() {
  const { user: clerkUser, isLoaded: userLoaded } = useUser();
  const { isSignedIn, isLoaded: authLoaded } = useClerkAuth();
  const clerk = useClerk();
  
  // Get our database user record that syncs with Clerk
  const { data: user, isLoading: dbUserLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!clerkUser && isSignedIn,
    retry: (failureCount, error: any) => {
      // If we get a 401 error due to token mismatch, clear auth and retry
      if (error?.status === 401 && failureCount === 0) {
        clearClerkAuth();
        // Sign out and reload to get fresh tokens
        clerk.signOut().then(() => {
          window.location.reload();
        });
        return false;
      }
      return failureCount < 2 && error?.status !== 401;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: false,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Auto-clear on authentication errors
  if (error?.status === 401 && isSignedIn) {
    clearClerkAuth();
    clerk.signOut();
  }

  const isLoading = !userLoaded || !authLoaded || (isSignedIn && dbUserLoading);
  const isAuthenticated = !!isSignedIn && !!clerkUser && !!user;
  const isUnauthenticated = authLoaded && !isSignedIn;

  // Add reset function to clear auth state
  const resetAuth = async () => {
    clearClerkAuth();
    await clerk.signOut();
    window.location.reload();
  };

  return {
    user,
    clerkUser,
    isLoading,
    isAuthenticated,
    isUnauthenticated,
    resetAuth,
  };
}