import { useQuery } from "@tanstack/react-query";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { apiRequest } from "@/lib/queryClient";

export function useTransactions() {
  const { isReady, user } = useClerkUserReady();

  return useQuery({
    queryKey: ["transactions", user?.id],
    enabled: isReady && !!user,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/transactions");
      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds - reasonable cache time
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
    refetchOnMount: false, // Don't refetch on mount if data is fresh
    refetchOnWindowFocus: false, // Don't refetch on focus
    retry: (failureCount, error: any) => {
      // Don't retry if authentication failed due to timing
      if (error?.status === 401 && !isReady) return false;
      return failureCount < 3;
    },
    retryDelay: 1000,
  });
}