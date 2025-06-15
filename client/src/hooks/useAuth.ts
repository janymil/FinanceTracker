import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error, isError } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: (failureCount, error: any) => {
      // Only retry on actual network errors, not 401s
      return failureCount < 2 && error?.status !== 401;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false, // Disable to prevent auth loops
    refetchInterval: false, // Disable automatic refetching
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isUnauthenticated: isError && !isLoading,
    error,
  };
}