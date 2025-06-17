import { useUser, useAuth } from "@clerk/clerk-react";

export function useClerkUserReady() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  
  // Only consider ready when Clerk is fully loaded AND user is signed in AND user data exists
  const isReady = isLoaded && isSignedIn && !!user?.id;
  
  const getAuthHeaders = async () => {
    const token = await getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  return { isReady, user, isLoaded, isSignedIn, getAuthHeaders };
}