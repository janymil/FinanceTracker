import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import type { CategoryLine } from "@shared/dashboardOverview";
import { HelpTooltip } from "@/components/help-tooltip";
import { Panel, PanelTitle, type Overview, useLangHref, useOverviewFormat } from "./overviewShared";

/** Used when a category has no colour of its own. Distinct in lightness as well as hue. */
const FALLBACK_COLORS = ["#2563EB", "#0D9488", "#EA580C", "#7C3AED", "#0891B2", "#DB2777", "#CA8A04", "#16A34A"];
const SHOWN = 6;
/** Within this many percent of the usual month the difference is noise, not news. */
const ABOUT_USUAL_PCT = 10;

/**
 * Where the money went, against the person's own usual month.
 *
 * A pie of categories says what is big; it cannot say what is unusual. Each line here carries the
 * comparison with the person's average over the three months before, which is the question someone
 * actually asks of their spending ("is this more than normal?").
 */
export function SpendingByCategory({ overview, className }: { overview: Overview; className?: string }) {
  const { t } = useTranslation();
  const f = useOverviewFormat();
  const href = useLangHref();
  const { categories, totals, uncategorized } = overview;
  const shown = categories.slice(0, SHOWN);
  const rest = categories.slice(SHOWN).reduce((sum, line) => sum + line.amountCents, 0);
  const color = (line: CategoryLine, index: number) =>
    line.color && /^#[0-9a-f]{6}$/i.test(line.color) ? line.color : FALLBACK_COLORS[index % FALLBACK_COLORS.length];

  const change = (line: CategoryLine) => {
    if (line.changePct === null) {
      return { text: t("overview.categories.new"), cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" };
    }
    if (line.changePct >= ABOUT_USUAL_PCT) {
      return { text: t("overview.categories.over", { pct: line.changePct }), cls: "bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-300" };
    }
    if (line.changePct <= -ABOUT_USUAL_PCT) {
      return { text: t("overview.categories.under", { pct: Math.abs(line.changePct) }), cls: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" };
    }
    return { text: t("overview.categories.about"), cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" };
  };

  return (
    <Panel labelledBy="categories-title" testId="dashboard-categories" className={`flex flex-col gap-4 ${className ?? ""}`}>
      <PanelTitle
        id="categories-title"
        aside={<Link href={href("/reports")} className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">{t("overview.categories.all")}</Link>}
      >
        {t("overview.categories.title")}
        <HelpTooltip>{t("overview.categories.help")}</HelpTooltip>
      </PanelTitle>

      {totals.spentCents === 0 ? (
        <p className="py-6 text-center text-sm text-gray-600 dark:text-gray-400">{t("overview.categories.empty")}</p>
      ) : (
        <>
          <p className="-mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t("overview.categories.subtitle", { amount: f.money(totals.spentCents) })}
          </p>
          <div role="img" aria-label={t("overview.categories.bar_label")} className="flex h-3.5 gap-0.5 overflow-hidden rounded-full">
            {shown.map((line, index) => (
              <div key={line.name} style={{ width: `${line.shareBp / 100}%`, background: color(line, index) }} />
            ))}
            <div className="flex-1 bg-gray-300 dark:bg-gray-700" />
          </div>
          <ul className="flex flex-col">
            {shown.map((line, index) => {
              const badge = change(line);
              return (
                <li
                  key={line.name}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-gray-100 py-2.5 last:border-0 sm:grid-cols-[minmax(0,1fr)_7rem_9.5rem] dark:border-gray-800"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color(line, index) }} />
                    <span className="truncate text-sm text-gray-900 dark:text-white">{line.name}</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">{f.percent(line.shareBp)}%</span>
                  </div>
                  <span className="text-right text-sm font-semibold text-gray-900 tabular-nums dark:text-white">{f.money(line.amountCents)}</span>
                  <span className={`col-span-2 justify-self-start whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold sm:col-span-1 sm:justify-self-end ${badge.cls}`}>
                    {badge.text}
                  </span>
                </li>
              );
            })}
          </ul>
          {(rest > 0 || uncategorized.amountCents > 0) && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {[
                rest > 0 ? t("overview.categories.others", { amount: f.money(rest) }) : null,
                uncategorized.amountCents > 0 ? t("overview.categories.uncategorized", { amount: f.money(uncategorized.amountCents) }) : null,
              ].filter(Boolean).join(" · ")}
            </p>
          )}
        </>
      )}
    </Panel>
  );
}
