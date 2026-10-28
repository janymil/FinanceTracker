import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import type { DashboardOverview } from "@shared/dashboardOverview";
import { apiRequest } from "@/lib/queryClient";
import { useCurrency } from "@/context/CurrencyContext";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { cn } from "@/lib/utils";

export type Plan = "free" | "standard" | "premium";
export type Overview = DashboardOverview & { plan: Plan; budgetCount: number };

/**
 * The redesigned dashboard's data: one request, computed on the server in the person's own time
 * zone (`/api/dashboard/overview`). `month` undefined means "this month", and the answer says which
 * month that is, so the page never has to work out "now" in the browser.
 */
export function useDashboardOverview(month: string | undefined) {
  const { isReady, user } = useClerkUserReady();
  return useQuery<Overview>({
    queryKey: ["dashboard-overview", user?.id, month ?? "current"],
    enabled: isReady,
    // Thirty seconds: adding, editing or deleting a transaction invalidates this key.
    staleTime: 30_000,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const query = month ? `?month=${encodeURIComponent(month)}` : "";
      const response = await apiRequest("GET", `/api/dashboard/overview${query}`);
      return response.json();
    },
  });
}

function intlLocale(language: string): string {
  if (language.startsWith("es")) return "es-PE";
  if (language.startsWith("sk")) return "sk-SK";
  return "en-US";
}

/** Money, months and calendar days, formatted for the page language. */
export function useOverviewFormat() {
  const { i18n } = useTranslation();
  const { formatMoney } = useCurrency();
  const locale = intlLocale(i18n.language || "en");

  // Month keys and day keys are calendar values, not instants: read and print them in UTC so the
  // browser's own zone can never move "2026-10-01" into September.
  const fromKey = (key: string) => {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day || 1, 12));
  };

  return {
    locale,
    money: (cents: number) => formatMoney(cents / 100),
    /** "October 2026" */
    monthLabel: (key: string) =>
      new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(fromKey(key)),
    /** "October" */
    monthName: (key: string) =>
      new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(fromKey(key)),
    /** "Oct" */
    monthShort: (key: string) =>
      new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(fromKey(key)),
    /** "Thu 30 Oct" */
    dayLabel: (key: string) =>
      new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(fromKey(key)),
    /** "30 Oct 2026" */
    dateLabel: (key: string) =>
      new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(fromKey(key)),
    percent: (basisPoints: number) => Math.round(basisPoints / 100),
  };
}

/** The one card style of the dashboard. */
export function Panel({
  children,
  className,
  labelledBy,
  label,
  testId,
}: {
  children: ReactNode;
  className?: string;
  labelledBy?: string;
  label?: string;
  testId?: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      aria-label={label}
      data-testid={testId}
      className={cn(
        "rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-800 dark:bg-gray-900",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PanelTitle({ id, children, aside }: { id: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
        {children}
      </h2>
      {aside}
    </div>
  );
}

/** A placeholder block of the right size while the overview loads. */
export function PanelSkeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-2xl bg-gray-200/70 dark:bg-gray-800", className)} />;
}

/** Builds a link inside the current language prefix ("/budget" -> "/sk/budget"). */
export function useLangHref() {
  const [path] = useLocation();
  const lang = path.match(/^\/([a-z]{2})(?:\/|$)/)?.[1] || "en";
  return (target: string) => `/${lang}${target}`;
}
