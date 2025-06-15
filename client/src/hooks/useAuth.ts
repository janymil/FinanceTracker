import { useUser } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export function useAuth() {
  const { user: clerkUser, isLoaded } = useUser();
  
  // Fetch our app user data if Clerk user exists
  const { data: appUser, isLoading: isLoadingAppUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    enabled: !!clerkUser && isLoaded,
  });

  const isLoading = !isLoaded || (clerkUser && isLoadingAppUser);
  const isAuthenticated = !!clerkUser && isLoaded;

  return {
    user: appUser,
    clerkUser,
    isLoading,
    isAuthenticated,
  };
}