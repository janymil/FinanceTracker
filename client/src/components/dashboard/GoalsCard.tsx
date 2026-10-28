import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Panel, PanelTitle, type Overview, useLangHref, useOverviewFormat } from "./overviewShared";

const BAR_COLORS = ["bg-teal-600", "bg-blue-600", "bg-violet-600"];
const SHOWN = 3;

/** Savings goals, nearest target date first, each with what it takes per month from now. */
export function GoalsCard({ overview, className }: { overview: Overview; className?: string }) {
  const { t } = useTranslation();
  const f = useOverviewFormat();
  const href = useLangHref();
  const goals = overview.goals.slice(0, SHOWN);

  return (
    <Panel labelledBy="goals-title" testId="dashboard-goals" className={`flex flex-col gap-4 ${className ?? ""}`}>
      <PanelTitle
        id="goals-title"
        aside={<Link href={href("/goals")} className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">{t("overview.goals.manage")}</Link>}
      >
        {t("overview.goals.title")}
      </PanelTitle>

      {goals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t("overview.goals.empty")}</p>
          <Link href={href("/goals")} className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
            {t("overview.goals.create")}
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {goals.map((goal, index) => {
            const note = goal.reached
              ? { text: t("overview.goals.reached"), cls: "text-emerald-700 dark:text-emerald-400" }
              : goal.overdue
                ? { text: t("overview.goals.overdue"), cls: "text-amber-700 dark:text-amber-400" }
                : goal.monthlyNeededCents !== null
                  ? { text: t("overview.goals.per_month", { amount: f.money(goal.monthlyNeededCents) }), cls: "text-gray-700 dark:text-gray-300" }
                  : null;
            return (
              <li key={goal.id} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{goal.name}</span>
                  <span className="whitespace-nowrap text-[13px] text-gray-600 dark:text-gray-400">
                    <span className="font-semibold text-gray-900 tabular-nums dark:text-white">{f.money(goal.savedCents)}</span>
                    {" "}{t("overview.goals.of")}{" "}{f.money(goal.targetCents)}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={goal.percent}
                  aria-label={goal.name}
                  className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                >
                  <div className={`h-full rounded-full ${BAR_COLORS[index % BAR_COLORS.length]}`} style={{ width: `${goal.percent}%` }} />
                </div>
                <div className="flex justify-between gap-2 text-xs">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t("overview.goals.progress", { pct: goal.percent, date: f.dateLabel(goal.targetDate) })}
                  </span>
                  {note && <span className={`font-semibold ${note.cls}`}>{note.text}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
