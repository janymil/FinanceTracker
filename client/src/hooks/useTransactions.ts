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
    staleTime: 30 * 1000, // 30 seconds cache
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false, // Disable retries to prevent loops
  });
}