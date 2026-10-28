import { TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HelpTooltip } from "@/components/help-tooltip";
import { type Overview, useOverviewFormat } from "./overviewShared";

/**
 * The answer to "how am I doing this month?", first and largest.
 *
 * One number: what is left once the bills still to come are paid (or, for a closed month, what was
 * kept). Under it, the same income split into spent / still to pay / left, and where the month is
 * heading at the person's own day-to-day pace.
 */
export function MonthHeroCard({ overview }: { overview: Overview }) {
  const { t } = useTranslation();
  const f = useOverviewFormat();
  const { totals, month, previous, forecast, usualKeptShareBp } = overview;
  const isPast = month.status === "past";
  const income = totals.incomeCents;
  const hasIncome = income > 0;

  const label = isPast
    ? t("overview.hero.kept_label", { month: f.monthName(month.key) })
    : totals.upcomingCents > 0
      ? t("overview.hero.left_label")
      : t("overview.hero.left_label_simple");

  let sub: string;
  if (!hasIncome) {
    sub = t("overview.hero.no_income");
  } else if (totals.leftCents < 0) {
    sub = t("overview.hero.sub_short");
  } else if (isPast) {
    sub = t("overview.hero.sub_past", { pct: f.percent(totals.leftShareBp ?? 0) });
  } else {
    sub = t("overview.hero.sub_on_track", { pct: f.percent(totals.leftShareBp ?? 0) });
  }
  if (hasIncome && usualKeptShareBp !== null) {
    sub = `${sub} ${t("overview.hero.sub_usual", { pct: f.percent(usualKeptShareBp) })}`;
  }

  // The bar is a share of income; spending beyond it fills the bar instead of overflowing it.
  const base = Math.max(income, totals.spentCents + totals.upcomingCents, 1);
  const spentW = (totals.spentCents / base) * 100;
  const billsW = (totals.upcomingCents / base) * 100;
  const leftW = Math.max(0, 100 - spentW - billsW);

  let spentNote: string;
  if (isPast && previous.hasData && previous.expensesCents > 0) {
    const change = Math.round(((totals.spentCents - previous.expensesCents) * 100) / previous.expensesCents);
    const prevMonth = f.monthName(previous.key);
    spentNote = change === 0
      ? t("overview.hero.vs_prev_same", { month: prevMonth })
      : change < 0
        ? t("overview.hero.vs_prev_less", { pct: Math.abs(change), month: prevMonth })
        : t("overview.hero.vs_prev_more", { pct: change, month: prevMonth });
  } else {
    spentNote = t("overview.hero.spent_count", { count: totals.spentCount });
  }

  const third = isPast
    ? {
        label: t("overview.hero.kept_vs_prev", { month: f.monthName(previous.key) }),
        value: previous.hasData
          ? `${totals.leftCents - previous.keptCents >= 0 ? "+" : "−"}${f.money(Math.abs(totals.leftCents - previous.keptCents))}`
          : "—",
        note: previous.hasData ? t("overview.hero.prev_kept", { month: f.monthName(previous.key), amount: f.money(previous.keptCents) }) : "",
      }
    : {
        label: t("overview.hero.bills_to_pay"),
        value: f.money(totals.upcomingCents),
        note: t("overview.hero.bills_count", { count: totals.upcomingCount }),
      };

  return (
    <section
      aria-labelledby="hero-title"
      data-testid="dashboard-hero"
      className="flex flex-col gap-5 rounded-2xl bg-blue-700 p-5 text-white sm:gap-6 sm:p-7 dark:bg-blue-800"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 id="hero-title" className="text-sm font-medium text-white/90">{label}</h2>
          <p className="font-display text-4xl font-bold leading-none tracking-tight tabular-nums sm:text-5xl" data-testid="hero-amount">
            {totals.leftCents < 0 ? "−" : ""}{f.money(Math.abs(totals.leftCents))}
          </p>
          <p className="mt-1 text-sm text-white/90 sm:text-base">{sub}</p>
        </div>
        <HelpTooltip className="text-white/80 hover:text-white dark:hover:text-white">{t("overview.hero.help")}</HelpTooltip>
      </div>

      <div className="flex flex-col gap-2.5">
        <div
          role="img"
          aria-label={t("overview.hero.bar_label", {
            spent: f.money(totals.spentCents),
            bills: f.money(totals.upcomingCents),
            left: f.money(Math.max(0, totals.leftCents)),
          })}
          className="flex h-3 overflow-hidden rounded-full bg-white/20"
        >
          <div className="bg-white/90" style={{ width: `${spentW}%` }} />
          <div className="bg-amber-400" style={{ width: `${billsW}%` }} />
          <div className="bg-emerald-400" style={{ width: `${leftW}%` }} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/90 sm:text-sm">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-white/90" />{t("overview.hero.spent")}</span>
          {totals.upcomingCents > 0 && (
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />{t("overview.hero.bills")}</span>
          )}
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />{isPast ? t("overview.hero.kept") : t("overview.hero.left")}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        <Stat label={t("overview.hero.income")} value={f.money(income)} note={t("overview.hero.income_count", { count: totals.incomeCount })} />
        <Stat label={t("overview.hero.spent")} value={f.money(totals.spentCents)} note={spentNote} />
        <Stat label={third.label} value={third.value} note={third.note} />
      </div>

      {forecast && (
        <p className="flex items-center gap-2 rounded-xl bg-slate-900/25 px-3.5 py-2.5 text-sm" data-testid="hero-forecast">
          <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
          {forecast.keptCents >= 0
            ? t("overview.hero.forecast_keep", { month: f.monthName(month.key), amount: f.money(forecast.keptCents) })
            : t("overview.hero.forecast_short", { month: f.monthName(month.key), amount: f.money(Math.abs(forecast.keptCents)) })}
        </p>
      )}
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    // A row on a phone (label left, amount right), a tile from `sm` up: three amounts side by side
    // in 390px were cut to "7 000,…".
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-white/10 px-3.5 py-2.5 sm:flex-col sm:items-start sm:justify-start sm:gap-0.5 sm:px-4 sm:py-3.5">
      <span className="text-[13px] text-white/90 sm:truncate sm:text-xs">{label}</span>
      <span className="whitespace-nowrap text-base font-bold tabular-nums sm:text-xl">{value}</span>
      {note && <span className="hidden truncate text-xs text-white/90 sm:block">{note}</span>}
    </div>
  );
}
