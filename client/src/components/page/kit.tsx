import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Circle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { categoryIcons } from "@/lib/icons-registry";
import { cn } from "@/lib/utils";
import { HelpTooltip } from "@/components/help-tooltip";
import { useUserTimeZone } from "@/hooks/useUserTimeZone";
import { monthKeyIn, shiftMonth } from "@shared/ledger";

export { Panel, PanelTitle, PanelSkeleton, useLangHref, useOverviewFormat } from "@/components/dashboard/overviewShared";

/**
 * The building blocks every money page shares with the dashboard: the same width, the same card,
 * the same month control, the same colours for "more than usual" and "less". A page differs by
 * what it says, not by how its frame looks.
 */

export function PageShell({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div data-testid={testId} className="mx-auto flex w-full max-w-7xl flex-col gap-5 pb-24 lg:pb-8">
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Under the title: a month control, chips. */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">{title}</h1>
          {subtitle && <p className="text-sm text-gray-600 sm:text-[15px] dark:text-gray-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/**
 * Which month a page shows. "This month" is read in the account's zone, so the page and the
 * dashboard turn the page at the same midnight. `initial` opens on a given month (a link with
 * `?month=`); the future is reachable only where scheduled rows make it meaningful.
 */
export function useMonthNavigation(initial?: string | null, options: { allowFuture?: boolean } = {}) {
  const timeZone = useUserTimeZone();
  const currentKey = monthKeyIn(new Date(), timeZone);
  const [selected, setSelected] = useState<string | null>(initial ?? null);
  const monthKey = selected ?? currentKey;
  return {
    timeZone,
    monthKey,
    currentKey,
    isCurrent: monthKey === currentKey,
    canGoNext: Boolean(options.allowFuture) || monthKey < currentKey,
    previous: () => setSelected(shiftMonth(monthKey, -1)),
    next: () => setSelected(shiftMonth(monthKey, 1)),
    reset: () => setSelected(null),
    set: (key: string | null) => setSelected(key),
  };
}

const stepButton =
  "flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800";

/** ‹ October 2026 › with "back to this month", as on the dashboard. */
export function MonthStepper({
  label,
  onPrevious,
  onNext,
  canGoNext = true,
  isCurrent,
  onCurrent,
  note,
  testId,
}: {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  canGoNext?: boolean;
  isCurrent: boolean;
  onCurrent: () => void;
  note?: ReactNode;
  testId?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" aria-label={t("overview.prev_month")} onClick={onPrevious} className={stepButton}>
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <span
        className="min-w-[10rem] text-center text-lg font-semibold text-gray-900 sm:min-w-[12rem] sm:text-xl dark:text-white"
        aria-live="polite"
        data-testid={testId}
      >
        {label}
      </span>
      <button type="button" aria-label={t("overview.next_month")} onClick={onNext} disabled={!canGoNext} className={stepButton}>
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
      {note && (
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 sm:text-[13px] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
          {note}
        </span>
      )}
      {!isCurrent && (
        <button type="button" onClick={onCurrent} className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">
          {t("overview.back_to_current")}
        </button>
      )}
    </div>
  );
}

const HERO_TONES = {
  blue: "bg-blue-700 dark:bg-blue-800",
  emerald: "bg-emerald-700 dark:bg-emerald-800",
  slate: "bg-slate-800 dark:bg-slate-900",
  violet: "bg-violet-700 dark:bg-violet-800",
} as const;

/** The one large card at the top of a page: its answer, first and biggest. */
export function HeroCard({
  tone = "blue",
  label,
  amount,
  sub,
  help,
  children,
  testId,
}: {
  tone?: keyof typeof HERO_TONES;
  label: ReactNode;
  amount: ReactNode;
  sub?: ReactNode;
  help?: ReactNode;
  children?: ReactNode;
  testId?: string;
}) {
  return (
    <section data-testid={testId} className={cn("flex flex-col gap-5 rounded-2xl p-5 text-white sm:p-7", HERO_TONES[tone])}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="text-sm font-medium text-white/85">{label}</h2>
          <p className="font-display text-4xl font-bold leading-none tracking-tight tabular-nums sm:text-5xl">{amount}</p>
          {sub && <p className="mt-1 text-sm text-white/90 sm:text-base">{sub}</p>}
        </div>
        {help && <HelpTooltip className="text-white/80 hover:text-white dark:hover:text-white">{help}</HelpTooltip>}
      </div>
      {children}
    </section>
  );
}

/** A figure inside the hero card: a row on a phone, a tile from `sm` up. */
export function HeroStat({ label, value, note }: { label: ReactNode; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-white/10 px-3.5 py-2.5 sm:flex-col sm:items-start sm:justify-start sm:gap-0.5 sm:px-4 sm:py-3.5">
      <span className="text-[13px] text-white/85 sm:truncate sm:text-xs">{label}</span>
      <span className="whitespace-nowrap text-base font-bold tabular-nums sm:text-xl">{value}</span>
      {note && <span className="hidden truncate text-xs text-white/85 sm:block">{note}</span>}
    </div>
  );
}

/** A small figure on a white card. */
export function StatTile({
  label,
  value,
  note,
  tone = "default",
  icon,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  tone?: "default" | "good" | "bad" | "warn";
  icon?: ReactNode;
}) {
  const toneClass = {
    default: "text-gray-900 dark:text-white",
    good: "text-emerald-700 dark:text-emerald-400",
    bad: "text-red-700 dark:text-red-400",
    warn: "text-amber-700 dark:text-amber-400",
  }[tone];
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <span className="flex items-center gap-1.5 text-[13px] text-gray-600 dark:text-gray-400">
        {icon}
        {label}
      </span>
      <span className={cn("truncate text-xl font-bold tabular-nums sm:text-2xl", toneClass)}>{value}</span>
      {note && <span className="text-xs text-gray-600 dark:text-gray-400">{note}</span>}
    </div>
  );
}

export function safeColor(color: string | null | undefined, fallback = "#475569"): string {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

/** The category's own icon on a tint of its own colour; the first letter when there is no icon. */
export function CategoryTile({
  color,
  icon,
  name,
  size = "md",
}: {
  color?: string | null;
  icon?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const tint = safeColor(color);
  const Icon = icon ? (categoryIcons as Record<string, typeof Circle>)[icon] : undefined;
  const box = { sm: "h-8 w-8 rounded-lg", md: "h-10 w-10 rounded-xl", lg: "h-12 w-12 rounded-xl" }[size];
  const glyph = { sm: "h-4 w-4", md: "h-[18px] w-[18px]", lg: "h-6 w-6" }[size];
  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 items-center justify-center text-[15px] font-bold", box)}
      style={{ background: `${tint}1A`, color: tint }}
    >
      {Icon ? <Icon className={glyph} /> : (name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * "+12% vs usual". Spending more than usual is the warning colour; for income or savings, pass
 * `higherIsGood` and the colours swap. Within ±`quiet` percent it says "as usual".
 */
export function ChangeChip({
  pct,
  higherIsGood = false,
  quiet = 10,
  label,
}: {
  pct: number | null;
  higherIsGood?: boolean;
  quiet?: number;
  /** i18n key taking {{pct}}; defaults to "vs usual". */
  label?: { up: string; down: string; same: string };
}) {
  const { t } = useTranslation();
  if (pct === null) return null;
  const keys = label ?? { up: "page.common.vs_usual_up", down: "page.common.vs_usual_down", same: "page.common.vs_usual_same" };
  if (Math.abs(pct) < quiet) {
    return (
      <span className="whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
        {t(keys.same)}
      </span>
    );
  }
  const up = pct > 0;
  const good = up === higherIsGood;
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold",
        good
          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300",
      )}
    >
      {t(up ? keys.up : keys.down, { pct: Math.abs(pct) })}
    </span>
  );
}

/**
 * A bar from 0 to a limit. `marker` (0-100) draws where the person should be today, so "60% used"
 * reads differently on the 10th and on the 28th.
 */
export function Meter({
  percent,
  marker,
  tone,
  label,
  className,
}: {
  percent: number;
  marker?: number | null;
  tone: "good" | "warn" | "bad" | "neutral";
  label: string;
  className?: string;
}) {
  const fill = {
    good: "bg-emerald-600",
    warn: "bg-amber-500",
    bad: "bg-red-600",
    neutral: "bg-blue-600",
  }[tone];
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(100, Math.max(0, percent)))}
      aria-label={label}
      className={cn("relative h-2.5 w-full rounded-full bg-gray-100 dark:bg-gray-800", className)}
    >
      <div className={cn("h-full rounded-full", fill)} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      {marker != null && marker > 0 && marker < 100 && (
        <span
          aria-hidden="true"
          className="absolute -top-1 h-[18px] w-0.5 rounded-full bg-gray-900/70 dark:bg-white/80"
          style={{ left: `${marker}%` }}
        />
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
        {icon}
      </span>
      <span className="text-[15px] font-semibold text-gray-900 dark:text-white">{title}</span>
      {body && <span className="max-w-md text-sm text-gray-600 dark:text-gray-400">{body}</span>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** A row of pill buttons, one pressed. For two to five choices; more belong in a select. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
            value === option.value
              ? "bg-white text-gray-900 shadow-sm dark:bg-gray-950 dark:text-white"
              : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export const primaryButton =
  "inline-flex h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500";
export const secondaryButton =
  "inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800";
export const linkButton = "text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300";

/** A failed load is said out loud: an empty page would read as "no data". */
export function LoadError({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100"
    >
      <span>
        <span className="font-semibold">{t("page.common.load_failed_title")}</span> {t("page.common.load_failed_body")}
      </span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="rounded-lg border border-amber-400 px-3 py-1.5 font-semibold hover:bg-amber-100 dark:hover:bg-amber-900">
          {t("page.common.retry")}
        </button>
      )}
    </div>
  );
}
