import { useMemo } from "react";
import { Link, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowDownLeft, ArrowUpRight, CalendarClock, Scale } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { LedgerPanel, type TxRow } from "@/components/ledger/LedgerPanel";
import { DailyBars } from "@/components/ledger/DailyBars";
import {
  CategoryTile,
  LoadError,
  MonthStepper,
  PageHeader,
  PageShell,
  Panel,
  PanelSkeleton,
  PanelTitle,
  StatTile,
  linkButton,
  useLangHref,
  useMonthNavigation,
  useOverviewFormat,
} from "@/components/page/kit";
import { buildMonthLedger } from "@shared/ledger";

/**
 * Everything that came in and went out, one month at a time.
 *
 * `?month=YYYY-MM` opens a given month: the receipt scanner sends the person here after saving an
 * expense dated in another month, because a saved bill that appears nowhere reads as "not saved".
 * `?filter=uncategorized` opens on the rows without a category (the dashboard's "Categorize").
 */
export default function Transactions() {
  const { t } = useTranslation();
  const f = useOverviewFormat();
  const href = useLangHref();
  const params = new URLSearchParams(useSearch());
  const monthParam = params.get("month");
  const monthFromUrl = monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : null;
  const nav = useMonthNavigation(monthFromUrl, { allowFuture: true });
  const { data, isLoading, error, refetch } = useTransactions();
  const rows: TxRow[] = Array.isArray(data) ? data : [];

  const ledger = useMemo(
    () => buildMonthLedger(rows, nav.monthKey, { timeZone: nav.timeZone }),
    [rows, nav.monthKey, nav.timeZone],
  );
  const { clock } = ledger;
  const isCurrent = clock.status === "current";

  const note = isCurrent
    ? t("overview.progress_current", { day: clock.daysElapsed, total: clock.daysInMonth, count: clock.daysLeft })
    : clock.status === "past" ? t("overview.progress_closed") : t("overview.progress_future");

  const spentDays = ledger.days.filter((day) => !day.scheduled && day.expenseCents > 0).length;
  const noSpendDays = Math.max(0, clock.daysElapsed - spentDays);

  let outNote = t("page.transactions.count", { count: ledger.expenseCount });
  if (ledger.samePointLastMonthCents !== null && ledger.samePointLastMonthCents > 0) {
    outNote = t("page.transactions.by_now_last_month", { amount: f.money(ledger.samePointLastMonthCents) });
  }

  return (
    <PageShell testId="transactions-page">
      <PageHeader
        title={t("page.transactions.title")}
        subtitle={t("page.transactions.subtitle")}
      >
        <MonthStepper
          label={f.monthLabel(nav.monthKey)}
          onPrevious={nav.previous}
          onNext={nav.next}
          canGoNext={nav.canGoNext}
          isCurrent={nav.isCurrent}
          onCurrent={nav.reset}
          note={note}
          testId="transactions-month"
        />
      </PageHeader>

      {error && <LoadError onRetry={() => refetch()} />}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <PanelSkeleton className="h-28 lg:col-span-12" />
          <PanelSkeleton className="h-[480px] lg:col-span-8" />
          <PanelSkeleton className="h-64 lg:col-span-4" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile
              icon={<ArrowUpRight className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />}
              label={t("page.transactions.money_in")}
              value={`+${f.money(ledger.incomeCents)}`}
              tone="good"
              note={t("page.transactions.count", { count: ledger.incomeCount })}
            />
            <StatTile
              icon={<ArrowDownLeft className="h-4 w-4" aria-hidden="true" />}
              label={t("page.transactions.money_out")}
              value={`−${f.money(ledger.expenseCents)}`}
              note={outNote}
            />
            <StatTile
              icon={<Scale className="h-4 w-4" aria-hidden="true" />}
              label={t("page.transactions.balance")}
              value={`${ledger.netCents < 0 ? "−" : "+"}${f.money(Math.abs(ledger.netCents))}`}
              tone={ledger.netCents < 0 ? "bad" : "good"}
              note={ledger.scheduledCount > 0
                ? t("page.transactions.scheduled_note", { count: ledger.scheduledCount, amount: f.money(ledger.scheduledExpenseCents) })
                : t("page.transactions.balance_note")}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-8">
              <LedgerPanel
                monthDays={ledger.days}
                allRows={rows}
                kind="all"
                timeZone={nav.timeZone}
                startUncategorized={params.get("filter") === "uncategorized"}
                title={t("page.transactions.list_title")}
              />
            </div>

            <aside className="flex flex-col gap-5 lg:col-span-4">
              <Panel labelledBy="rhythm-title" className="flex flex-col gap-4">
                <PanelTitle id="rhythm-title">{t("page.transactions.rhythm_title")}</PanelTitle>
                <DailyBars
                  monthKey={nav.monthKey}
                  daysInMonth={clock.daysInMonth}
                  days={ledger.days}
                  today={isCurrent ? clock.daysElapsed : 0}
                />
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex flex-col gap-0.5 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60">
                    <dt className="text-xs text-gray-600 dark:text-gray-400">{t("page.transactions.daily_average")}</dt>
                    <dd className="font-semibold tabular-nums text-gray-900 dark:text-white">
                      {ledger.dailyAverageCents !== null ? f.money(ledger.dailyAverageCents) : "—"}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-0.5 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60">
                    <dt className="text-xs text-gray-600 dark:text-gray-400">{t("page.transactions.no_spend_days")}</dt>
                    <dd className="font-semibold tabular-nums text-gray-900 dark:text-white">
                      {clock.daysElapsed > 0 ? t("page.transactions.days_of", { count: noSpendDays, total: clock.daysElapsed }) : "—"}
                    </dd>
                  </div>
                </dl>
                {ledger.scheduledCount > 0 && (
                  <p className="flex items-center gap-2 text-[13px] text-amber-800 dark:text-amber-300">
                    <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t("page.transactions.scheduled_legend")}
                  </p>
                )}
              </Panel>

              <Panel labelledBy="top-cats-title" className="flex flex-col gap-3">
                <PanelTitle
                  id="top-cats-title"
                  aside={<Link href={href("/expenses")} className={linkButton}>{t("page.transactions.see_expenses")}</Link>}
                >
                  {t("page.transactions.top_categories")}
                </PanelTitle>
                {ledger.expenseCategories.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-600 dark:text-gray-400">{t("page.transactions.no_spending")}</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {ledger.expenseCategories.slice(0, 5).map((category) => (
                      <li key={category.key} className="flex items-center gap-3">
                        <CategoryTile color={category.color} icon={category.icon} name={category.name} size="sm" />
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="truncate font-medium text-gray-900 dark:text-white">
                              {category.key === "uncategorized" ? t("page.common.uncategorized") : category.name}
                            </span>
                            <span className="whitespace-nowrap font-semibold tabular-nums text-gray-900 dark:text-white">{f.money(category.cents)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                            <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(2, category.shareBp / 100)}%` }} />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </aside>
          </div>
        </>
      )}
    </PageShell>
  );
}
