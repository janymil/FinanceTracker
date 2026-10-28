import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Lock, MoreHorizontal, Pencil, Plus, Shapes, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories, invalidateMoney, type CategoryRow } from "@/hooks/useCategories";
import { apiRequest } from "@/lib/queryClient";
import { apiErrorMessage } from "@/lib/apiError";
import { categoryIcons } from "@/lib/icons-registry";
import { cn } from "@/lib/utils";
import {
  CategoryTile,
  ChangeChip,
  EmptyState,
  LoadError,
  PageHeader,
  PageShell,
  Panel,
  PanelSkeleton,
  PanelTitle,
  Segmented,
  primaryButton,
  secondaryButton,
  useMonthNavigation,
  useOverviewFormat,
} from "@/components/page/kit";
import { buildMonthLedger, type LedgerTransaction } from "@shared/ledger";
import { buildTrendStats } from "@shared/trendStats";

type Kind = "expense" | "income";

const EXPENSE_ICONS = ["food", "shopping", "transportation", "housing", "utilities", "healthcare", "entertainment", "education", "travel", "gift", "heart", "credit-card", "shield", "laptop", "other"];
const INCOME_ICONS = ["salary", "business", "freelance", "rental", "investment", "gift", "piggy-bank", "dollar-sign", "laptop", "other"];
const COLORS = ["#2563EB", "#0891B2", "#059669", "#65A30D", "#CA8A04", "#EA580C", "#DC2626", "#DB2777", "#9333EA", "#4F46E5", "#475569", "#0F766E"];

/**
 * How the person sorts their money, and what each category is doing.
 *
 * The old screen listed names with a "transactions" count the server never sent, hid edit and
 * delete behind a mouse hover (unreachable on a phone), offered both on the built-in categories
 * (which the server refuses to change) and answered in English whatever the language. Now each
 * category shows this month against the person's usual month and six months of shape; built-in
 * ones are marked as such; the person's own can be changed or removed from a menu that works on
 * touch.
 */
export default function Categories() {
  const { t } = useTranslation();
  const f = useOverviewFormat();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const nav = useMonthNavigation();
  const categoriesQuery = useCategories();
  const { data: transactions } = useTransactions();
  const [kind, setKind] = useState<Kind>("expense");
  const [editing, setEditing] = useState<{ open: boolean; category: CategoryRow | null; name: string; icon: string; color: string; type: Kind }>({
    open: false,
    category: null,
    name: "",
    icon: "other",
    color: COLORS[0],
    type: "expense",
  });
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);

  const rows = (Array.isArray(transactions) ? transactions : []) as LedgerTransaction[];
  const ledger = useMemo(() => buildMonthLedger(rows, nav.monthKey, { timeZone: nav.timeZone }), [rows, nav.monthKey, nav.timeZone]);
  const trends = useMemo(() => buildTrendStats(rows, 6, { timeZone: nav.timeZone }), [rows, nav.timeZone]);
  const useCount = useMemo(() => {
    const counts = new Map<number, number>();
    for (const row of rows) if (row.categoryId) counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1);
    return counts;
  }, [rows]);
  const all = (categoriesQuery.data ?? []).filter((category) => category.type === "expense" || category.type === "income");
  const counts = { expense: all.filter((c) => c.type === "expense").length, income: all.filter((c) => c.type === "income").length };
  const monthStats = new Map(
    (kind === "expense" ? ledger.expenseCategories : ledger.incomeCategories)
      .filter((stat) => stat.categoryId !== null)
      .map((stat) => [stat.categoryId as number, stat]),
  );
  const seriesFor = (id: number) => trends.categories.find((c) => c.key === `id:${id}`)?.series ?? null;

  const list = all
    .filter((category) => category.type === kind)
    .map((category) => ({
      category,
      month: monthStats.get(category.id) ?? null,
      uses: useCount.get(category.id) ?? 0,
      series: kind === "expense" ? seriesFor(category.id) : null,
      builtIn: category.userId === null || category.userId === undefined,
    }))
    .sort((a, b) => (b.month?.cents ?? 0) - (a.month?.cents ?? 0) || b.uses - a.uses || a.category.name.localeCompare(b.category.name));
  const active = list.filter((entry) => entry.uses > 0);
  const unused = list.filter((entry) => entry.uses === 0);

  const openNew = () => setEditing({ open: true, category: null, name: "", icon: "other", color: COLORS[0], type: kind });
  const openEdit = (category: CategoryRow) =>
    setEditing({ open: true, category, name: category.name, icon: category.icon || "other", color: category.color || COLORS[0], type: category.type as Kind });

  const save = useMutation({
    mutationFn: async () => {
      const body = { name: editing.name.trim(), icon: editing.icon, color: editing.color, type: editing.type };
      if (editing.category) await apiRequest("PUT", `/api/categories/${editing.category.id}`, body);
      else await apiRequest("POST", "/api/categories", body);
    },
    onSuccess: () => {
      invalidateMoney(queryClient);
      toast({ title: editing.category ? t("page.categories.updated") : t("page.categories.created") });
      setEditing((current) => ({ ...current, open: false }));
    },
    onError: (error) => toast({ title: t("page.categories.save_failed"), description: apiErrorMessage(error, t("page.common.try_again")), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      invalidateMoney(queryClient);
      toast({ title: t("page.categories.deleted") });
    },
    onError: (error) => toast({ title: t("page.categories.delete_failed"), description: apiErrorMessage(error, t("page.common.try_again")), variant: "destructive" }),
  });

  const icons = editing.type === "income" ? INCOME_ICONS : EXPENSE_ICONS;

  const row = (entry: (typeof list)[number]) => {
    const { category, month, uses, series, builtIn } = entry;
    const max = series ? Math.max(1, ...series) : 1;
    return (
      <li key={category.id} className="flex items-center gap-3 border-b border-gray-100 py-3 last:border-b-0 dark:border-gray-800" data-testid="category-row">
        <CategoryTile color={category.color} icon={category.icon} name={category.name} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{category.name}</span>
            {builtIn && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                <Lock className="h-3 w-3" aria-hidden="true" />
                {t("page.categories.built_in")}
              </span>
            )}
            {month && kind === "expense" && <ChangeChip pct={month.changePct} />}
          </span>
          <span className="truncate text-[13px] text-gray-600 dark:text-gray-400">
            {month
              ? t(kind === "expense" ? "page.categories.month_spent" : "page.categories.month_received", { amount: f.money(month.cents), count: month.count })
              : uses > 0 ? t("page.categories.nothing_this_month") : t("page.categories.never_used")}
            {uses > 0 && ` · ${t("page.categories.uses", { count: uses })}`}
          </span>
        </div>
        {series && series.some((value) => value > 0) && (
          <div className="hidden h-8 w-24 items-end gap-0.5 sm:flex" role="img" aria-label={t("page.categories.sparkline_label", { name: category.name })}>
            {series.map((value, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={cn("flex-1 rounded-t-sm", i === series.length - 1 ? "bg-blue-600" : "bg-blue-200 dark:bg-blue-900")}
                style={{ height: Math.max(2, (value / max) * 32) }}
              />
            ))}
          </div>
        )}
        {!builtIn ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t("page.categories.actions_for", { name: category.name })}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => openEdit(category)}>
                <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("page.common.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={uses > 0}
                onSelect={() => setDeleting(category)}
                className="text-red-700 focus:text-red-800 dark:text-red-400"
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                {uses > 0 ? t("page.categories.delete_in_use") : t("page.common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="w-9 shrink-0" aria-hidden="true" />
        )}
      </li>
    );
  };

  return (
    <PageShell testId="categories-page">
      <PageHeader
        title={t("page.categories.title")}
        subtitle={t("page.categories.subtitle")}
        actions={
          <button type="button" className={primaryButton} onClick={openNew} data-testid="category-new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("page.categories.new")}
          </button>
        }
      >
        <Segmented
          label={t("page.categories.kind_label")}
          value={kind}
          onChange={setKind}
          options={[
            { value: "expense", label: t("page.categories.expense_tab", { count: counts.expense }) },
            { value: "income", label: t("page.categories.income_tab", { count: counts.income }) },
          ]}
        />
      </PageHeader>

      {categoriesQuery.error && <LoadError onRetry={() => categoriesQuery.refetch()} />}

      {categoriesQuery.isLoading ? (
        <PanelSkeleton className="h-96" />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Panel labelledBy="cats-active-title" className="flex flex-col gap-2 lg:col-span-8">
            <PanelTitle
              id="cats-active-title"
              aside={<span className="text-xs text-gray-600 sm:text-sm dark:text-gray-400">{f.monthLabel(nav.monthKey)}</span>}
            >
              {kind === "expense" ? t("page.categories.active_expense") : t("page.categories.active_income")}
            </PanelTitle>
            {active.length === 0 ? (
              <EmptyState
                icon={<Shapes className="h-6 w-6" aria-hidden="true" />}
                title={t("page.categories.none_used_title")}
                body={t("page.categories.none_used_body")}
              />
            ) : (
              <ul className="flex flex-col">{active.map(row)}</ul>
            )}
          </Panel>

          <div className="flex flex-col gap-5 lg:col-span-4">
            <Panel labelledBy="cats-tips-title" className="flex flex-col gap-2">
              <PanelTitle id="cats-tips-title">{t("page.categories.tips_title")}</PanelTitle>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-gray-700 dark:text-gray-300">
                <li>{t("page.categories.tip_few")}</li>
                <li>{t("page.categories.tip_builtin")}</li>
                <li>{t("page.categories.tip_delete")}</li>
              </ul>
            </Panel>
            {unused.length > 0 && (
              <Panel labelledBy="cats-unused-title" className="flex flex-col gap-2">
                <PanelTitle id="cats-unused-title">{t("page.categories.unused_title", { count: unused.length })}</PanelTitle>
                <ul className="flex flex-col">{unused.map(row)}</ul>
              </Panel>
            )}
          </div>
        </div>
      )}

      <Dialog open={editing.open} onOpenChange={(open) => setEditing((current) => ({ ...current, open }))}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md" data-testid="category-form">
          <DialogHeader>
            <DialogTitle>{editing.category ? t("page.categories.edit_title") : t("page.categories.new_title")}</DialogTitle>
            <DialogDescription>{t("page.categories.form_description")}</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (editing.name.trim() && !save.isPending) save.mutate();
            }}
          >
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60" aria-hidden="true">
              <CategoryTile color={editing.color} icon={editing.icon} name={editing.name} size="lg" />
              <span className="truncate text-base font-semibold text-gray-900 dark:text-white">{editing.name || t("page.categories.preview")}</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category-name">{t("page.categories.name")}</Label>
              <Input
                id="category-name"
                autoFocus
                maxLength={50}
                value={editing.name}
                onChange={(event) => setEditing((current) => ({ ...current, name: event.target.value }))}
                placeholder={editing.type === "income" ? t("page.categories.name_income_placeholder") : t("page.categories.name_expense_placeholder")}
              />
            </div>

            {!editing.category && (
              <Segmented
                label={t("page.categories.kind_label")}
                value={editing.type}
                onChange={(type) => setEditing((current) => ({ ...current, type, icon: "other" }))}
                options={[
                  { value: "expense", label: t("page.form.expense") },
                  { value: "income", label: t("page.form.income") },
                ]}
              />
            )}

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">{t("page.categories.icon")}</legend>
              <div className="grid grid-cols-5 gap-2">
                {icons.map((name) => {
                  const Icon = (categoryIcons as Record<string, typeof Shapes>)[name] ?? Shapes;
                  const selected = editing.icon === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={selected}
                      aria-label={t(`page.categories.icons.${name.replace("-", "_")}`)}
                      onClick={() => setEditing((current) => ({ ...current, icon: name }))}
                      className={cn(
                        "flex h-11 items-center justify-center rounded-xl border transition-colors",
                        selected
                          ? "border-blue-700 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-200"
                          : "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800",
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">{t("page.categories.color")}</legend>
              <div className="grid grid-cols-6 gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-pressed={editing.color === color}
                    aria-label={t("page.categories.color_option", { color })}
                    onClick={() => setEditing((current) => ({ ...current, color }))}
                    className={cn(
                      "h-10 rounded-xl border-2 transition-transform",
                      editing.color === color ? "scale-105 border-gray-900 dark:border-white" : "border-transparent",
                    )}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className={cn(secondaryButton, "justify-center")} onClick={() => setEditing((current) => ({ ...current, open: false }))}>
                {t("page.common.cancel")}
              </button>
              <button type="submit" className={cn(primaryButton, "justify-center")} disabled={!editing.name.trim() || save.isPending} data-testid="category-save">
                {editing.category ? t("page.form.save_changes") : t("page.categories.create")}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("page.categories.delete_title", { name: deleting?.name ?? "" })}
        body={t("page.categories.delete_body")}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </PageShell>
  );
}
