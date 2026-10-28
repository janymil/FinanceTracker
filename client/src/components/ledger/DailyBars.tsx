import { useTranslation } from "react-i18next";
import type { LedgerDay } from "@shared/ledger";
import { cn } from "@/lib/utils";
import { useOverviewFormat } from "@/components/page/kit";

const HEIGHT = 56;

/**
 * One bar per day of the month: how spending was spread. Days still to come show what is
 * scheduled in amber; today is marked. Read as a shape, not as figures — the figures are in the
 * list below — so the bars carry one summary label instead of thirty.
 */
export function DailyBars({
  monthKey,
  daysInMonth,
  days,
  today,
  field = "expenseCents",
}: {
  monthKey: string;
  daysInMonth: number;
  days: LedgerDay<unknown>[];
  /** Day of the month that is today, or 0 when the month is not the current one. */
  today: number;
  field?: "expenseCents" | "incomeCents";
}) {
  const { t } = useTranslation();
  const f = useOverviewFormat();
  const byDay = new Map(days.map((day) => [Number(day.key.slice(8)), day]));
  const values = Array.from({ length: daysInMonth }, (_, i) => byDay.get(i + 1)?.[field] ?? 0);
  const max = Math.max(1, ...values);
  const busiest = values.indexOf(Math.max(...values));

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="img"
        aria-label={values[busiest] > 0
          ? t("page.ledger.daily_bars_label", { day: f.dayLabel(`${monthKey}-${String(busiest + 1).padStart(2, "0")}`), amount: f.money(values[busiest]) })
          : t("page.ledger.daily_bars_empty")}
        className="flex items-end gap-[2px] sm:gap-1"
        style={{ height: HEIGHT }}
      >
        {values.map((value, i) => {
          const day = i + 1;
          const scheduled = byDay.get(day)?.scheduled ?? false;
          return (
            <div
              key={day}
              className={cn(
                "flex-1 rounded-t-sm",
                value === 0 ? "bg-gray-100 dark:bg-gray-800" : scheduled ? "bg-amber-400" : field === "incomeCents" ? "bg-emerald-600" : "bg-blue-600",
                day === today && "outline outline-2 outline-offset-1 outline-gray-900 dark:outline-white",
              )}
              style={{ height: value === 0 ? 3 : Math.max(4, (value / max) * HEIGHT) }}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400" aria-hidden="true">
        <span>1</span>
        <span>{Math.ceil(daysInMonth / 2)}</span>
        <span>{daysInMonth}</span>
      </div>
    </div>
  );
}
