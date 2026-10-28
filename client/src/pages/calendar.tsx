import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bell, CalendarClock, Plus } from "lucide-react";
import RequirePlan from "@/components/require-plan";
import TransactionRemindersWidget from "@/components/transaction-reminders-widget";
import { TransactionFormDialog, type EditableTransaction } from "@/components/TransactionFormDialog";
import { useTransactions } from "@/hooks/useTransactions";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { useCurrency } from "@/context/CurrencyContext";
import { apiRequest } from "@/lib/queryClient";
import { requestQuickAdd } from "@/lib/quickAdd";
import { cn } from "@/lib/utils";
import type { TxRow } from "@/components/ledger/LedgerPanel";
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
  primaryButton,
  useMonthNavigation,
  useOverviewFormat,
} from "@/components/page/kit";
import { buildMonthLedger, dayKeyIn, daysInMonthOf } from "@shared/ledger";
import { parseAmountToCents } from "@shared/money";

interface Reminder {
  id: number;
  title: string;
  amount?: string | null;
  dueDate: string;
  isActive: boolean;
  isCompleted: boolean;
}

/**
 * The month as a calendar: which days money moved, how much, and what is still coming.
 *
 * The old grid always put the 1st under Sunday whatever weekday it was, printed "$" whatever the
 * currency and wrote Slovak month names by hand. Days now sit under their real weekday (Monday
 * first in Spanish and Slovak, Sunday first in English), a day's shade says how much was spent,
 * bills and reminders appear on their day, and a day can be added to directly.
 */
export default function CalendarPage() {
  const { t, i18n } = useTranslation();
  const f = useOverviewFormat();
  const { formatMoney } = useCurrency();
  const { isReady, user } = useClerkUserReady();
  const nav = useMonthNavigation(null, { allowFuture: true });
  const { data, isLoading, error, refetch } = useTransactions();
  const rows: TxRow[] = Array.isArray(data) ? data : [];
  const ledger = useMemo(() => buildMonthLedger(rows, nav.monthKey, { timeZone: nav.timeZone }), [rows, nav.monthKey, nav.timeZone]);
  const { clock } = ledger;
  const isCurrent = clock.status === "current";
  const todayKey = dayKeyIn(new Date(), nav.timeZone);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditableTransaction | null>(null);

  const remindersQuery = useQuery<Reminder[]>({
    queryKey: ["expense-reminders", user?.id, "all"],
    enabled: isReady && !!user?.id,
    retry: false,
    queryFn: async () => {
      try {
        return (await apiRequest("GET", "/api/expense-reminders")).json();
      } catch {
        return [];
      }
    },
  });
  const remindersByDay = useMemo(() => {
    const map = new Map<string, Reminder[]>();
    for (const reminder of remindersQuery.data ?? []) {
      if (!reminder.isActive || reminder.isCompleted) continue;
      const key = dayKeyIn(reminder.dueDate, nav.timeZone);
      map.set(key, [...(map.get(key) ?? []), reminder]);
    }
    return map;
  }, [remindersQuery.data, nav.timeZone]);

  const days = new Map(ledger.days.map((day) => [day.key, day]));
  const total = daysInMonthOf(nav.monthKey);
  const mondayFirst = !i18n.language.startsWith("en");
  const firstWeekday = new Date(`${nav.monthKey}-01T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const leading = mondayFirst ? (firstWeekday + 6) % 7 : firstWeekday;
  const weekdayNames = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(f.locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, (mondayFirst ? 1 : 7) + i))),
  );
  const maxSpend = Math.max(1, ...ledger.days.filter((d) => !d.scheduled).map((d) => d.expenseCents));
  const compact = new Intl.NumberFormat(f.locale, { notation: "compact", maximumFractionDigits: 1 });

  const spentDays = ledger.days.filter((d) => !d.scheduled && d.expenseCents > 0);
  const noSpendDays = Math.max(0, clock.daysElapsed - spentDays.length);
  const busiest = spentDays.reduce<(typeof spentDays)[number] | null>((a, b) => (!a || b.expenseCents > a.expenseCents ? b : a), null);

  const selectedKey = selected && selected.startsWith(nav.monthKey) ? selected : isCurrent ? todayKey : `${nav.monthKey}-01`;
  const selectedDay = days.get(selectedKey);
  const selectedReminders = remindersByDay.get(selectedKey) ?? [];

  const shade = (cents: number) => {
    if (cents <= 0) return "";
    const level = cents / maxSpend;
    if (level > 0.75) return "bg-blue-200 dark:bg-blue-900/70";
    if (level > 0.4) return "bg-blue-100 dark:bg-blue-900/45";
    return "bg-blue-50 dark:bg-blue-950/50";
  };

  return (
    <RequirePlan plan="standard">
      <PageShell testId="calendar-page">
        <PageHeader
          title={t("page.calendar.title")}
          subtitle={t("page.calendar.subtitle")}
          actions={
            <button type="button" className={primaryButton} onClick={() => requestQuickAdd("type", { date: selectedKey })} data-testid="calendar-add">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("page.calendar.add_on_day", { day: f.dayLabel(selectedKey) })}
            </button>
          }
        >
          <MonthStepper
            label={f.monthLabel(nav.monthKey)}
            onPrevious={nav.previous}
            onNext={nav.next}
            canGoNext={nav.canGoNext}
            isCurrent={nav.isCurrent}
            onCurrent={nav.reset}
          />
        </PageHeader>

        {error && <LoadError onRetry={() => refetch()} />}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <PanelSkeleton className="h-24 lg:col-span-12" />
            <PanelSkeleton className="h-[520px] lg:col-span-8" />
            <PanelSkeleton className="h-80 lg:col-span-4" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label={t("page.transactions.money_in")} value={`+${f.money(ledger.incomeCents)}`} tone="good" />
              <StatTile label={t("page.transactions.money_out")} value={`−${f.money(ledger.expenseCents)}`} />
              <StatTile
                label={t("page.transactions.no_spend_days")}
                value={clock.daysElapsed > 0 ? t("page.transactions.days_of", { count: noSpendDays, total: clock.daysElapsed }) : "—"}
                tone={noSpendDays > 0 ? "good" : "default"}
              />
              <StatTile
                label={t("page.calendar.busiest")}
                value={busiest ? f.money(busiest.expenseCents) : "—"}
                note={busiest ? f.dayLabel(busiest.key) : undefined}
              />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <Panel labelledBy="calendar-grid-title" className="flex flex-col gap-3 p-3 sm:p-6 lg:col-span-8" testId="calendar-grid">
                <h2 id="calendar-grid-title" className="sr-only">{f.monthLabel(nav.monthKey)}</h2>
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400" aria-hidden="true">
                  {weekdayNames.map((name) => <span key={name}>{name}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: leading }, (_, i) => <span key={`blank-${i}`} aria-hidden="true" />)}
                  {Array.from({ length: total }, (_, i) => {
                    const key = `${nav.monthKey}-${String(i + 1).padStart(2, "0")}`;
                    const day = days.get(key);
                    const reminders = remindersByDay.get(key) ?? [];
                    const future = key > todayKey;
                    const spent = day?.expenseCents ?? 0;
                    const label = [
                      f.dayLabel(key),
                      spent > 0 ? t("page.calendar.cell_spent", { amount: f.money(spent) }) : "",
                      (day?.incomeCents ?? 0) > 0 ? t("page.calendar.cell_received", { amount: f.money(day!.incomeCents) }) : "",
                      reminders.length > 0 ? t("page.calendar.cell_reminders", { count: reminders.length }) : "",
                    ].filter(Boolean).join(", ");
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelected(key)}
                        aria-pressed={key === selectedKey}
                        className={cn(
                          "flex aspect-square min-h-[44px] flex-col items-stretch rounded-lg border p-1 text-left transition-colors sm:aspect-auto sm:min-h-[84px] sm:p-2",
                          day?.scheduled ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40" : cn("border-gray-100 dark:border-gray-800", shade(future ? 0 : spent)),
                          key === selectedKey && "ring-2 ring-blue-700 dark:ring-blue-400",
                          "hover:border-blue-400",
                        )}
                      >
                        <span className="flex items-center justify-between">
                          <span
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold sm:text-sm",
                              key === todayKey ? "bg-blue-700 text-white" : future ? "text-gray-500 dark:text-gray-400" : "text-gray-900 dark:text-white",
                            )}
                          >
                            {i + 1}
                          </span>
                          {reminders.length > 0 && <Bell className="h-3 w-3 text-amber-600" aria-hidden="true" />}
                        </span>
                        <span className="mt-auto hidden flex-col text-[11px] font-semibold tabular-nums sm:flex">
                          {spent > 0 && <span className="text-gray-800 dark:text-gray-200">−{compact.format(spent / 100)}</span>}
                          {(day?.incomeCents ?? 0) > 0 && <span className="text-emerald-800 dark:text-emerald-400">+{compact.format(day!.incomeCents / 100)}</span>}
                        </span>
                        <span className="mt-auto flex justify-center gap-0.5 sm:hidden" aria-hidden="true">
                          {spent > 0 && <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />}
                          {(day?.incomeCents ?? 0) > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />}
                        </span>
                        {/* The sentence a screen reader needs, as content: a button's accessible
                            name must contain its visible text (WCAG 2.5.3), so it cannot be an
                            `aria-label` that replaces the day and its amounts. */}
                        <span className="sr-only">{label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-blue-200 dark:bg-blue-900" />{t("page.calendar.legend_shade")}</span>
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-amber-300 bg-amber-50" />{t("page.calendar.legend_scheduled")}</span>
                  <span className="flex items-center gap-1.5"><Bell className="h-3 w-3 text-amber-600" aria-hidden="true" />{t("page.calendar.legend_reminder")}</span>
                </div>
              </Panel>

              <Panel labelledBy="day-title" className="flex flex-col gap-4 lg:col-span-4" testId="calendar-day">
                <PanelTitle id="day-title">{f.dayLabel(selectedKey)}</PanelTitle>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60">
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t("page.transactions.money_out")}</p>
                    <p className="font-semibold tabular-nums text-gray-900 dark:text-white">{f.money(selectedDay?.expenseCents ?? 0)}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60">
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t("page.transactions.money_in")}</p>
                    <p className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{f.money(selectedDay?.incomeCents ?? 0)}</p>
                  </div>
                </div>

                {selectedReminders.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {selectedReminders.map((reminder) => (
                      <li key={reminder.id} className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                        <Bell className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{reminder.title}</span>
                        {reminder.amount && <span className="font-semibold tabular-nums">{formatMoney(Number(reminder.amount))}</span>}
                      </li>
                    ))}
                  </ul>
                )}

                {!selectedDay || selectedDay.rows.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-600 dark:text-gray-400">
                    {selectedKey > todayKey ? t("page.calendar.day_empty_future") : t("page.calendar.day_empty")}
                  </p>
                ) : (
                  <ul className="flex flex-col">
                    {selectedDay.rows.map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => setEditing(row as EditableTransaction)}
                          className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60"
                        >
                          <CategoryTile color={row.categoryColor} icon={row.categoryIcon} name={row.description} size="sm" />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{row.description}</span>
                            <span className="flex items-center gap-1 truncate text-xs text-gray-600 dark:text-gray-400">
                              {selectedDay.scheduled && <CalendarClock className="h-3 w-3" aria-hidden="true" />}
                              {row.categoryName || t("page.common.uncategorized")}
                            </span>
                          </span>
                          <span className={cn("whitespace-nowrap text-sm font-semibold tabular-nums", row.type === "income" ? "text-emerald-700 dark:text-emerald-400" : "text-gray-900 dark:text-white")}>
                            {row.type === "income" ? "+" : "−"}{f.money(Math.abs(parseAmountToCents(row.amount)))}
                          </span>
                          <span className="sr-only">{t("page.common.edit")}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" className={cn(primaryButton, "justify-center")} onClick={() => requestQuickAdd("type", { date: selectedKey })}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t("page.calendar.add_here")}
                </button>
              </Panel>
            </div>
          </>
        )}

        {/* Bills and reminders: created and ticked off here. The dashboard lists the ones due
            this week under "Needs your attention" and links back to this page. */}
        <TransactionRemindersWidget />

        <TransactionFormDialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} transaction={editing} />
      </PageShell>
    </RequirePlan>
  );
}
