import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { HealthFactorKey, FinancialHealth } from "@shared/financialHealth";
import { HelpTooltip } from "@/components/help-tooltip";
import { Panel, PanelTitle, type Overview, useOverviewFormat } from "./overviewShared";

const FACTOR_LABELS: Record<HealthFactorKey, string> = {
  spendingControl: "financial_health.spending_control",
  savingsRate: "financial_health.savings_rate",
  budgetAdherence: "financial_health.budget_adherence",
  financialStability: "financial_health.financial_stability",
};

const BAND_STYLE: Record<FinancialHealth["band"], { ring: string; chip: string }> = {
  excellent: { ring: "#04774D", chip: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  good: { ring: "#04774D", chip: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  fair: { ring: "#D97706", chip: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  needs_improvement: { ring: "#B91C1C", chip: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300" },
};

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The score, the change since last month, and its four parts.
 *
 * Same rubric as before (`shared/financialHealth`), computed on the server with the rest of the
 * overview, so this card and the adviser's badge are the same number by construction. On a phone
 * the four parts fold away behind one button: the number and its change are what matter there.
 */
export function HealthCard({ overview }: { overview: Overview }) {
  const { t } = useTranslation();
  const f = useOverviewFormat();
  const [open, setOpen] = useState(false);
  const { health, previousHealthScore, previous } = overview;
  const style = BAND_STYLE[health.band];
  const delta = previousHealthScore === null ? null : health.score - previousHealthScore;
  const prevMonth = f.monthName(previous.key);

  return (
    <Panel labelledBy="health-title" testId="dashboard-health" className="flex flex-col gap-4">
      <PanelTitle id="health-title">
        {t("financial_health.title")}
        <HelpTooltip>
          <p>{t("help.health_score")}</p>
          <p className="mt-2">{t("financial_health.tooltip.score_ranges_detail")}</p>
        </HelpTooltip>
      </PanelTitle>

      <div className="flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
          <svg viewBox="0 0 120 120" className="h-full w-full" role="img" aria-label={`${t("a11y.health_score")}: ${health.score} / 100`}>
            <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="12" className="stroke-gray-100 dark:stroke-gray-800" />
            <circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              stroke={style.ring}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${(CIRCUMFERENCE * health.score) / 100} ${CIRCUMFERENCE}`}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl font-bold leading-none text-gray-900 dark:text-white" data-testid="health-score">
              {health.score}
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-400">{t("overview.health.of_100")}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={`self-start rounded-full px-2.5 py-1 text-xs font-semibold ${style.chip}`}>
            {t(`financial_health.status.${health.band}`)}
          </span>
          {delta !== null && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {delta === 0
                ? t("overview.health.same", { month: prevMonth })
                : delta > 0
                  ? t("overview.health.up", { count: delta, month: prevMonth })
                  : t("overview.health.down", { count: Math.abs(delta), month: prevMonth })}
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 sm:hidden dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        {open ? t("overview.health.hide_breakdown") : t("overview.health.show_breakdown")}
      </button>

      <ul className={`${open ? "flex" : "hidden"} flex-col gap-3 sm:flex`}>
        {health.factors.map((factor) => {
          const ratio = factor.max > 0 ? factor.score / factor.max : 0;
          const bar = ratio >= 0.8 ? "bg-emerald-700" : ratio >= 0.6 ? "bg-blue-600" : "bg-amber-600";
          return (
            <li key={factor.key} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">
                  {t(FACTOR_LABELS[factor.key])}
                  {factor.status === "not_measured" && (
                    <span className="text-gray-500 dark:text-gray-400"> · {t("financial_health.status.not_measured")}</span>
                  )}
                </span>
                <span className="font-semibold text-gray-900 tabular-nums dark:text-white">{factor.score} / {factor.max}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${ratio * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
