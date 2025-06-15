import { useUser, useAuth as useClerkAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';

export function useAuth() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { userId, isSignedIn } = useClerkAuth();

  // Fetch user data from our database
  const { data: user, isLoading: userDataLoading } = useQuery({
    queryKey: ['/api/auth/user'],
    enabled: !!userId && isSignedIn,
    retry: false,
  });

  return {
    user,
    isLoading: !clerkLoaded || (isSignedIn && userDataLoading),
    isAuthenticated: isSignedIn && !!user,
    clerkUser,
    userId,
  };
}