import { useAuth } from "@/hooks/useAuth";
import { detectTimeZone, resolveTimeZone } from "@shared/timezones";

/**
 * The zone the account's months and days are read in: the one saved in Profile, the device's
 * until one is saved. The server reads the same field, so a page's "October" is the dashboard's.
 */
export function useUserTimeZone(): string {
  const { user } = useAuth();
  const saved = (user as { timezone?: string | null } | null | undefined)?.timezone;
  return resolveTimeZone(saved || detectTimeZone());
}
