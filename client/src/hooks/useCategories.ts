import { useQuery, type QueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";

export interface CategoryRow {
  id: number;
  name: string;
  icon: string;
  color: string;
  type: "income" | "expense" | "goal" | string;
  userId?: string | null;
  transactionCount?: number;
  isInUse?: boolean;
}

/**
 * The person's categories, names already in the page language (the server translates the
 * predefined ones). One key for every screen; the categories page invalidates it on change.
 */
export function useCategories() {
  const { isReady, user } = useClerkUserReady();
  return useQuery<CategoryRow[]>({
    queryKey: ["categories"],
    enabled: isReady && !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/categories");
      return response.json();
    },
  });
}

/**
 * Everything that shows money moves when a transaction is added, edited or removed. One list,
 * so a new screen cannot be forgotten by one of the forms.
 */
const MONEY_KEYS = new Set([
  "transactions",
  "dashboard-overview",
  "financial-summary",
  "budgets",
  "financial-health",
  "transaction-reminders",
  "expense-reminders",
  "categories",
  "/api/recurring-transactions",
]);

export function invalidateMoney(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ predicate: (query) => MONEY_KEYS.has(String(query.queryKey[0])) });
}
