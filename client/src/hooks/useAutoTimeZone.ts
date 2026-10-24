import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { useClerkUserReady } from "./useClerkUserReady";
import { detectTimeZone } from "@shared/timezones";

/**
 * A new account has no time zone yet, which would make "this month" follow UTC. Save the device's
 * zone once, right after the account exists, wherever the person lands first. It is changeable in
 * Profile. A failure is silent and retried on the next visit.
 */
export function useAutoTimeZone() {
  const { user } = useAuth();
  const { getAuthHeaders } = useClerkUserReady();
  const queryClient = useQueryClient();
  const attemptedFor = useRef<string | null>(null);

  const userId = user?.id ?? null;
  const hasTimeZone = Boolean((user as any)?.timezone);

  useEffect(() => {
    if (!userId || hasTimeZone || attemptedFor.current === userId) return;
    attemptedFor.current = userId;

    (async () => {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch("/api/auth/user", {
          method: "PUT",
          headers: { ...headers },
          credentials: "include",
          body: JSON.stringify({ timezone: detectTimeZone() }),
        });
        if (response.ok) {
          await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        }
      } catch {
        // Nothing to tell the person; the next visit tries again.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, hasTimeZone]);
}
