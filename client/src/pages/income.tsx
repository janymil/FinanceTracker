import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, PiggyBank, Plus, Waves } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { LedgerPanel, type TxRow } from "@/components/ledger/LedgerPanel";
import { MonthBars } from "@/components/ledger/MonthBars";
import { RecurringRulesCard } from "@/components/RecurringRulesCard";
import { requestQuickAdd } from "@/lib/quickAdd";
import {
  CategoryTile,
  EmptyState,
  HeroCard,
  HeroStat,
  LoadError,
  MonthStepper,
  PageHeader,
  PageShell,
  Panel,
  PanelSkeleton,
  PanelTitle,
  primaryButton,
  useMonthNavigation,
  useOverviewFormat,
} from "@/components/page/kit";
import { buildMonthLedger } from "@shared/ledger";

/**
 * What came in this month, from where, and how it compares with the person's usual month.
 *
 * Income is lumpy (a salary on the 1st, a freelance job now and then), so the page leans on the
 * six-month view: how steady income is, what part of it arrives on its own every month, and what
 * share of each 100 that came in was kept.
 */
export default function Income() {
  const { t } = useTranslation();
  const f = useOverviewFormat();
  const nav = useMonthNavigation(null, { allowFuture: true });
  const { data, isLoading, error, refetch } = useTransactions();
  const rows: TxRow[] = Array.isArray(data) ? data : [];
  const incomes = useMemo(() => rows.filter((row) => row.type === "income"), [rows]);
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
  if (ledger.incomeCents === 0) {
    sub = ledger.scheduledIncomeCents > 0 ? t("page.income.hero_sub_only_scheduled") : t("page.income.hero_sub_none");
  } else if (ledger.usualIncomeCents) {
    const pct = Math.round(((ledger.incomeCents - ledger.usualIncomeCents) * 100) / ledger.usualIncomeCents);
    sub = Math.abs(pct) < 5
      ? t("page.income.hero_sub_same")
      : pct > 0
        ? t("page.income.hero_sub_more", { amount: f.money(ledger.incomeCents - ledger.usualIncomeCents) })
        : t("page.income.hero_sub_less", { amount: f.money(ledger.usualIncomeCents - ledger.incomeCents) });
  } else {
    sub = t("page.income.hero_sub_count", { count: ledger.incomeCount });
  }

  const keptCents = ledger.incomeCents - ledger.expenseCents;
  // Out of every 100 (in the account's currency) that came in: how much went out, how much stayed.
  const spentOf100 = ledger.incomeCents > 0 ? Math.min(100, Math.round((ledger.expenseCents * 100) / ledger.incomeCents)) : null;

  const steadiness = ledger.incomeVariationPct === null
    ? null
    : ledger.incomeVariationPct < 15 ? "steady" : ledger.incomeVariationPct < 40 ? "varies" : "irregular";

  const addIncome = (
    <button type="button" className={primaryButton} onClick={() => requestQuickAdd("type", { type: "income" })} data-testid="add-income">
      <Plus className="h-4 w-4" aria-hidden="true" />
      {t("page.ledger.add_income")}
    </button>
  );

  return (
    <PageShell testId="income-page">
      <PageHeader title={t("page.income.title")} subtitle={t("page.income.subtitle")} actions={addIncome}>
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
          <PanelSkeleton className="h-72 lg:col-span-6" />
          <PanelSkeleton className="h-72 lg:col-span-6" />
        </div>
      ) : (
        <>
          <HeroCard
            tone="emerald"
            testId="income-hero"
            label={t("page.income.hero_label", { month: monthName })}
            amount={f.money(ledger.incomeCents)}
            sub={sub}
            help={t("page.income.hero_help")}
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
              <HeroStat label={t("page.income.regular")} value={f.money(ledger.recurringIncomeCents)} note={t("page.income.regular_note")} />
              <HeroStat label={t("page.income.one_off")} value={f.money(ledger.oneOffIncomeCents)} note={t("page.income.one_off_note")} />
              <HeroStat
                label={t("page.income.kept")}
                value={`${keptCents < 0 ? "−" : ""}${f.money(Math.abs(keptCents))}`}
                note={t("page.income.kept_note")}
              />
            </div>
            {ledger.scheduledIncomeCents > 0 && (
              <p className="flex items-center gap-2 rounded-xl bg-black/20 px-3.5 py-2.5 text-sm">
                <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t("page.income.still_expected", { amount: f.money(ledger.scheduledIncomeCents) })}
              </p>
            )}
          </HeroCard>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <Panel labelledBy="sources-title" className="flex flex-col gap-4 lg:col-span-6" testId="income-sources">
              <PanelTitle id="sources-title">{t("page.income.sources_title")}</PanelTitle>
              {ledger.incomeCategories.length === 0 ? (
                <EmptyState
                  icon={<Waves className="h-6 w-6" aria-hidden="true" />}
                  title={t("page.income.no_income_title", { month: monthName })}
                  body={t("page.income.no_income_body")}
                  action={addIncome}
                />
              ) : (
                <ul className="flex flex-col gap-4">
                  {ledger.incomeCategories.map((source) => (
                    <li key={source.key} className="flex items-center gap-3">
                      <CategoryTile color={source.color ?? "#047857"} icon={source.icon} name={source.name} />
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                            {source.key === "uncategorized" ? t("page.common.uncategorized") : source.name}
                          </span>
                          <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                            +{f.money(source.cents)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(2, source.shareBp / 100)}%` }} />
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {t("page.income.source_meta", { share: Math.round(source.shareBp / 100), count: source.count })}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel labelledBy="of100-title" className="flex flex-col gap-4 lg:col-span-6" testId="income-of-100">
              <PanelTitle id="of100-title">
                <PiggyBank className="h-4 w-4 text-gray-500" aria-hidden="true" />
                {t("page.income.of100_title", { amount: f.money(10000) })}
              </PanelTitle>
              {spentOf100 === null ? (
                <p className="py-6 text-center text-sm text-gray-600 dark:text-gray-400">{t("page.income.of100_empty")}</p>
              ) : (
                <>
                  <div className="grid w-full max-w-[15rem] grid-cols-10 gap-1 self-center" role="img" aria-label={t("page.income.of100_sentence", {
                    spent: f.money(spentOf100 * 100),
                    kept: f.money(Math.max(0, 100 - spentOf100) * 100),
                  })}>
                    {Array.from({ length: 100 }, (_, i) => (
                      <span
                        key={i}
                        aria-hidden="true"
                        className={`aspect-square rounded-[3px] ${i < spentOf100 ? "bg-gray-300 dark:bg-gray-700" : "bg-emerald-600"}`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {keptCents >= 0
                      ? t("page.income.of100_sentence", {
                          spent: f.money(spentOf100 * 100),
                          kept: f.money(Math.max(0, 100 - spentOf100) * 100),
                        })
                      : t("page.income.of100_over", { amount: f.money(-keptCents) })}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700 dark:text-gray-300">
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-gray-300 dark:bg-gray-700" />{t("page.income.spent")}</span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />{t("page.income.kept")}</span>
                  </div>
                </>
              )}
            </Panel>

            <Panel labelledBy="inc-history-title" className="flex flex-col gap-4 lg:col-span-12">
              <PanelTitle
                id="inc-history-title"
                aside={ledger.usualIncomeCents !== null
                  ? <span className="text-xs text-gray-600 sm:text-sm dark:text-gray-400">{t("page.income.usual_month", { amount: f.money(ledger.usualIncomeCents) })}</span>
                  : undefined}
              >
                {t("page.income.history_title")}
              </PanelTitle>
              <MonthBars
                months={ledger.history.map((m) => ({ key: m.key, cents: m.incomeCents }))}
                selectedKey={nav.monthKey}
                inProgressKey={isCurrent ? nav.monthKey : null}
                onSelect={(key) => nav.set(key)}
                reference={ledger.usualIncomeCents}
                tone="emerald"
              />
              {steadiness && (
                <p className="rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm text-gray-700 dark:bg-gray-800/60 dark:text-gray-300" data-testid="income-steadiness">
                  {t(`page.income.steadiness_${steadiness}`, { pct: ledger.incomeVariationPct })}
                </p>
              )}
            </Panel>

            <div className="lg:col-span-12">
              <RecurringRulesCard kind="income" />
            </div>
          </div>

          <LedgerPanel
            monthDays={ledger.days.map((day) => ({ ...day, rows: day.rows.filter((row) => row.type === "income") })).filter((day) => day.rows.length > 0)}
            allRows={incomes}
            kind="income"
            timeZone={nav.timeZone}
            title={t("page.income.list_title", { month: monthName })}
          />
        </>
      )}
    </PageShell>
  );
}
