import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useOverviewFormat } from "@/components/page/kit";

const HEIGHT = 120;

/**
 * One bar per month, the month on screen highlighted, an optional dashed line at the person's
 * usual month. Each bar is a button: tapping October opens October.
 */
export function MonthBars({
  months,
  selectedKey,
  inProgressKey,
  onSelect,
  reference,
  tone = "blue",
}: {
  months: { key: string; cents: number }[];
  selectedKey: string;
  inProgressKey: string | null;
  onSelect?: (key: string) => void;
  reference?: number | null;
  tone?: "blue" | "emerald";
}) {
  const { t } = useTranslation();
  const f = useOverviewFormat();
  const max = Math.max(1, reference ?? 0, ...months.map((m) => m.cents));
  const fill = tone === "emerald" ? "bg-emerald-600" : "bg-blue-600";
  const soft = tone === "emerald" ? "bg-emerald-200 dark:bg-emerald-900" : "bg-blue-200 dark:bg-blue-900";

  return (
    <div className="relative">
      {reference ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-gray-400 dark:border-gray-500"
          style={{ top: HEIGHT - (reference / max) * HEIGHT }}
        />
      ) : null}
      <ul className="grid gap-1 sm:gap-3" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
        {months.map((month) => {
          const selected = month.key === selectedKey;
          return (
            <li key={month.key}>
              <button
                type="button"
                disabled={!onSelect}
                onClick={() => onSelect?.(month.key)}
                aria-pressed={selected}
                className={cn(
                  "flex w-full flex-col items-center gap-1.5 rounded-xl px-0.5 pb-1.5 pt-0 transition-colors",
                  selected ? "bg-blue-50 dark:bg-blue-950/50" : onSelect ? "hover:bg-gray-50 dark:hover:bg-gray-800/60" : "",
                )}
              >
                <span className="flex w-full items-end justify-center" style={{ height: HEIGHT }} aria-hidden="true">
                  <span
                    className={cn("w-3/5 max-w-[2.5rem] rounded-t-md", selected ? fill : soft)}
                    style={{ height: Math.max(month.cents > 0 ? 4 : 2, (month.cents / max) * HEIGHT) }}
                  />
                </span>
                <span className={cn("text-xs text-gray-900 sm:text-[13px] dark:text-white", selected ? "font-bold" : "font-medium")}>
                  {f.monthShort(month.key)}
                </span>
                <span className="hidden text-[11px] font-semibold tabular-nums text-gray-600 sm:block dark:text-gray-400">
                  {f.money(month.cents)}
                </span>
                {month.key === inProgressKey && (
                  <span className="hidden text-[11px] font-semibold text-gray-600 sm:block dark:text-gray-400">{t("overview.trend.so_far")}</span>
                )}
                {/* The year, for a screen reader: the visible label is an abbreviation. A button's
                    accessible name must contain its visible text (WCAG 2.5.3), so the name is built
                    from the content plus this, never from an `aria-label` that replaces it. */}
                <span className="sr-only">{month.key.slice(0, 4)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
