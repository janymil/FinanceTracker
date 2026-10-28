import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useClerkUserReady } from "./useClerkUserReady";

/** Query keys to refresh for each change type emitted by the server. */
const QUERY_KEYS_BY_CHANGE: Record<string, string[]> = {
  transaction: ["transactions", "financial-summary", "expense-breakdown", "trend-predictions", "financial-health", "dashboard-overview"],
  budget: ["budgets", "financial-summary", "dashboard-overview"],
  goal: ["goals", "collaborative-goals", "achievements", "dashboard-overview"],
};

/**
 * Subscribes to `/api/events` (SSE) and invalidates the affected React Query
 * caches so every open tab reflects a change made in another tab.
 *
 * Uses `fetch` rather than `EventSource` because the stream needs the Clerk
 * bearer token, which EventSource cannot send.
 */
export function useRealtimeUpdates() {
  const queryClient = useQueryClient();
  const { isReady, user, getAuthHeaders } = useClerkUserReady();
  const userId = user?.id;

  useEffect(() => {
    if (!isReady || !userId) return;

    let cancelled = false;
    const controller = new AbortController();

    const connect = async () => {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch("/api/events", { headers, signal: controller.signal });
        if (!response.ok || !response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const dataLine = frame.split("\n").find((line) => line.startsWith("data:"));
            if (!dataLine) continue;

            try {
              const payload = JSON.parse(dataLine.slice(5).trim());
              if (payload?.type !== "dataChange") continue;
              const keys = QUERY_KEYS_BY_CHANGE[payload.changeType] ?? [];
              for (const key of keys) {
                queryClient.invalidateQueries({ queryKey: [key] });
              }
            } catch {
              // ignore malformed frames
            }
          }
        }
      } catch {
        // aborted or offline
      }
    };

    void connect();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // getAuthHeaders is re-created every render; depending on it would reconnect in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, userId, queryClient]);
}
