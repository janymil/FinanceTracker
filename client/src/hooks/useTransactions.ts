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
    // This overrode the shared defaults with `0`/`0`, so every screen that lists money refetched
    // the whole history on every mount. Adding a transaction, editing one, deleting one and the
    // live-update stream all invalidate this key already, so the only thing a cache adds is not
    // repeating a request that nobody changed.
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    retry: (failureCount, error: any) => {
      if (error?.status === 401 && !isReady) return false;
      return failureCount < 3;
    },
    retryDelay: 1000,
  });
}