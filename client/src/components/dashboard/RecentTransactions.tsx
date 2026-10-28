import { Link } from "wouter";
import { isToday, isYesterday } from "date-fns";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/context/CurrencyContext";
import { Panel, PanelTitle, useLangHref, useOverviewFormat } from "./overviewShared";

interface Row {
  id: number;
  description: string;
  amount: string | number;
  type: "income" | "expense";
  date: string;
  categoryName?: string | null;
  categoryColor?: string | null;
}

/**
 * The last five things the person recorded, one line each.
 *
 * The old list spent four lines per row and printed every amount in US dollars whatever the
 * account's currency; this one uses the account's currency like every other card on the page.
 * Payments dated in the future are left out: they are bills still to come, shown above.
 */
export function RecentTransactions({ transactions, className }: { transactions: Row[] | undefined; className?: string }) {
  const { t } = useTranslation();
  const { formatMoney } = useCurrency();
  const f = useOverviewFormat();
  const href = useLangHref();
  const now = Date.now();

  const rows = (Array.isArray(transactions) ? transactions : [])
    .filter((row) => new Date(row.date).getTime() <= now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const when = (value: string) => {
    const date = new Date(value);
    if (isToday(date)) return t("overview.recent.today");
    if (isYesterday(date)) return t("overview.recent.yesterday");
    return new Intl.DateTimeFormat(f.locale, { day: "numeric", month: "short" }).format(date);
  };

  return (
    <Panel labelledBy="recent-title" testId="dashboard-recent" className={`flex flex-col gap-2 ${className ?? ""}`}>
      <PanelTitle
        id="recent-title"
        aside={<Link href={href("/transactions")} className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">{t("overview.recent.view_all")}</Link>}
      >
        {t("overview.recent.title")}
      </PanelTitle>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-600 dark:text-gray-400">{t("overview.recent.empty")}</p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {rows.map((row) => {
            const expense = row.type === "expense";
            const amount = Math.abs(Number(row.amount) || 0);
            const tint = row.categoryColor && /^#[0-9a-f]{6}$/i.test(row.categoryColor) ? row.categoryColor : expense ? "#475569" : "#04774D";
            return (
              <li key={row.id}>
                <Link
                  href={href("/transactions")}
                  className="flex items-center gap-3.5 rounded-xl px-2 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[15px] font-bold"
                    style={{ background: `${tint}1A`, color: tint }}
                  >
                    {(row.description || "?").trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{row.description}</span>
                    <span className="truncate text-[13px] text-gray-600 dark:text-gray-400">
                      {row.categoryName || t("overview.recent.uncategorized")} · {when(row.date)}
                    </span>
                  </span>
                  <span className={`whitespace-nowrap text-[15px] font-semibold tabular-nums ${expense ? "text-gray-900 dark:text-white" : "text-emerald-700 dark:text-emerald-400"}`}>
                    {expense ? "−" : "+"}{formatMoney(amount)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
