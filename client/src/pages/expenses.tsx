import { useMemo } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Store, TrendingUp, Trophy } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { LedgerPanel, type TxRow } from "@/components/ledger/LedgerPanel";
import { MonthBars } from "@/components/ledger/MonthBars";
import { RecurringRulesCard } from "@/components/RecurringRulesCard";
import { AddMenuButton } from "@/components/page/AddMenuButton";
import {
  CategoryTile,
  ChangeChip,
  HeroCard,
  HeroStat,
  LoadError,
  MonthStepper,
  PageHeader,
  PageShell,
  Panel,
  PanelSkeleton,
  PanelTitle,
  linkButton,
  useLangHref,
  useMonthNavigation,
  useOverviewFormat,
} from "@/components/page/kit";
import { buildMonthLedger } from "@shared/ledger";
import { parseAmountToCents } from "@shared/money";

/**
 * Where the money went this month, and whether that is normal for this person.
 *
 * The old page showed a total, an "average expense" (total divided by the number of rows, which
 * says nothing) and a pie chart of the whole history. This one answers the questions people ask:
 * how much so far, more or less than usual, how much is fixed and how much is everyday choices,
 * where it goes (category and place), and where the month is heading.
 */
export default function Expenses() {
  const { t } = useTranslation();
  const f = useOverviewFormat();
  const href = useLangHref();
  const nav = useMonthNavigation(null, { allowFuture: true });
  const { data, isLoading, error, refetch } = useTransactions();
  const rows: TxRow[] = Array.isArray(data) ? data : [];
  const expenses = useMemo(() => rows.filter((row) => row.type === "expense"), [rows]);
  const ledger = useMemo(
    () => buildMonthLedger(rows, nav.monthKey, { timeZone: nav.timeZone }),
    [rows, nav.monthKey, nav.timeZone],
  );
  const { clock } = ledger;
  const isCurrent = clock.status === "current";
  const monthName = f.monthName(nav.monthKey);

  const note = isCurrent
    ? t("overview.progress_current", { day: clock.daysElapsed, total: clock.daysInMonth, count: clock.daysLeft })
    : clock.status === "past" ? t("overview.progress_closed") : t("overview.progress_future");

  let sub: string;
  if (ledger.expenseCount === 0) {
    sub = t("page.expenses.hero_sub_none");
  } else if (isCurrent && ledger.samePointLastMonthCents) {
    const diff = ledger.expenseCents - ledger.samePointLastMonthCents;
    sub = diff <= 0
      ? t("page.expenses.hero_sub_less", { amount: f.money(-diff) })
      : t("page.expenses.hero_sub_more", { amount: f.money(diff) });
  } else if (ledger.usualExpenseCents) {
    const pct = Math.round(((ledger.expenseCents - ledger.usualExpenseCents) * 100) / ledger.usualExpenseCents);
    sub = Math.abs(pct) < 5
      ? t("page.expenses.hero_sub_usual_same")
      : pct < 0
        ? t("page.expenses.hero_sub_usual_less", { pct: -pct })
        : t("page.expenses.hero_sub_usual_more", { pct });
  } else {
    sub = t("page.expenses.hero_sub_count", { count: ledger.expenseCount });
  }

  const fixedShare = ledger.expenseCents > 0 ? Math.round((ledger.recurringExpenseCents * 100) / ledger.expenseCents) : 0;

  return (
    <PageShell testId="expenses-page">
      <PageHeader
        title={t("page.expenses.title")}
        subtitle={t("page.expenses.subtitle")}
        actions={<AddMenuButton label={t("page.ledger.add_expense")} preset={{ type: "expense" }} testId="add-expense" />}
      >
        <MonthStepper
          label={f.monthLabel(nav.monthKey)}
          onPrevious={nav.previous}
          onNext={nav.next}
          canGoNext={nav.canGoNext}
          isCurrent={nav.isCurrent}
          onCurrent={nav.reset}
          note={note}
        />
      </PageHeader>

      {error && <LoadError onRetry={() => refetch()} />}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <PanelSkeleton className="h-64 lg:col-span-12" />
          <PanelSkeleton className="h-80 lg:col-span-7" />
          <PanelSkeleton className="h-80 lg:col-span-5" />
        </div>
      ) : (
        <>
          <HeroCard
            tone="slate"
            testId="expenses-hero"
            label={isCurrent ? t("page.expenses.hero_label_current", { month: monthName }) : t("page.expenses.hero_label", { month: monthName })}
            amount={<span data-testid="expenses-total">{f.money(ledger.expenseCents)}</span>}
            sub={sub}
            help={t("page.expenses.hero_help")}
          >
            {ledger.expenseCents > 0 && (
              <div className="flex flex-col gap-2">
                <div
                  role="img"
                  aria-label={t("page.expenses.split_label", { fixed: f.money(ledger.recurringExpenseCents), everyday: f.money(ledger.everydayExpenseCents) })}
                  className="flex h-3 overflow-hidden rounded-full bg-white/20"
                >
                  <div className="bg-amber-400" style={{ width: `${fixedShare}%` }} />
                  <div className="bg-white/90" style={{ width: `${100 - fixedShare}%` }} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/90 sm:text-sm">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />{t("page.expenses.fixed")}</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-white/90" />{t("page.expenses.everyday")}</span>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
              <HeroStat label={t("page.expenses.fixed")} value={f.money(ledger.recurringExpenseCents)} note={t("page.expenses.fixed_note")} />
              <HeroStat label={t("page.expenses.everyday")} value={f.money(ledger.everydayExpenseCents)} note={t("page.expenses.everyday_note")} />
              <HeroStat
                label={t("page.expenses.per_day")}
                value={ledger.dailyAverageCents !== null ? f.money(ledger.dailyAverageCents) : "—"}
                note={t("page.expenses.per_day_note")}
              />
            </div>
            {ledger.projectedExpenseCents !== null && (
              <p className="flex items-center gap-2 rounded-xl bg-black/25 px-3.5 py-2.5 text-sm" data-testid="expenses-projection">
                <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
                {ledger.usualExpenseCents
                  ? t("page.expenses.projection_vs_usual", {
                      month: monthName,
                      amount: f.money(ledger.projectedExpenseCents),
                      usual: f.money(ledger.usualExpenseCents),
                    })
                  : t("page.expenses.projection", { month: monthName, amount: f.money(ledger.projectedExpenseCents) })}
              </p>
            )}
          </HeroCard>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <Panel labelledBy="exp-cats-title" className="flex flex-col gap-4 lg:col-span-7" testId="expenses-categories">
              <PanelTitle
                id="exp-cats-title"
                aside={<Link href={href("/budget")} className={linkButton}>{t("page.expenses.set_budgets")}</Link>}
              >
                {t("page.expenses.categories_title")}
              </PanelTitle>
              {ledger.expenseCategories.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-600 dark:text-gray-400">{t("page.expenses.nothing_yet")}</p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {ledger.expenseCategories.map((category) => (
                    <li key={category.key} className="flex items-center gap-3">
                      <CategoryTile color={category.color} icon={category.icon} name={category.name} />
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                              {category.key === "uncategorized" ? t("page.common.uncategorized") : category.name}
                            </span>
                            <ChangeChip pct={category.changePct} />
                          </span>
                          <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{f.money(category.cents)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                          <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(2, category.shareBp / 100)}%` }} />
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {t("page.expenses.category_meta", {
                            share: Math.round(category.shareBp / 100),
                            count: category.count,
                            ticket: f.money(Math.round(category.cents / Math.max(1, category.count))),
                          })}
                          {category.usualCents !== null && ` · ${t("page.expenses.usual_amount", { amount: f.money(category.usualCents) })}`}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <div className="flex flex-col gap-5 lg:col-span-5">
              <Panel labelledBy="payees-title" className="flex flex-col gap-3" testId="expenses-payees">
                <PanelTitle id="payees-title">
                  <Store className="h-4 w-4 text-gray-500" aria-hidden="true" />
                  {t("page.expenses.payees_title")}
                </PanelTitle>
                {ledger.payees.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-600 dark:text-gray-400">{t("page.expenses.nothing_yet")}</p>
                ) : (
                  <ol className="flex flex-col">
                    {ledger.payees.slice(0, 6).map((payee, index) => (
                      <li key={`${payee.name}-${index}`} className="flex items-center gap-3 border-b border-gray-100 py-2 last:border-b-0 dark:border-gray-800">
                        <span className="w-5 text-right text-xs font-semibold text-gray-500 tabular-nums">{index + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-white">{payee.name}</span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">{t("page.expenses.times", { count: payee.count })}</span>
                        <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{f.money(payee.cents)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </Panel>

              <Panel labelledBy="largest-title" className="flex flex-col gap-3">
                <PanelTitle id="largest-title">
                  <Trophy className="h-4 w-4 text-gray-500" aria-hidden="true" />
                  {t("page.expenses.largest_title")}
                </PanelTitle>
                {ledger.largestExpenses.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-600 dark:text-gray-400">{t("page.expenses.nothing_yet")}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {ledger.largestExpenses.map((row) => (
                      <li key={row.id} className="flex items-center gap-3">
                        <CategoryTile color={row.categoryColor} icon={row.categoryIcon} name={row.description} size="sm" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium text-gray-900 dark:text-white">{row.description}</span>
                          <span className="truncate text-xs text-gray-600 dark:text-gray-400">{row.categoryName || t("page.common.uncategorized")}</span>
                        </span>
                        <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                          {f.money(Math.abs(parseAmountToCents(row.amount)))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <Panel labelledBy="exp-history-title" className="flex flex-col gap-4 lg:col-span-12">
              <PanelTitle
                id="exp-history-title"
                aside={ledger.usualExpenseCents !== null
                  ? <span className="text-xs text-gray-600 sm:text-sm dark:text-gray-400">{t("page.expenses.usual_month", { amount: f.money(ledger.usualExpenseCents) })}</span>
                  : undefined}
              >
                {t("page.expenses.history_title")}
              </PanelTitle>
              <MonthBars
                months={ledger.history.map((m) => ({ key: m.key, cents: m.expenseCents }))}
                selectedKey={nav.monthKey}
                inProgressKey={isCurrent ? nav.monthKey : null}
                onSelect={(key) => nav.set(key)}
                reference={ledger.usualExpenseCents}
              />
            </Panel>

            <div className="lg:col-span-12">
              <RecurringRulesCard kind="expense" />
            </div>
          </div>

          <LedgerPanel
            monthDays={ledger.days.map((day) => ({ ...day, rows: day.rows.filter((row) => row.type === "expense") })).filter((day) => day.rows.length > 0)}
            allRows={expenses}
            kind="expense"
            timeZone={nav.timeZone}
            title={t("page.expenses.list_title", { month: monthName })}
          />
        </>
      )}
    </PageShell>
  );
}
