import { useUser, useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";

export function useClerkUserReady() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken, signOut } = useAuth();
  
  // Only consider ready when Clerk is fully loaded AND user is signed in AND user data exists
  const isReady = isLoaded && isSignedIn && !!user?.id;
  
  // Handle cases where user has token but account was deleted
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      // Clear any stale session data
      const { clearStaleSession } = require('../utils/sessionCleanup');
      clearStaleSession();
    }
  }, [isLoaded, isSignedIn]);
  
  const getAuthHeaders = async () => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No auth token available');
      }
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
    } catch (error) {
      console.error('Failed to get auth token:', error);
      // Force cleanup and redirect
      const { forceSignOutAndRedirect } = await import('../utils/sessionCleanup');
      await forceSignOutAndRedirect();
      throw error;
    }
  };

  return { isReady, user, isLoaded, isSignedIn, getAuthHeaders };
}