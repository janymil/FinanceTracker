import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { BarChart3, Brain, Download, FileText, Trophy, Zap } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RequirePlan from "@/components/require-plan";
import AIInsights from "@/components/ai-insights";
import AutoCategorization from "@/components/auto-categorization";
import { useTransactions } from "@/hooks/useTransactions";
import { useUserTimeZone } from "@/hooks/useUserTimeZone";
import { cn } from "@/lib/utils";
import {
  CategoryTile,
  ChangeChip,
  HeroCard,
  HeroStat,
  LoadError,
  PageHeader,
  PageShell,
  Panel,
  PanelSkeleton,
  PanelTitle,
  Segmented,
  secondaryButton,
  useLangHref,
  useOverviewFormat,
} from "@/components/page/kit";
import { buildPeriodReport, presetRanges, previousOf, type DayRange, type ReportPreset } from "@shared/periodReport";
import { dayKeyIn, type LedgerTransaction } from "@shared/ledger";
import { parseAmountToCents } from "@shared/money";

type Row = LedgerTransaction & { description: string; amount: string; date: string };

const PRESETS: Exclude<ReportPreset, "custom">[] = ["month", "last_month", "quarter", "year", "last_12_months"];
const CHANGE_LABEL = { up: "page.reports.vs_previous_up", down: "page.reports.vs_previous_down", same: "page.reports.vs_previous_same" };

/**
 * A statement for any period, against the period before it.
 *
 * The old page had a "Custom range" that did nothing, printed category amounts in dollars, showed
 * the same data as three charts, and repeated the dashboard's recent list. Now a period gives one
 * answer (what was kept and at what rate), a month-by-month statement, where the money went
 * compared with the previous period, the largest payments, and one chart.
 */
export default function Reports() {
  const { t } = useTranslation();
  const f = useOverviewFormat();
  const href = useLangHref();
  const timeZone = useUserTimeZone();
  const { data, isLoading, error, refetch } = useTransactions();
  const rows: Row[] = Array.isArray(data) ? data : [];
  const today = dayKeyIn(new Date(), timeZone);

  const [preset, setPreset] = useState<ReportPreset>("month");
  const [custom, setCustom] = useState<DayRange>({ start: `${today.slice(0, 7)}-01`, end: today });
  const customValid = Boolean(custom.start && custom.end && custom.start <= custom.end);

  const { range, previous } = useMemo(() => {
    if (preset === "custom") {
      const r = customValid ? custom : { start: today, end: today };
      return { range: r, previous: previousOf(r) };
    }
    return presetRanges(preset, new Date(), timeZone);
  }, [preset, custom, customValid, timeZone, today]);

  const report = useMemo(() => buildPeriodReport(rows, range, previous, { timeZone }), [rows, range, previous, timeZone]);
  const periodRows = useMemo(
    () => rows.filter((row) => {
      const day = dayKeyIn(row.date, timeZone);
      return day >= range.start && day <= range.end;
    }),
    [rows, range, timeZone],
  );

  const periodLabel = `${f.dateLabel(range.start)} – ${f.dateLabel(range.end)}`;
  const multiMonth = report.months.length > 1;
  const best = multiMonth ? report.months.reduce((a, b) => (b.netCents > a.netCents ? b : a)) : null;
  const chartData = report.months.map((month) => ({
    label: f.monthShort(month.key),
    income: month.incomeCents / 100,
    expenses: month.expenseCents / 100,
    kept: month.netCents / 100,
  }));

  return (
    <PageShell testId="reports-page">
      <PageHeader
        title={t("page.reports.title")}
        subtitle={t("page.reports.subtitle")}
        actions={
          <Link href={href("/export")} className={secondaryButton}>
            <Download className="h-4 w-4" aria-hidden="true" />
            {t("page.reports.export")}
          </Link>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="-mx-1 overflow-x-auto px-1">
            <Segmented
              label={t("page.reports.period")}
              value={preset}
              onChange={setPreset}
              options={[
                ...PRESETS.map((value) => ({ value, label: t(`page.reports.preset_${value}`) })),
                { value: "custom" as const, label: t("page.reports.preset_custom") },
              ]}
            />
          </div>
          {preset === "custom" && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="report-from">{t("page.reports.from")}</Label>
                <Input id="report-from" type="date" value={custom.start} max={custom.end || undefined} onChange={(event) => setCustom((c) => ({ ...c, start: event.target.value }))} className="w-44" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="report-to">{t("page.reports.to")}</Label>
                <Input id="report-to" type="date" value={custom.end} min={custom.start || undefined} onChange={(event) => setCustom((c) => ({ ...c, end: event.target.value }))} className="w-44" />
              </div>
              {!customValid && <span className="pb-2 text-sm text-red-700 dark:text-red-400">{t("page.reports.range_invalid")}</span>}
            </div>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-400" data-testid="reports-range">
            {periodLabel} · {t("page.reports.compared_with", { range: `${f.dateLabel(previous.start)} – ${f.dateLabel(previous.end)}` })}
          </p>
        </div>
      </PageHeader>

      {error && <LoadError onRetry={() => refetch()} />}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5">
          <PanelSkeleton className="h-56" />
          <PanelSkeleton className="h-80" />
        </div>
      ) : (
        <>
          <HeroCard
            tone={report.netCents < 0 ? "slate" : "blue"}
            testId="reports-hero"
            label={report.netCents < 0 ? t("page.reports.hero_short_label") : t("page.reports.hero_label")}
            amount={f.money(Math.abs(report.netCents))}
            sub={
              report.savingsRateBp === null
                ? t("page.reports.hero_sub_no_income")
                : report.netCents < 0
                  ? t("page.reports.hero_sub_short")
                  : t("page.reports.hero_sub_rate", { pct: Math.round(report.savingsRateBp / 100) })
            }
            help={t("page.reports.hero_help")}
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
              <HeroStat
                label={t("page.reports.income")}
                value={f.money(report.incomeCents)}
                note={report.incomeChangePct !== null ? t("page.reports.change_note", { pct: `${report.incomeChangePct > 0 ? "+" : ""}${report.incomeChangePct}` }) : t("page.reports.no_previous")}
              />
              <HeroStat
                label={t("page.reports.expenses")}
                value={f.money(report.expenseCents)}
                note={report.expenseChangePct !== null ? t("page.reports.change_note", { pct: `${report.expenseChangePct > 0 ? "+" : ""}${report.expenseChangePct}` }) : t("page.reports.no_previous")}
              />
              <HeroStat
                label={t("page.reports.per_day")}
                value={report.dailyExpenseCents !== null ? f.money(report.dailyExpenseCents) : "—"}
                note={report.scheduledExpenseCents > 0 ? t("page.reports.scheduled_note", { amount: f.money(report.scheduledExpenseCents) }) : t("page.reports.per_day_note")}
              />
            </div>
          </HeroCard>

          <Tabs defaultValue="summary" className="flex flex-col gap-5">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1 md:w-auto md:grid-cols-4 md:self-start">
              <TabsTrigger value="summary" className="gap-1.5 rounded-lg"><FileText className="h-4 w-4" aria-hidden="true" />{t("reports.summary")}</TabsTrigger>
              <TabsTrigger value="chart" className="gap-1.5 rounded-lg"><BarChart3 className="h-4 w-4" aria-hidden="true" />{t("page.reports.tab_chart")}</TabsTrigger>
              <TabsTrigger value="categorization" className="gap-1.5 rounded-lg"><Zap className="h-4 w-4" aria-hidden="true" />{t("reports.auto_tag")}</TabsTrigger>
              <TabsTrigger value="insights" className="gap-1.5 rounded-lg"><Brain className="h-4 w-4" aria-hidden="true" />{t("reports.insights")}</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="mt-0 flex flex-col gap-5">
              {multiMonth && (
                <Panel labelledBy="statement-title" className="flex flex-col gap-3" testId="reports-statement">
                  <PanelTitle id="statement-title">{t("page.reports.statement_title")}</PanelTitle>
                  <div className="-mx-2 overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-600 dark:border-gray-800 dark:text-gray-400">
                          <th scope="col" className="px-2 py-2 font-semibold">{t("page.reports.col_month")}</th>
                          <th scope="col" className="px-2 py-2 text-right font-semibold">{t("page.reports.income")}</th>
                          <th scope="col" className="px-2 py-2 text-right font-semibold">{t("page.reports.expenses")}</th>
                          <th scope="col" className="px-2 py-2 text-right font-semibold">{t("page.reports.col_kept")}</th>
                          <th scope="col" className="px-2 py-2 text-right font-semibold">{t("page.reports.col_rate")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.months.map((month) => (
                          <tr key={month.key} className={cn("border-b border-gray-100 last:border-b-0 dark:border-gray-800", best?.key === month.key && "bg-emerald-50/60 dark:bg-emerald-950/20")}>
                            <th scope="row" className="px-2 py-2.5 text-left font-medium text-gray-900 dark:text-white">
                              {f.monthLabel(month.key)}
                              {best?.key === month.key && month.netCents > 0 && (
                                <Trophy className="ml-1.5 inline h-3.5 w-3.5 text-amber-500" aria-label={t("page.reports.best_month")} />
                              )}
                            </th>
                            <td className="px-2 py-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{f.money(month.incomeCents)}</td>
                            <td className="px-2 py-2.5 text-right tabular-nums text-gray-900 dark:text-white">{f.money(month.expenseCents)}</td>
                            <td className={cn("px-2 py-2.5 text-right font-semibold tabular-nums", month.netCents < 0 ? "text-red-700 dark:text-red-400" : "text-gray-900 dark:text-white")}>
                              {month.netCents < 0 ? "−" : ""}{f.money(Math.abs(month.netCents))}
                            </td>
                            <td className="px-2 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                              {month.savingsRateBp === null ? "—" : `${Math.round(month.savingsRateBp / 100)}%`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 font-semibold dark:border-gray-700">
                          <th scope="row" className="px-2 py-2.5 text-left text-gray-900 dark:text-white">{t("page.reports.total")}</th>
                          <td className="px-2 py-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{f.money(report.incomeCents)}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-gray-900 dark:text-white">{f.money(report.expenseCents)}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-gray-900 dark:text-white">{report.netCents < 0 ? "−" : ""}{f.money(Math.abs(report.netCents))}</td>
                          <td className="px-2 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                            {report.savingsRateBp === null ? "—" : `${Math.round(report.savingsRateBp / 100)}%`}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Panel>
              )}

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <Panel labelledBy="rep-exp-title" className="flex flex-col gap-4 lg:col-span-7" testId="reports-categories">
                  <PanelTitle id="rep-exp-title">{t("page.reports.spending_title")}</PanelTitle>
                  {report.expenseCategories.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-600 dark:text-gray-400">{t("page.reports.nothing")}</p>
                  ) : (
                    <ul className="flex flex-col gap-3.5">
                      {report.expenseCategories.map((category) => (
                        <li key={category.key} className="flex items-center gap-3">
                          <CategoryTile color={category.color} icon={category.icon} name={category.name} size="sm" />
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate font-semibold text-gray-900 dark:text-white">
                                  {category.key === "uncategorized" ? t("page.common.uncategorized") : category.name}
                                </span>
                                <ChangeChip pct={category.changePct} label={CHANGE_LABEL} />
                              </span>
                              <span className="whitespace-nowrap font-semibold tabular-nums text-gray-900 dark:text-white">{f.money(category.cents)}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                              <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(2, category.shareBp / 100)}%` }} />
                            </div>
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {t("page.reports.category_meta", { share: Math.round(category.shareBp / 100), count: category.count })}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <div className="flex flex-col gap-5 lg:col-span-5">
                  <Panel labelledBy="rep-inc-title" className="flex flex-col gap-3">
                    <PanelTitle id="rep-inc-title">{t("page.reports.income_title")}</PanelTitle>
                    {report.incomeCategories.length === 0 ? (
                      <p className="py-4 text-center text-sm text-gray-600 dark:text-gray-400">{t("page.reports.nothing")}</p>
                    ) : (
                      <ul className="flex flex-col">
                        {report.incomeCategories.map((source) => (
                          <li key={source.key} className="flex items-center justify-between gap-3 border-b border-gray-100 py-2 text-sm last:border-b-0 dark:border-gray-800">
                            <span className="truncate font-medium text-gray-900 dark:text-white">
                              {source.key === "uncategorized" ? t("page.common.uncategorized") : source.name}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 dark:text-gray-400">{Math.round(source.shareBp / 100)}%</span>
                              <span className="whitespace-nowrap font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{f.money(source.cents)}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>

                  <Panel labelledBy="rep-largest-title" className="flex flex-col gap-3">
                    <PanelTitle id="rep-largest-title">{t("page.reports.largest_title")}</PanelTitle>
                    {report.largestExpenses.length === 0 ? (
                      <p className="py-4 text-center text-sm text-gray-600 dark:text-gray-400">{t("page.reports.nothing")}</p>
                    ) : (
                      <ul className="flex flex-col">
                        {report.largestExpenses.map((row) => (
                          <li key={row.id} className="flex items-center gap-3 border-b border-gray-100 py-2 last:border-b-0 dark:border-gray-800">
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-sm font-medium text-gray-900 dark:text-white">{row.description}</span>
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {f.dateLabel(dayKeyIn(row.date, timeZone))} · {row.categoryName || t("page.common.uncategorized")}
                              </span>
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
              </div>
            </TabsContent>

            <TabsContent value="chart" className="mt-0">
              <RequirePlan plan="standard">
                <Panel labelledBy="rep-chart-title" className="flex flex-col gap-4">
                  <PanelTitle id="rep-chart-title">{t("page.reports.chart_title")}</PanelTitle>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} width={80} tickFormatter={(value) => f.money(Number(value) * 100)} />
                        <Tooltip formatter={(value, name) => [f.money(Number(value) * 100), String(name)]} />
                        <Legend />
                        <Bar dataKey="income" name={t("page.reports.income")} fill="#059669" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expenses" name={t("page.reports.expenses")} fill="#2563eb" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="kept" name={t("page.reports.col_kept")} stroke="#0f172a" strokeWidth={2} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{t("page.reports.chart_note")}</p>
                </Panel>
              </RequirePlan>
            </TabsContent>

            <TabsContent value="categorization" className="mt-0">
              <RequirePlan plan="standard">
                <AutoCategorization transactions={periodRows} />
              </RequirePlan>
            </TabsContent>

            <TabsContent value="insights" className="mt-0">
              <RequirePlan plan="premium">
                <AIInsights data={{ transactions: periodRows, budgets: [], goals: [] }} />
              </RequirePlan>
            </TabsContent>
          </Tabs>
        </>
      )}
    </PageShell>
  );
}
