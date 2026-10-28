import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Copy, MoreHorizontal, Pencil, Plus, Target, Trash2, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RequirePlan from "@/components/require-plan";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories, invalidateMoney } from "@/hooks/useCategories";
import { apiRequest } from "@/lib/queryClient";
import { apiErrorMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import {
  CategoryTile,
  EmptyState,
  HeroCard,
  HeroStat,
  LoadError,
  Meter,
  MonthStepper,
  PageHeader,
  PageShell,
  Panel,
  PanelSkeleton,
  PanelTitle,
  primaryButton,
  safeColor,
  secondaryButton,
  useMonthNavigation,
  useOverviewFormat,
} from "@/components/page/kit";
import { buildMonthLedger, daysInMonthOf, shiftMonth, type LedgerTransaction } from "@shared/ledger";
import { centsToNumber, isValidAmount, parseAmountToCents } from "@shared/money";

interface BudgetRow {
  id: number;
  categoryId: number;
  amount: string;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  startDate: string;
  endDate: string;
  period?: string;
  spent?: number;
}

/** Budgets store calendar days ("2026-10-31" at midnight or noon UTC): read the UTC day. */
function utcDay(value: string): string {
  const d = new Date(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function inMonth(budget: BudgetRow, monthKey: string): boolean {
  return utcDay(budget.startDate) <= `${monthKey}-${daysInMonthOf(monthKey)}` && utcDay(budget.endDate) >= `${monthKey}-01`;
}

/** A suggested limit: the person's usual month for the category, rounded up to a round figure. */
function roundUp(cents: number): number {
  const step = cents >= 100_000 ? 5_000 : cents >= 10_000 ? 1_000 : 500;
  return Math.ceil(cents / step) * step;
}

type Status = "over" | "risk" | "close" | "fine";

/**
 * How much is left to spend this month, category by category, and whether the pace is right.
 *
 * "60% used" means one thing on the 5th and another on the 28th, so every bar carries a mark for
 * where an even pace would be today, and every line says what is left per day. Below the budgets:
 * where the person spends without one, with a suggested amount from their own usual month, and a
 * way to start a new month from last month's budgets instead of typing them again.
 */
export default function BudgetPage() {
  const { t } = useTranslation();
  const f = useOverviewFormat();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isReady, user } = useClerkUserReady();
  const nav = useMonthNavigation(null, { allowFuture: true });
  const { data: categories = [] } = useCategories();
  const { data: transactions } = useTransactions();

  const budgetsQuery = useQuery<BudgetRow[]>({
    queryKey: ["budgets", user?.id],
    enabled: isReady && !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/budgets");
      return response.json();
    },
  });
  const budgets = budgetsQuery.data ?? [];

  const ledger = useMemo(
    () => buildMonthLedger((Array.isArray(transactions) ? transactions : []) as LedgerTransaction[], nav.monthKey, { timeZone: nav.timeZone }),
    [transactions, nav.monthKey, nav.timeZone],
  );
  const { clock } = ledger;
  const isCurrent = clock.status === "current";
  const monthName = f.monthName(nav.monthKey);

  const monthBudgets = budgets.filter((budget) => inMonth(budget, nav.monthKey));
  const previousBudgets = budgets.filter((budget) => inMonth(budget, shiftMonth(nav.monthKey, -1)));
  const budgetedIds = new Set(monthBudgets.map((budget) => budget.categoryId));
  const toCopy = previousBudgets.filter((budget) => !budgetedIds.has(budget.categoryId));

  // Even pace: the share of the month lived by the end of today.
  const pacePct = isCurrent ? (clock.daysElapsed / clock.daysInMonth) * 100 : clock.status === "past" ? 100 : 0;

  const lines = monthBudgets
    .map((budget) => {
      const limitCents = parseAmountToCents(budget.amount);
      const spentCents = Math.round((Number(budget.spent) || 0) * 100);
      const usedPct = limitCents > 0 ? (spentCents * 100) / limitCents : 0;
      const leftCents = limitCents - spentCents;
      // Only everyday spending has a pace; the rent paid on the 1st will not be paid again.
      const everyday = ledger.expenseCategories.find((c) => c.categoryId === budget.categoryId)?.everydayCents ?? 0;
      const projected = isCurrent && clock.daysElapsed >= 5
        ? spentCents + Math.round((everyday / clock.daysElapsed) * clock.daysLeft)
        : null;
      let status: Status = "fine";
      if (spentCents > limitCents) status = "over";
      else if (isCurrent && projected !== null && projected > limitCents) status = "risk";
      else if (usedPct >= 85) status = "close";
      return { budget, limitCents, spentCents, usedPct, leftCents, projected, status };
    })
    .sort((a, b) => {
      const order: Record<Status, number> = { over: 0, risk: 1, close: 2, fine: 3 };
      return order[a.status] - order[b.status] || b.usedPct - a.usedPct;
    });

  const totalLimit = lines.reduce((sum, line) => sum + line.limitCents, 0);
  const totalSpent = lines.reduce((sum, line) => sum + line.spentCents, 0);
  const totalLeft = totalLimit - totalSpent;
  const perDay = isCurrent && clock.daysLeft + 1 > 0 && totalLeft > 0 ? Math.floor(totalLeft / (clock.daysLeft + 1)) : null;
  const overCount = lines.filter((line) => line.status === "over").length;
  const riskCount = lines.filter((line) => line.status === "risk" || line.status === "close").length;

  const unbudgeted = ledger.expenseCategories
    .filter((category) => category.categoryId !== null && !budgetedIds.has(category.categoryId))
    .slice(0, 6);

  // ---- create / edit ----
  const [dialog, setDialog] = useState<{ open: boolean; budget: BudgetRow | null; categoryId: string; amount: string }>({
    open: false,
    budget: null,
    categoryId: "",
    amount: "",
  });
  const [deleting, setDeleting] = useState<BudgetRow | null>(null);

  const openCreate = (categoryId?: number, suggestedCents?: number | null) =>
    setDialog({
      open: true,
      budget: null,
      categoryId: categoryId ? String(categoryId) : "",
      amount: suggestedCents ? String(centsToNumber(suggestedCents)) : "",
    });
  const openEdit = (budget: BudgetRow) =>
    setDialog({ open: true, budget, categoryId: String(budget.categoryId), amount: String(Number(budget.amount)) });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
    invalidateMoney(queryClient);
  };

  const monthDates = (key: string) => ({ startDate: `${key}-01`, endDate: `${key}-${String(daysInMonthOf(key)).padStart(2, "0")}` });

  const save = useMutation({
    mutationFn: async () => {
      const amount = centsToNumber(parseAmountToCents(dialog.amount));
      if (dialog.budget) {
        await apiRequest("PUT", `/api/budgets/${dialog.budget.id}`, { categoryId: Number(dialog.categoryId), amount });
      } else {
        await apiRequest("POST", "/api/budgets", { categoryId: Number(dialog.categoryId), amount, period: "monthly", ...monthDates(nav.monthKey) });
      }
    },
    onSuccess: () => {
      refresh();
      toast({ title: dialog.budget ? t("page.budget.updated") : t("page.budget.created") });
      setDialog((current) => ({ ...current, open: false }));
    },
    onError: (error) => toast({ title: t("page.budget.save_failed"), description: apiErrorMessage(error, t("page.common.try_again")), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/budgets/${id}`);
    },
    onSuccess: () => {
      refresh();
      toast({ title: t("page.budget.deleted") });
    },
    onError: (error) => toast({ title: t("page.budget.delete_failed"), description: apiErrorMessage(error, t("page.common.try_again")), variant: "destructive" }),
  });

  const copyPrevious = useMutation({
    mutationFn: async () => {
      // One at a time: a failure half-way leaves the ones already copied, and the rest can be retried.
      for (const budget of toCopy) {
        await apiRequest("POST", "/api/budgets", {
          categoryId: budget.categoryId,
          amount: Number(budget.amount),
          period: "monthly",
          ...monthDates(nav.monthKey),
        });
      }
      return toCopy.length;
    },
    onSuccess: (count) => {
      refresh();
      toast({ title: t("page.budget.copied", { count }) });
    },
    onError: (error) => {
      refresh();
      toast({ title: t("page.budget.copy_failed"), description: apiErrorMessage(error, t("page.common.try_again")), variant: "destructive" });
    },
  });

  const expenseCategories = categories.filter((category) => category.type === "expense");
  const dialogCategory = ledger.expenseCategories.find((c) => String(c.categoryId) === dialog.categoryId);
  const amountOk = isValidAmount(dialog.amount) && (() => {
    try {
      return parseAmountToCents(dialog.amount) > 0;
    } catch {
      return false;
    }
  })();

  const note = isCurrent
    ? t("overview.progress_current", { day: clock.daysElapsed, total: clock.daysInMonth, count: clock.daysLeft })
    : clock.status === "past" ? t("overview.progress_closed") : t("overview.progress_future");

  const statusText = (line: (typeof lines)[number]) => {
    if (line.status === "over") return t("page.budget.line_over", { amount: f.money(-line.leftCents) });
    if (isCurrent && line.leftCents > 0) {
      const days = clock.daysLeft + 1;
      return t("page.budget.line_left_per_day", { amount: f.money(line.leftCents), perDay: f.money(Math.floor(line.leftCents / days)) });
    }
    return t("page.budget.line_left", { amount: f.money(Math.max(0, line.leftCents)) });
  };

  const tone = (status: Status) => (status === "over" ? "bad" : status === "risk" || status === "close" ? "warn" : "good") as "bad" | "warn" | "good";

  return (
    <RequirePlan plan="standard">
      <PageShell testId="budget-page">
        <PageHeader
          title={t("page.budget.title")}
          subtitle={t("page.budget.subtitle")}
          actions={
            <button type="button" className={primaryButton} onClick={() => openCreate()} data-testid="budget-new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("page.budget.new")}
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
            note={note}
          />
        </PageHeader>

        {budgetsQuery.error && <LoadError onRetry={() => budgetsQuery.refetch()} />}

        {budgetsQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-5">
            <PanelSkeleton className="h-56" />
            <PanelSkeleton className="h-80" />
          </div>
        ) : (
          <>
            {lines.length > 0 && (
              <HeroCard
                tone={totalLeft < 0 ? "slate" : "blue"}
                testId="budget-hero"
                label={totalLeft < 0 ? t("page.budget.hero_over_label") : isCurrent ? t("page.budget.hero_label") : t("page.budget.hero_label_closed", { month: monthName })}
                amount={f.money(Math.abs(totalLeft))}
                sub={
                  totalLeft < 0
                    ? t("page.budget.hero_sub_over")
                    : perDay !== null
                      ? t("page.budget.hero_sub_per_day", { amount: f.money(perDay), count: clock.daysLeft + 1 })
                      : clock.status === "past"
                        ? t("page.budget.hero_sub_past", { kept: lines.length - overCount, total: lines.length })
                        : t("page.budget.hero_sub_future")
                }
                help={t("page.budget.hero_help")}
              >
                <div className="flex flex-col gap-2">
                  <div className="relative h-3 overflow-hidden rounded-full bg-white/20">
                    <div
                      className={totalSpent > totalLimit ? "h-full bg-red-400" : "h-full bg-white/90"}
                      style={{ width: `${Math.min(100, totalLimit > 0 ? (totalSpent * 100) / totalLimit : 0)}%` }}
                    />
                    {isCurrent && (
                      <span aria-hidden="true" className="absolute top-0 h-full w-0.5 bg-amber-300" style={{ left: `${pacePct}%` }} />
                    )}
                  </div>
                  {isCurrent && (
                    <span className="text-xs text-white/85">{t("page.budget.pace_legend")}</span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                  <HeroStat label={t("page.budget.budgeted")} value={f.money(totalLimit)} note={t("page.budget.budgets_count", { count: lines.length })} />
                  <HeroStat label={t("page.budget.spent")} value={f.money(totalSpent)} note={t("page.budget.spent_note", { pct: totalLimit > 0 ? Math.round((totalSpent * 100) / totalLimit) : 0 })} />
                  <HeroStat
                    label={t("page.budget.attention")}
                    value={overCount + riskCount === 0 ? t("page.budget.all_fine") : String(overCount + riskCount)}
                    note={overCount > 0 ? t("page.budget.over_count", { count: overCount }) : t("page.budget.attention_note")}
                  />
                </div>
              </HeroCard>
            )}

            {toCopy.length > 0 && clock.status !== "past" && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40">
                <div className="flex items-center gap-3">
                  <Copy className="h-5 w-5 text-blue-700 dark:text-blue-300" aria-hidden="true" />
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    {lines.length === 0
                      ? t("page.budget.copy_prompt_empty", { month: f.monthName(shiftMonth(nav.monthKey, -1)), count: toCopy.length })
                      : t("page.budget.copy_prompt_some", { month: f.monthName(shiftMonth(nav.monthKey, -1)), count: toCopy.length })}
                  </p>
                </div>
                <button type="button" className={primaryButton} disabled={copyPrevious.isPending} onClick={() => copyPrevious.mutate()} data-testid="budget-copy">
                  {t("page.budget.copy_button")}
                </button>
              </div>
            )}

            <Panel labelledBy="budgets-title" className="flex flex-col gap-4" testId="budget-list">
              <PanelTitle id="budgets-title">{t("page.budget.list_title", { month: monthName })}</PanelTitle>
              {lines.length === 0 ? (
                <EmptyState
                  icon={<Target className="h-6 w-6" aria-hidden="true" />}
                  title={t("page.budget.empty_title", { month: monthName })}
                  body={t("page.budget.empty_body")}
                  action={<button type="button" className={primaryButton} onClick={() => openCreate()}>{t("page.budget.new")}</button>}
                />
              ) : (
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {lines.map((line) => (
                    <li
                      key={line.budget.id}
                      className={cn(
                        "flex flex-col gap-3 rounded-xl border p-4",
                        line.status === "over"
                          ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20"
                          : "border-gray-100 bg-gray-50/60 dark:border-gray-800 dark:bg-gray-950/40",
                      )}
                      data-testid="budget-line"
                    >
                      <div className="flex items-center gap-3">
                        <CategoryTile color={line.budget.categoryColor} icon={line.budget.categoryIcon} name={line.budget.categoryName} />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{line.budget.categoryName}</span>
                          <span className="whitespace-nowrap text-[13px] tabular-nums text-gray-600 dark:text-gray-400">
                            {t("page.budget.spent_of", { spent: f.money(line.spentCents), limit: f.money(line.limitCents) })}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "hidden whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold sm:inline",
                            line.status === "over" && "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
                            (line.status === "risk" || line.status === "close") && "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
                            line.status === "fine" && "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                          )}
                        >
                          {t(`page.budget.status_${line.status}`)}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={t("page.budget.actions_for", { name: line.budget.categoryName })}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => openEdit(line.budget)}>
                              <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                              {t("page.budget.change_amount")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setDeleting(line.budget)} className="text-red-700 focus:text-red-800 dark:text-red-400">
                              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                              {t("page.common.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <Meter
                        percent={line.usedPct}
                        marker={isCurrent ? pacePct : null}
                        tone={tone(line.status)}
                        label={t("page.budget.meter_label", { name: line.budget.categoryName, pct: Math.round(line.usedPct) })}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px]">
                        <span className={cn("font-medium", line.status === "over" ? "text-red-700 dark:text-red-400" : "text-gray-700 dark:text-gray-300")}>
                          {statusText(line)}
                        </span>
                        {/* On a phone the status sits here, so the category name keeps the width. */}
                        <span
                          className={cn(
                            "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold sm:hidden",
                            line.status === "over" && "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
                            (line.status === "risk" || line.status === "close") && "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
                            line.status === "fine" && "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                          )}
                        >
                          {t(`page.budget.status_${line.status}`)}
                        </span>
                        {line.status === "risk" && line.projected !== null && (
                          <span className="text-amber-800 dark:text-amber-300">
                            {t("page.budget.line_projection", { amount: f.money(line.projected) })}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {isCurrent && lines.length > 0 && (
                <p className="text-xs text-gray-600 dark:text-gray-400">{t("page.budget.marker_explained")}</p>
              )}
            </Panel>

            {unbudgeted.length > 0 && (
              <Panel labelledBy="unbudgeted-title" className="flex flex-col gap-3" testId="budget-unbudgeted">
                <PanelTitle id="unbudgeted-title">
                  <Wallet className="h-4 w-4 text-gray-500" aria-hidden="true" />
                  {t("page.budget.unbudgeted_title")}
                </PanelTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t("page.budget.unbudgeted_body", { month: monthName })}</p>
                <ul className="flex flex-col">
                  {unbudgeted.map((category) => {
                    const suggestion = roundUp(Math.max(category.usualCents ?? 0, category.cents));
                    return (
                      <li key={category.key} className="flex flex-wrap items-center gap-3 border-b border-gray-100 py-2.5 last:border-b-0 dark:border-gray-800">
                        <CategoryTile color={category.color} icon={category.icon} name={category.name} size="sm" />
                        <span className="flex min-w-[10rem] flex-1 flex-col">
                          <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{category.name}</span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {t("page.budget.unbudgeted_meta", { amount: f.money(category.cents) })}
                            {category.usualCents !== null && ` · ${t("page.expenses.usual_amount", { amount: f.money(category.usualCents) })}`}
                          </span>
                        </span>
                        <button
                          type="button"
                          className={secondaryButton}
                          onClick={() => openCreate(category.categoryId ?? undefined, suggestion)}
                        >
                          {t("page.budget.set_amount", { amount: f.money(suggestion) })}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            )}
          </>
        )}

        <Dialog open={dialog.open} onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}>
          <DialogContent className="sm:max-w-md" data-testid="budget-form">
            <DialogHeader>
              <DialogTitle>{dialog.budget ? t("page.budget.edit_title") : t("page.budget.new_title", { month: monthName })}</DialogTitle>
              <DialogDescription>{t("page.budget.form_description")}</DialogDescription>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (amountOk && dialog.categoryId && !save.isPending) save.mutate();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="budget-category">{t("page.form.category")}</Label>
                <Select value={dialog.categoryId} onValueChange={(value) => setDialog((current) => ({ ...current, categoryId: value }))}>
                  <SelectTrigger id="budget-category"><SelectValue placeholder={t("page.form.category_placeholder")} /></SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((category) => {
                      const taken = budgetedIds.has(category.id) && String(category.id) !== String(dialog.budget?.categoryId ?? "");
                      return (
                        <SelectItem key={category.id} value={String(category.id)} disabled={taken}>
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: safeColor(category.color) }} aria-hidden="true" />
                            {category.name}
                            {taken && <span className="text-xs text-gray-500">· {t("page.budget.already_set")}</span>}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="budget-amount">{t("page.budget.limit")}</Label>
                <Input
                  id="budget-amount"
                  inputMode="decimal"
                  autoComplete="off"
                  value={dialog.amount}
                  onChange={(event) => setDialog((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="0.00"
                  className="h-11 text-lg font-semibold tabular-nums"
                />
                {dialogCategory && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {dialogCategory.usualCents !== null && (
                      <button
                        type="button"
                        className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        onClick={() => setDialog((current) => ({ ...current, amount: String(centsToNumber(roundUp(dialogCategory.usualCents ?? 0))) }))}
                      >
                        {t("page.budget.use_usual", { amount: f.money(roundUp(dialogCategory.usualCents)) })}
                      </button>
                    )}
                    <span className="self-center text-xs text-gray-600 dark:text-gray-400">
                      {t("page.budget.spent_so_far", { amount: f.money(dialogCategory.cents) })}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button type="button" className={cn(secondaryButton, "justify-center")} onClick={() => setDialog((current) => ({ ...current, open: false }))}>
                  {t("page.common.cancel")}
                </button>
                <button type="submit" className={cn(primaryButton, "justify-center")} disabled={!amountOk || !dialog.categoryId || save.isPending} data-testid="budget-save">
                  {t("page.common.save")}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={Boolean(deleting)}
          onOpenChange={(open) => !open && setDeleting(null)}
          title={t("page.budget.delete_title", { name: deleting?.categoryName ?? "" })}
          body={t("page.budget.delete_body")}
          onConfirm={() => deleting && remove.mutate(deleting.id)}
        />
      </PageShell>
    </RequirePlan>
  );
}
