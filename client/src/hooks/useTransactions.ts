import { useQuery } from "@tanstack/react-query";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { apiRequest } from "@/lib/queryClient";

export function useTransactions() {
  const { isReady, user } = useClerkUserReady();

  return useQuery({
    queryKey: ["transactions", user?.id],
    enabled: isReady,
    queryFn: async () => {
      console.log("🔄 FETCHING TRANSACTIONS - Query Key:", ["transactions", user?.id]);
      console.log("🔄 User ID:", user?.id);
      console.log("🔄 Timestamp:", new Date().toISOString());
      
      const response = await apiRequest("GET", "/api/transactions");
      const data = await response.json();
      
      console.log("📦 TRANSACTIONS FETCHED:", data.length, "transactions");
      console.log("📦 First transaction amount:", data[0]?.amount);
      console.log("📦 Response timestamp:", new Date().toISOString());
      
      return data;
    },
    staleTime: 0, // Always fresh
    gcTime: 0, // Don't cache data
    retry: (failureCount, error: any) => {
      // Don't retry if authentication failed due to timing
      if (error?.status === 401 && !isReady) return false;
      return failureCount < 3;
    },
    retryDelay: 1000,
  });
}