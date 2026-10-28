import { useTranslation } from "react-i18next";
import { Panel, PanelTitle, type Overview, useOverviewFormat } from "./overviewShared";

const BAR_HEIGHT = 170;

/**
 * Income and spending for the six months ending with the one on screen, and what was kept.
 *
 * Bars rather than lines: six values per series are counted, not read as a curve, and the month on
 * screen is highlighted so moving through months shows where you are.
 */
export function SixMonthTrend({ overview }: { overview: Overview }) {
  const { t } = useTranslation();
  const f = useOverviewFormat();
  const { trend, month } = overview;
  const max = Math.max(1, ...trend.flatMap((m) => [m.incomeCents, m.expensesCents]));

  return (
    <Panel labelledBy="trend-title" testId="dashboard-trend" className="flex flex-col gap-5">
      <PanelTitle
        id="trend-title"
        aside={
          <div className="flex gap-4 text-xs text-gray-700 sm:text-sm dark:text-gray-300">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-300" />{t("overview.trend.income")}</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-700" />{t("overview.trend.spent")}</span>
          </div>
        }
      >
        {t("overview.trend.title")}
      </PanelTitle>

      <ul className="grid grid-cols-6 items-start gap-1 sm:gap-3">
        {trend.map((m) => {
          const selected = m.key === month.key;
          const kept = m.incomeCents - m.expensesCents;
          const inProgress = selected && month.status === "current";
          return (
            <li
              key={m.key}
              className={`flex flex-col items-center gap-2 rounded-xl px-0.5 py-2 sm:px-1 ${selected ? "bg-blue-50 dark:bg-blue-950/50" : ""}`}
              aria-label={t("overview.trend.month_label", {
                month: f.monthLabel(m.key),
                income: f.money(m.incomeCents),
                spent: f.money(m.expensesCents),
              })}
            >
              <div className="flex items-end gap-0.5 sm:gap-1.5" style={{ height: BAR_HEIGHT * 0.65 }} aria-hidden="true">
                <div className="w-2.5 rounded-t bg-blue-300 sm:w-5" style={{ height: `${(m.incomeCents / max) * BAR_HEIGHT * 0.65}px` }} />
                <div className="w-2.5 rounded-t bg-blue-700 sm:w-5" style={{ height: `${(m.expensesCents / max) * BAR_HEIGHT * 0.65}px` }} />
              </div>
              <span className={`text-xs sm:text-[13px] ${selected ? "font-bold" : "font-medium"} text-gray-900 dark:text-white`}>
                {f.monthShort(m.key)}
              </span>
              <span
                className={`hidden text-xs font-semibold tabular-nums sm:block ${kept >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}
                aria-hidden="true"
              >
                {kept >= 0 ? "+" : "−"}{f.money(Math.abs(kept))}
              </span>
              {inProgress && <span className="hidden text-[11px] text-gray-600 sm:block dark:text-gray-400">{t("overview.trend.so_far")}</span>}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
