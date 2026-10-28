import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarClock, ExternalLink, MoreHorizontal, Pencil, Receipt, Repeat, Search, Tag, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TransactionFormDialog, type EditableTransaction } from "@/components/TransactionFormDialog";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/CurrencyContext";
import { useCategories, invalidateMoney } from "@/hooks/useCategories";
import { apiRequest } from "@/lib/queryClient";
import { apiErrorMessage } from "@/lib/apiError";
import { requestQuickAdd } from "@/lib/quickAdd";
import { cn } from "@/lib/utils";
import { parseAmountToCents } from "@shared/money";
import { dayKeyIn, daysUntil, groupByDay, isUncategorized, type LedgerDay, type LedgerTransaction } from "@shared/ledger";
import { CategoryTile, EmptyState, Panel, PanelTitle, Segmented, primaryButton, safeColor, useOverviewFormat } from "@/components/page/kit";

export interface TxRow extends LedgerTransaction {
  amount: string;
  description: string;
  date: string;
  type: "income" | "expense";
  recurringFrequency?: string | null;
  recurringEndDate?: string | null;
  paymentUrl?: string | null;
  referenceNote?: string | null;
  imageUrl?: string | null;
}

type TypeFilter = "all" | "income" | "expense";

/** Results of a search across every month are capped; a longer list is not read, it is scrolled. */
const SEARCH_LIMIT = 200;

/**
 * The month's transactions, grouped by day, with the filters people actually use: words, type,
 * category, "only repeating" and "only without a category". A search can widen to every month.
 *
 * Every row opens its edit form on tap. A row without a category carries the category picker
 * itself, so "8 transactions without a category" on the dashboard is fixed here in eight taps.
 */
export function LedgerPanel({
  monthDays,
  allRows,
  kind,
  timeZone,
  startUncategorized = false,
  title,
}: {
  monthDays: LedgerDay<TxRow>[];
  allRows: TxRow[];
  kind: TypeFilter;
  timeZone: string;
  startUncategorized?: boolean;
  title: string;
}) {
  const { t } = useTranslation();
  const f = useOverviewFormat();
  const { formatMoney } = useCurrency();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();

  const [search, setSearch] = useState("");
  const [everyMonth, setEveryMonth] = useState(false);
  const [type, setType] = useState<TypeFilter>(kind);
  const [category, setCategory] = useState("all");
  const [onlyRecurring, setOnlyRecurring] = useState(false);
  const [onlyUncategorized, setOnlyUncategorized] = useState(startUncategorized);
  const [editing, setEditing] = useState<EditableTransaction | null>(null);
  const [deleting, setDeleting] = useState<TxRow | null>(null);

  const monthRows = useMemo(() => monthDays.flatMap((day) => day.rows), [monthDays]);
  const uncategorizedInMonth = monthRows.filter((row) => isUncategorized(row.categoryName)).length;
  const monthCategories = useMemo(() => {
    const seen = new Map<string, { key: string; name: string; color: string | null }>();
    for (const row of monthRows) {
      if (isUncategorized(row.categoryName)) continue;
      const key = String(row.categoryId ?? row.categoryName);
      if (!seen.has(key)) seen.set(key, { key, name: row.categoryName as string, color: row.categoryColor ?? null });
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [monthRows]);

  const query = search.trim().toLocaleLowerCase();
  const searchingAll = everyMonth && query.length > 0;
  const filters = { type, category, onlyRecurring, onlyUncategorized, query };

  const visibleDays = useMemo(() => {
    const matches = (row: TxRow) => {
      if (filters.type !== "all" && row.type !== filters.type) return false;
      if (filters.category !== "all" && String(row.categoryId ?? row.categoryName) !== filters.category) return false;
      if (filters.onlyRecurring && !(row.isRecurring || row.parentTransactionId)) return false;
      if (filters.onlyUncategorized && !isUncategorized(row.categoryName)) return false;
      if (filters.query) {
        const haystack = `${row.description ?? ""} ${row.categoryName ?? ""} ${row.referenceNote ?? ""}`.toLocaleLowerCase();
        if (!haystack.includes(filters.query)) return false;
      }
      return true;
    };
    if (searchingAll) {
      return groupByDay(allRows.filter(matches).slice(0, SEARCH_LIMIT * 4), { timeZone })
        .reduce<LedgerDay<TxRow>[]>((kept, day) => {
          const count = kept.reduce((sum, d) => sum + d.rows.length, 0);
          if (count < SEARCH_LIMIT) kept.push(day);
          return kept;
        }, []);
    }
    return monthDays
      .map((day) => {
        const rows = day.rows.filter(matches);
        let incomeCents = 0;
        let expenseCents = 0;
        for (const row of rows) {
          const cents = Math.abs(parseAmountToCents(row.amount));
          if (row.type === "income") incomeCents += cents;
          else expenseCents += cents;
        }
        return { ...day, rows, incomeCents, expenseCents };
      })
      .filter((day) => day.rows.length > 0);
  }, [monthDays, allRows, searchingAll, filters.type, filters.category, filters.onlyRecurring, filters.onlyUncategorized, filters.query, timeZone]);

  const shown = visibleDays.reduce((sum, day) => sum + day.rows.length, 0);
  const filtered = Boolean(query) || type !== kind || category !== "all" || onlyRecurring || onlyUncategorized;

  const setCategoryOf = useMutation({
    mutationFn: async ({ id, categoryId }: { id: number; categoryId: number }) => {
      await apiRequest("PUT", `/api/transactions/${id}`, { categoryId });
    },
    onSuccess: () => {
      invalidateMoney(queryClient);
      toast({ title: t("page.ledger.category_set") });
    },
    onError: (error) => toast({ title: t("page.ledger.category_failed"), description: apiErrorMessage(error, t("page.common.try_again")), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/transactions/${id}`);
    },
    onSuccess: () => {
      invalidateMoney(queryClient);
      toast({ title: t("page.ledger.deleted") });
    },
    onError: (error) => toast({ title: t("page.ledger.delete_failed"), description: apiErrorMessage(error, t("page.common.try_again")), variant: "destructive" }),
  });

  const dayTitle = (key: string) => {
    const offset = daysUntil(key, new Date(), timeZone);
    if (offset === 0) return t("page.common.today");
    if (offset === -1) return t("page.common.yesterday");
    if (offset === 1) return t("page.common.tomorrow");
    return f.dayLabel(key);
  };

  const clearFilters = () => {
    setSearch("");
    setEveryMonth(false);
    setType(kind);
    setCategory("all");
    setOnlyRecurring(false);
    setOnlyUncategorized(false);
  };

  const chip = (active: boolean) =>
    cn(
      "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors",
      active
        ? "border-blue-700 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-200"
        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800",
    );

  return (
    <Panel labelledBy="ledger-title" testId="ledger" className="flex flex-col gap-4">
      <PanelTitle
        id="ledger-title"
        aside={<span className="text-xs text-gray-600 sm:text-sm dark:text-gray-400">{t("page.ledger.count", { count: shown })}</span>}
      >
        {title}
      </PanelTitle>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("page.ledger.search_placeholder")}
              aria-label={t("page.ledger.search_placeholder")}
              className="h-10 rounded-xl pl-9"
              data-testid="ledger-search"
            />
          </div>
          {kind === "all" && (
            <Segmented
              label={t("page.ledger.type_filter")}
              value={type}
              onChange={setType}
              options={[
                { value: "all", label: t("page.ledger.all") },
                { value: "expense", label: t("page.ledger.expenses") },
                { value: "income", label: t("page.ledger.income") },
              ]}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {query && (
            <button type="button" className={chip(everyMonth)} aria-pressed={everyMonth} onClick={() => setEveryMonth((value) => !value)}>
              {t("page.ledger.every_month")}
            </button>
          )}
          {!searchingAll && monthCategories.length > 0 && (
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 w-auto min-w-[10rem] rounded-full text-sm" aria-label={t("page.ledger.category_filter")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("page.ledger.all_categories")}</SelectItem>
                {monthCategories.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: safeColor(option.color) }} aria-hidden="true" />
                      {option.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <button type="button" className={chip(onlyRecurring)} aria-pressed={onlyRecurring} onClick={() => setOnlyRecurring((value) => !value)}>
            <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
            {t("page.ledger.only_recurring")}
          </button>
          {(uncategorizedInMonth > 0 || onlyUncategorized) && (
            <button
              type="button"
              className={chip(onlyUncategorized)}
              aria-pressed={onlyUncategorized}
              onClick={() => setOnlyUncategorized((value) => !value)}
              data-testid="ledger-uncategorized-filter"
            >
              <Tag className="h-3.5 w-3.5" aria-hidden="true" />
              {t("page.ledger.only_uncategorized", { count: uncategorizedInMonth })}
            </button>
          )}
          {filtered && (
            <button type="button" onClick={clearFilters} className="inline-flex h-9 items-center gap-1 px-2 text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              {t("page.ledger.clear")}
            </button>
          )}
        </div>
      </div>

      {visibleDays.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" aria-hidden="true" />}
          title={filtered ? t("page.ledger.none_filtered_title") : t("page.ledger.none_title")}
          body={filtered ? t("page.ledger.none_filtered_body") : t("page.ledger.none_body")}
          action={
            filtered ? (
              <button type="button" onClick={clearFilters} className={primaryButton}>{t("page.ledger.clear")}</button>
            ) : (
              <button
                type="button"
                className={primaryButton}
                onClick={() => requestQuickAdd("type", kind === "all" ? undefined : { type: kind })}
              >
                {kind === "income" ? t("page.ledger.add_income") : t("page.ledger.add_expense")}
              </button>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {visibleDays.map((day) => (
            <section key={day.key} aria-label={dayTitle(day.key)} className="flex flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 dark:border-gray-800">
                <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  {dayTitle(day.key)}
                  {day.scheduled && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      <CalendarClock className="h-3 w-3" aria-hidden="true" />
                      {t("page.ledger.scheduled")}
                    </span>
                  )}
                  {searchingAll && <span className="font-normal normal-case tracking-normal">· {f.monthLabel(day.key.slice(0, 7))}</span>}
                </h3>
                <span className="flex gap-3 text-[13px] font-semibold tabular-nums">
                  {day.incomeCents > 0 && <span className="text-emerald-700 dark:text-emerald-400">+{f.money(day.incomeCents)}</span>}
                  {day.expenseCents > 0 && <span className="text-gray-700 dark:text-gray-300">−{f.money(day.expenseCents)}</span>}
                </span>
              </div>
              <ul className="flex flex-col">
                {day.rows.map((row) => {
                  const expense = row.type === "expense";
                  const uncategorized = isUncategorized(row.categoryName);
                  const choices = categories.filter((option) => option.type === row.type);
                  return (
                    <li
                      key={row.id}
                      className="group flex flex-wrap items-center gap-3 border-b border-gray-50 py-2.5 last:border-b-0 dark:border-gray-800/60"
                      data-testid="ledger-row"
                    >
                      <button
                        type="button"
                        onClick={() => setEditing(row as EditableTransaction)}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left"
                      >
                        <CategoryTile color={row.categoryColor} icon={row.categoryIcon} name={row.description} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{row.description}</span>
                          <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-gray-600 dark:text-gray-400">
                            {!uncategorized && <span className="truncate">{row.categoryName}</span>}
                            {(row.isRecurring || row.parentTransactionId) && (
                              <span className="inline-flex shrink-0 items-center gap-1">
                                {!uncategorized && <span aria-hidden="true">·</span>}
                                <Repeat className="h-3 w-3" aria-hidden="true" />
                                {row.recurringFrequency ? t(`recurring.frequency.${row.recurringFrequency}`, row.recurringFrequency) : t("page.ledger.repeats")}
                              </span>
                            )}
                            {row.referenceNote && <span className="truncate italic">· {row.referenceNote}</span>}
                          </span>
                        </span>
                        {/* Says what the tap does, without replacing the visible text as the
                            accessible name (WCAG 2.5.3). */}
                        <span className="sr-only">{t("page.common.edit")}</span>
                      </button>

                      {uncategorized && choices.length > 0 && (
                        // On a phone the picker takes its own line: inline it claimed every spare
                        // pixel and squeezed the description to 11px. From `sm` up there is room
                        // for it beside the description.
                        <div className="order-last w-full sm:order-none sm:w-40">
                          <Select
                            value=""
                            onValueChange={(value) => setCategoryOf.mutate({ id: row.id, categoryId: Number(value) })}
                          >
                          <SelectTrigger
                            className="h-8 w-auto shrink-0 gap-1 rounded-full border-dashed border-blue-300 px-2.5 text-xs font-semibold text-blue-700 dark:border-blue-700 dark:text-blue-300"
                            aria-label={t("page.ledger.choose_category_for", { name: row.description })}
                            data-testid="ledger-categorize"
                          >
                            <Tag className="h-3 w-3" aria-hidden="true" />
                            <span className="hidden sm:inline">{t("page.ledger.choose_category")}</span>
                          </SelectTrigger>
                          <SelectContent>
                            {choices.map((option) => (
                              <SelectItem key={option.id} value={String(option.id)}>
                                <span className="flex items-center gap-2">
                                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: safeColor(option.color) }} aria-hidden="true" />
                                  {option.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        </div>
                      )}

                      <span
                        className={cn(
                          "whitespace-nowrap text-[15px] font-semibold tabular-nums",
                          expense ? "text-gray-900 dark:text-white" : "text-emerald-700 dark:text-emerald-400",
                        )}
                      >
                        {expense ? "−" : "+"}{formatMoney(Math.abs(Number(row.amount) || 0))}
                      </span>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={t("page.ledger.actions_for", { name: row.description })}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditing(row as EditableTransaction)}>
                            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                            {t("page.common.edit")}
                          </DropdownMenuItem>
                          {row.paymentUrl && (
                            <DropdownMenuItem asChild>
                              <a href={row.paymentUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                                {t("page.ledger.open_payment_link")}
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onSelect={() => setDeleting(row)} className="text-red-700 focus:text-red-800 dark:text-red-400">
                            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                            {t("page.common.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {searchingAll && shown >= SEARCH_LIMIT && (
            <p className="text-center text-xs text-gray-600 dark:text-gray-400">{t("page.ledger.search_capped", { count: SEARCH_LIMIT })}</p>
          )}
        </div>
      )}

      <TransactionFormDialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} transaction={editing} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("page.ledger.delete_title")}
        body={deleting ? t("page.ledger.delete_body", {
          name: deleting.description,
          amount: formatMoney(Math.abs(Number(deleting.amount) || 0)),
          date: f.dateLabel(dayKeyIn(deleting.date, timeZone)),
        }) : undefined}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </Panel>
  );
}
