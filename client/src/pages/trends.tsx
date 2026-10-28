import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Activity, CalendarRange, Crown, Download, LineChart as LineChartIcon, Loader2, RefreshCw, Shapes, Sparkles, Trophy, TrendingDown, TrendingUp } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RequirePlan from "@/components/require-plan";
import ExpensePrediction from "@/components/expense-prediction";
import { useTransactions } from "@/hooks/useTransactions";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { useUserTimeZone } from "@/hooks/useUserTimeZone";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/CurrencyContext";
import { apiRequest } from "@/lib/queryClient";
import { apiErrorCode } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import {
  ChangeChip,
  LoadError,
  PageHeader,
  PageShell,
  Panel,
  PanelSkeleton,
  PanelTitle,
  Segmented,
  StatTile,
  primaryButton,
  secondaryButton,
  useOverviewFormat,
} from "@/components/page/kit";
import { buildTrendStats } from "@shared/trendStats";
import { buildMonthLedger, monthKeyIn, type LedgerTransaction } from "@shared/ledger";
import { translateCategoryName } from "../../../server/categoryTranslations";

type Span = "6" | "12" | "24";

interface Forecast {
  financialForecast?: {
    nextMonthExpenses?: number;
    expectedSavings?: number;
    budgetVariance?: number;
    confidence?: number;
    keyInsights?: string[];
    recommendations?: string[];
    riskFactors?: string[];
  };
  categoryPredictions?: { category: string; predictedAmount?: number; confidence?: number; trend?: string; reasoning?: string }[];
}

/**
 * How the person's money moves over months.
 *
 * The three headline cards were fixed text — "Positive", "Low", "stable patterns" — for every
 * account; "spent per category" added salaries to spending; and the AI forecast was requested on
 * every visit, spending an AI action even when the person only looked at the first tab. Now every
 * card is computed (`shared/trendStats`), categories are spending only, and the forecast is asked
 * for when its tab is opened.
 */
export default function Trends() {
  const { t, i18n } = useTranslation();
  const f = useOverviewFormat();
  const { toast } = useToast();
  const { currency } = useCurrency();
  const { isReady, user } = useClerkUserReady();
  const timeZone = useUserTimeZone();
  const { data, isLoading, error, refetch } = useTransactions();
  const rows = (Array.isArray(data) ? data : []) as LedgerTransaction[];
  const [span, setSpan] = useState<Span>("6");
  const [tab, setTab] = useState("overview");
  const [pdfLoading, setPdfLoading] = useState(false);

  const stats = useMemo(() => buildTrendStats(rows, Number(span), { timeZone }), [rows, span, timeZone]);
  const thisMonth = monthKeyIn(new Date(), timeZone);
  const currentLedger = useMemo(() => buildMonthLedger(rows, thisMonth, { timeZone }), [rows, thisMonth, timeZone]);

  const forecast = useQuery<Forecast>({
    queryKey: ["trend-predictions", user?.id, i18n.language],
    enabled: isReady && !!user?.id && tab === "forecasts",
    staleTime: 30 * 60_000,
    retry: false,
    queryFn: async () => (await apiRequest("GET", "/api/trend-predictions")).json(),
  });

  const chartData = stats.months.map((month) => ({
    label: `${f.monthShort(month.key)}${month.partial ? "*" : ""}`,
    income: month.incomeCents / 100,
    expenses: month.expenseCents / 100,
    kept: month.netCents / 100,
  }));

  const weekdayNames = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(f.locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + i))),
  );
  const weekdayMax = Math.max(1, ...stats.weekdays);
  const busiestDay = stats.weekdays.indexOf(Math.max(...stats.weekdays));
  const quietestDay = stats.weekdays.indexOf(Math.min(...stats.weekdays));
  const weekendAvg = Math.round((stats.weekdays[5] + stats.weekdays[6]) / 2);
  const weekdayAvg = Math.round(stats.weekdays.slice(0, 5).reduce((s, v) => s + v, 0) / 5);
  const thirdsMax = Math.max(1, ...stats.monthThirds);
  const hasPatterns = stats.weekdays.some((value) => value > 0);

  const exportPdf = async () => {
    setPdfLoading(true);
    try {
      const response = await apiRequest("POST", "/api/generate-trends-pdf", { period: thisMonth, currency });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kaptia-trends-${thisMonth}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: t("page.trends.pdf_failed"), variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  };

  const forecastError = forecast.error ? apiErrorCode(forecast.error) : null;
  const ff = forecast.data?.financialForecast;

  return (
    <RequirePlan plan="premium">
      <PageShell testId="trends-page">
        <PageHeader
          title={
            <span className="flex items-center gap-2">
              {t("page.trends.title")}
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                <Crown className="h-3 w-3" aria-hidden="true" />
                {t("plans.premium")}
              </span>
            </span>
          }
          subtitle={t("page.trends.subtitle")}
          actions={
            <button type="button" className={secondaryButton} onClick={exportPdf} disabled={pdfLoading}>
              {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
              {t("page.trends.pdf")}
            </button>
          }
        >
          <Segmented
            label={t("page.trends.span_label")}
            value={span}
            onChange={setSpan}
            options={[
              { value: "6", label: t("page.trends.span_6") },
              { value: "12", label: t("page.trends.span_12") },
              { value: "24", label: t("page.trends.span_24") },
            ]}
          />
        </PageHeader>

        {error && <LoadError onRetry={() => refetch()} />}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <PanelSkeleton className="h-28" />
            <PanelSkeleton className="h-28" />
            <PanelSkeleton className="h-28" />
            <PanelSkeleton className="h-96 md:col-span-3" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="trends-headline">
              <StatTile
                icon={stats.direction === "worsening" ? <TrendingDown className="h-4 w-4" aria-hidden="true" /> : <TrendingUp className="h-4 w-4" aria-hidden="true" />}
                label={t("page.trends.direction")}
                value={stats.direction ? t(`page.trends.direction_${stats.direction}`) : "—"}
                tone={stats.direction === "improving" ? "good" : stats.direction === "worsening" ? "bad" : "default"}
                note={
                  stats.direction && stats.directionDeltaCents !== null && stats.direction !== "steady"
                    ? t(stats.direction === "improving" ? "page.trends.direction_note_up" : "page.trends.direction_note_down", { amount: f.money(Math.abs(stats.directionDeltaCents)) })
                    : stats.direction === "steady" ? t("page.trends.direction_note_steady") : t("page.trends.need_months", { count: 2 })
                }
              />
              <StatTile
                icon={<Trophy className="h-4 w-4" aria-hidden="true" />}
                label={t("page.trends.best_month")}
                value={stats.bestMonth ? f.monthLabel(stats.bestMonth.key) : "—"}
                note={stats.bestMonth
                  ? t("page.trends.best_month_note", { amount: `${stats.bestMonth.netCents < 0 ? "−" : ""}${f.money(Math.abs(stats.bestMonth.netCents))}` })
                  : t("page.trends.need_months", { count: 1 })}
              />
              <StatTile
                icon={<Activity className="h-4 w-4" aria-hidden="true" />}
                label={t("page.trends.volatility")}
                value={stats.volatility ? t(`page.trends.volatility_${stats.volatility}`) : "—"}
                tone={stats.volatility === "high" ? "warn" : "default"}
                note={stats.volatilityPct !== null ? t("page.trends.volatility_note", { pct: stats.volatilityPct }) : t("page.trends.need_months", { count: 3 })}
              />
            </div>

            <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-5">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1 md:w-auto md:grid-cols-4 md:self-start">
                <TabsTrigger value="overview" className="gap-1.5 rounded-lg"><LineChartIcon className="h-4 w-4" aria-hidden="true" />{t("trends.tabs.overview")}</TabsTrigger>
                <TabsTrigger value="categories" className="gap-1.5 rounded-lg"><Shapes className="h-4 w-4" aria-hidden="true" />{t("trends.tabs.by_category")}</TabsTrigger>
                <TabsTrigger value="patterns" className="gap-1.5 rounded-lg"><CalendarRange className="h-4 w-4" aria-hidden="true" />{t("trends.tabs.patterns")}</TabsTrigger>
                <TabsTrigger value="forecasts" className="gap-1.5 rounded-lg"><Sparkles className="h-4 w-4" aria-hidden="true" />{t("trends.tabs.forecasts")}</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-0">
                <Panel labelledBy="trend-chart-title" className="flex flex-col gap-4">
                  <PanelTitle
                    id="trend-chart-title"
                    aside={stats.averageExpenseCents !== null
                      ? <span className="text-xs text-gray-600 sm:text-sm dark:text-gray-400">{t("page.trends.average_month", { income: f.money(stats.averageIncomeCents ?? 0), spent: f.money(stats.averageExpenseCents) })}</span>
                      : undefined}
                  >
                    {t("page.trends.chart_title")}
                  </PanelTitle>
                  <div className="h-80 sm:h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} width={80} tickFormatter={(value) => f.money(Number(value) * 100)} />
                        <Tooltip formatter={(value, name) => [f.money(Number(value) * 100), String(name)]} />
                        <Legend />
                        <Line type="monotone" dataKey="income" name={t("page.reports.income")} stroke="#059669" strokeWidth={3} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="expenses" name={t("page.reports.expenses")} stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="kept" name={t("page.reports.col_kept")} stroke="#0f172a" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{t("page.trends.partial_note")}</p>
                </Panel>
              </TabsContent>

              <TabsContent value="categories" className="mt-0">
                {stats.categories.length === 0 ? (
                  <Panel label={t("trends.tabs.by_category")}><p className="py-8 text-center text-sm text-gray-600 dark:text-gray-400">{t("page.trends.no_spending")}</p></Panel>
                ) : (
                  <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {stats.categories.slice(0, 12).map((category) => {
                      const max = Math.max(1, ...category.series);
                      return (
                        <li key={category.key} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                          <div className="flex items-start justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: category.color ?? "#94a3b8" }} aria-hidden="true" />
                              <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                {category.key === "uncategorized" ? t("page.common.uncategorized") : category.name}
                              </span>
                            </span>
                            <ChangeChip pct={category.changePct} quiet={5} label={{ up: "page.trends.change_up", down: "page.trends.change_down", same: "page.trends.change_same" }} />
                          </div>
                          <div className="flex h-14 items-end gap-0.5" role="img" aria-label={t("page.trends.series_label", { name: category.name })}>
                            {category.series.map((value, i) => (
                              <span
                                key={i}
                                aria-hidden="true"
                                className={cn("flex-1 rounded-t-sm", stats.months[i]?.partial ? "bg-blue-200 dark:bg-blue-900" : "bg-blue-600")}
                                style={{ height: Math.max(2, (value / max) * 56) }}
                              />
                            ))}
                          </div>
                          <dl className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <dt className="text-gray-600 dark:text-gray-400">{t("page.trends.recent_avg")}</dt>
                              <dd className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{f.money(category.recentAverageCents)}</dd>
                            </div>
                            <div>
                              <dt className="text-gray-600 dark:text-gray-400">{t("page.trends.prior_avg")}</dt>
                              <dd className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{category.priorAverageCents !== null ? f.money(category.priorAverageCents) : "—"}</dd>
                            </div>
                          </dl>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="patterns" className="mt-0 flex flex-col gap-5">
                {!hasPatterns ? (
                  <Panel label={t("trends.tabs.patterns")}><p className="py-8 text-center text-sm text-gray-600 dark:text-gray-400">{t("page.trends.no_spending")}</p></Panel>
                ) : (
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <Panel labelledBy="weekday-title" className="flex flex-col gap-4">
                      <PanelTitle id="weekday-title">{t("page.trends.weekday_title")}</PanelTitle>
                      <ul className="grid grid-cols-7 items-end gap-2" style={{ height: 160 }}>
                        {stats.weekdays.map((value, i) => (
                          <li key={i} className="flex h-full flex-col items-center justify-end gap-1.5" aria-label={t("page.common.month_amount", { month: weekdayNames[i], amount: f.money(value) })}>
                            <span className="text-[10px] font-semibold tabular-nums text-gray-600 sm:text-xs dark:text-gray-400" aria-hidden="true">{f.money(value)}</span>
                            <span
                              aria-hidden="true"
                              className={cn("w-full max-w-[2.5rem] rounded-t-md", i === busiestDay ? "bg-blue-600" : "bg-blue-200 dark:bg-blue-900")}
                              style={{ height: Math.max(3, (value / weekdayMax) * 110) }}
                            />
                            <span className="text-xs font-medium text-gray-900 dark:text-white" aria-hidden="true">{weekdayNames[i]}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm text-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
                        {t("page.trends.weekday_insight", { busiest: weekdayNames[busiestDay], quietest: weekdayNames[quietestDay] })}{" "}
                        {weekendAvg > weekdayAvg * 1.15
                          ? t("page.trends.weekend_more", { weekend: f.money(weekendAvg), weekday: f.money(weekdayAvg) })
                          : weekdayAvg > weekendAvg * 1.15
                            ? t("page.trends.weekday_more", { weekend: f.money(weekendAvg), weekday: f.money(weekdayAvg) })
                            : t("page.trends.week_even")}
                      </p>
                    </Panel>

                    <Panel labelledBy="thirds-title" className="flex flex-col gap-4">
                      <PanelTitle id="thirds-title">{t("page.trends.thirds_title")}</PanelTitle>
                      <ul className="flex flex-col gap-3">
                        {stats.monthThirds.map((value, i) => (
                          <li key={i} className="flex flex-col gap-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-700 dark:text-gray-300">{t(`page.trends.third_${i}`)}</span>
                              <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{t("page.trends.per_day_amount", { amount: f.money(value) })}</span>
                            </div>
                            <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800">
                              <div className="h-full rounded-full bg-blue-600" style={{ width: `${(value / thirdsMax) * 100}%` }} />
                            </div>
                          </li>
                        ))}
                      </ul>
                      <p className="rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm text-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
                        {stats.monthThirds[0] > stats.monthThirds[2] * 1.2
                          ? t("page.trends.thirds_start")
                          : stats.monthThirds[2] > stats.monthThirds[0] * 1.2
                            ? t("page.trends.thirds_end")
                            : t("page.trends.thirds_even")}
                      </p>
                    </Panel>

                    <Panel labelledBy="frequent-title" className="flex flex-col gap-3 lg:col-span-2">
                      <PanelTitle id="frequent-title">{t("page.trends.frequent_title")}</PanelTitle>
                      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {stats.frequent.map((entry) => (
                          <li key={entry.name} className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60">
                            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: entry.color ?? "#94a3b8" }} aria-hidden="true" />
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{entry.name === "Uncategorized" ? t("page.common.uncategorized") : entry.name}</span>
                              <span className="text-xs text-gray-600 dark:text-gray-400">{t("page.trends.frequent_meta", { count: entry.count, amount: f.money(entry.averageCents) })}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{t("page.trends.patterns_note")}</p>
                    </Panel>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="forecasts" className="mt-0 flex flex-col gap-5">
                <ExpensePrediction transactions={rows as any[]} summary={{ totalExpenses: currentLedger.expenseCents / 100 }} />

                <Panel labelledBy="ai-forecast-title" className="flex flex-col gap-4">
                  <PanelTitle id="ai-forecast-title">
                    <Sparkles className="h-4 w-4 text-violet-600" aria-hidden="true" />
                    {t("trends.forecasts.ai_forecasts_title")}
                  </PanelTitle>
                  {forecast.isLoading ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <PanelSkeleton className="h-24" />
                      <PanelSkeleton className="h-24" />
                      <PanelSkeleton className="h-24" />
                    </div>
                  ) : forecast.error ? (
                    // A refusal is not an empty result: say why there is no forecast and offer to retry.
                    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                      <p>
                        {forecastError === "ai_quota_exceeded"
                          ? t("page.trends.ai_quota")
                          : forecastError === "ai_disabled"
                            ? t("page.trends.ai_disabled")
                            : t("page.trends.ai_unavailable")}
                      </p>
                      {forecastError !== "ai_quota_exceeded" && forecastError !== "ai_disabled" && (
                        <button type="button" className={primaryButton} onClick={() => forecast.refetch()}>
                          <RefreshCw className="h-4 w-4" aria-hidden="true" />
                          {t("page.common.retry")}
                        </button>
                      )}
                    </div>
                  ) : ff ? (
                    <>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <StatTile
                          label={t("trends.forecasts.next_month_expenses")}
                          value={f.money(Math.round((ff.nextMonthExpenses ?? 0) * 100))}
                          note={t("page.trends.confidence", { pct: Math.round((ff.confidence ?? 0) * 100) })}
                        />
                        <StatTile label={t("trends.forecasts.expected_savings")} value={f.money(Math.round((ff.expectedSavings ?? 0) * 100))} tone="good" />
                        <StatTile
                          label={t("trends.forecasts.budget_variance")}
                          value={`${(ff.budgetVariance ?? 0) > 0 ? "+" : ""}${(ff.budgetVariance ?? 0).toFixed(1)}%`}
                          tone={(ff.budgetVariance ?? 0) > 0 ? "warn" : "good"}
                          note={(ff.budgetVariance ?? 0) > 0 ? t("trends.forecasts.over_budget") : t("trends.forecasts.under_budget")}
                        />
                      </div>
                      {[
                        { items: ff.keyInsights, title: t("trends.forecasts.key_insights"), tone: "border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800/60" },
                        { items: ff.recommendations, title: t("trends.forecasts.ai_recommendations"), tone: "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" },
                        { items: ff.riskFactors, title: t("trends.forecasts.risk_factors"), tone: "border-red-600 bg-red-50 dark:bg-red-950/30" },
                      ]
                        .filter((block) => block.items && block.items.length > 0)
                        .map((block) => (
                          <div key={block.title} className="flex flex-col gap-2">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{block.title}</h3>
                            <ul className="flex flex-col gap-2">
                              {block.items!.map((item, index) => (
                                <li key={index} className={cn("rounded-lg border-l-4 px-3 py-2 text-sm", block.tone)}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      {forecast.data?.categoryPredictions && forecast.data.categoryPredictions.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t("trends.forecasts.category_predictions_title")}</h3>
                          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {forecast.data.categoryPredictions.slice(0, 6).map((prediction, index) => (
                              <li key={index} className="flex flex-col gap-1 rounded-xl border border-gray-200 p-3 text-sm dark:border-gray-800">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-gray-900 dark:text-white">{translateCategoryName(prediction.category, i18n.language)}</span>
                                  <span className="font-semibold tabular-nums">{f.money(Math.round((prediction.predictedAmount ?? 0) * 100))}</span>
                                </div>
                                {prediction.reasoning && <p className="text-xs text-gray-600 dark:text-gray-400">{prediction.reasoning}</p>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="py-6 text-center text-sm text-gray-600 dark:text-gray-400">{t("trends.forecasts.no_predictions_description")}</p>
                  )}
                </Panel>
              </TabsContent>
            </Tabs>
          </>
        )}
      </PageShell>
    </RequirePlan>
  );
}
