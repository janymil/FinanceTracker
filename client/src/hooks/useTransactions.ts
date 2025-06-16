import { useQuery } from "@tanstack/react-query";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { apiRequest } from "@/lib/queryClient";

export function useTransactions() {
  const { isReady, user } = useClerkUserReady();

  return useQuery({
    queryKey: ["transactions", user?.id],
    enabled: isReady,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/transactions");
      return response.json();
    },
    staleTime: 0, // Always fresh
    gcTime: 0, // Don't cache results - force immediate updates
    retry: (failureCount, error: any) => {
      // Don't retry if authentication failed due to timing
      if (error?.status === 401 && !isReady) return false;
      return failureCount < 3;
    },
    retryDelay: 1000,
  });
}