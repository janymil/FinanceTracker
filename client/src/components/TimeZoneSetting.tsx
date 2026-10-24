import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useAuth } from "../hooks/useAuth";
import { useClerkUserReady } from "../hooks/useClerkUserReady";
import { useToast } from "../hooks/use-toast";
import { describeTimeZone, detectTimeZone, resolveTimeZone, timeZoneOptions } from "@shared/timezones";

/**
 * Where "this month" starts and ends. A new account gets the device's zone automatically
 * (useAutoTimeZone); this is where they change it.
 */
export function TimeZoneSetting() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { getAuthHeaders } = useClerkUserReady();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const stored: string | null = (user as any)?.timezone ?? null;
  const deviceZone = useMemo(() => detectTimeZone(), []);
  const locale = (i18n.language || "en").slice(0, 2);
  const selected = stored ? resolveTimeZone(stored) : deviceZone;

  const options = useMemo(
    () => timeZoneOptions(locale, [selected, deviceZone]),
    [locale, selected, deviceZone],
  );

  const save = async (timezone: string, quiet = false) => {
    setIsSaving(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/auth/user", {
        method: "PUT",
        headers: { ...headers },
        credentials: "include",
        body: JSON.stringify({ timezone }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || t("profile.timezone.failed"));
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // Every month-based number depends on the zone.
      await queryClient.invalidateQueries();
      if (!quiet) toast({ title: t("profile.timezone.saved") });
    } catch (error: any) {
      if (!quiet) {
        toast({ title: t("profile.Error"), description: error?.message || t("profile.timezone.failed"), variant: "destructive" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border p-4" data-testid="timezone-setting">
      <div className="space-y-1">
        <div className="flex items-center gap-2 font-medium">
          <Globe className="h-4 w-4" />
          <span>{t("profile.timezone.title")}</span>
        </div>
        <p className="text-sm text-muted-foreground">{t("profile.timezone.description")}</p>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={selected} onValueChange={(value) => save(value)} disabled={isSaving}>
          <SelectTrigger className="w-full sm:max-w-md" aria-label={t("profile.timezone.title")} data-testid="timezone-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected !== deviceZone && (
          <Button type="button" variant="outline" size="sm" disabled={isSaving} onClick={() => save(deviceZone)}>
            {t("profile.timezone.use_device", { zone: describeTimeZone(deviceZone, locale).name })}
          </Button>
        )}
      </div>
    </div>
  );
}
