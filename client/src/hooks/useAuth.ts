import { useAuth as useClerkAuth, useUser } from "@clerk/clerk-react";

export function useAuth() {
  const { isSignedIn, isLoaded } = useClerkAuth();
  const { user } = useUser();

  return {
    isAuthenticated: isSignedIn && isLoaded,
    isLoading: !isLoaded,
    user: user ? {
      id: user.id,
      email: user.emailAddresses?.[0]?.emailAddress || '',
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.imageUrl,
      plan: 'free' // Default plan, will be updated from API
    } : null
  };
}