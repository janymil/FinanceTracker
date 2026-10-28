import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarDays, Copy, Flag, MoreHorizontal, Pencil, PiggyBank, Plus, Target, Trash2, Trophy } from "lucide-react";
import AchievementsCard from "@/components/achievements-card";
import RequirePlan from "@/components/require-plan";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { useCategories } from "@/hooks/useCategories";
import { useUserTimeZone } from "@/hooks/useUserTimeZone";
import { apiRequest } from "@/lib/queryClient";
import { apiErrorMessage } from "@/lib/apiError";
import { goalCategoryLabel, goalCategorySlug } from "@/lib/goalCategories";
import { cn } from "@/lib/utils";
import {
  EmptyState,
  HeroCard,
  HeroStat,
  LoadError,
  Meter,
  PageHeader,
  PageShell,
  Panel,
  PanelSkeleton,
  Segmented,
  primaryButton,
  secondaryButton,
  useOverviewFormat,
} from "@/components/page/kit";
import { planGoal, type GoalPlan } from "@shared/goalPlan";
import { dayKeyIn } from "@shared/ledger";
import { centsToNumber, isValidAmount, parseAmountToCents } from "@shared/money";

interface Goal {
  id: number;
  name: string;
  targetAmount: string | number;
  currentAmount: string | number;
  targetDate: string;
  category: string;
  description?: string | null;
  createdAt?: string | null;
  status?: string | null;
}

type GoalForm = { open: boolean; goal: Goal | null; name: string; target: string; saved: string; date: string; category: string; description: string };
type MoneyForm = { goal: Goal | null; mode: "add" | "take"; amount: string };

const PACE_STYLE: Record<GoalPlan["pace"], string> = {
  reached: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  ahead: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  on_track: "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  behind: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  overdue: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

function validPositive(value: string, allowZero = false): boolean {
  if (!isValidAmount(value)) return allowZero && value.trim() === "0";
  try {
    const cents = parseAmountToCents(value);
    return allowZero ? cents >= 0 : cents > 0;
  } catch {
    return false;
  }
}

/**
 * Savings goals: how far each one is, whether it is on pace, and what it takes per month.
 *
 * The dashboard's "Add savings" sent people here, and here there was no way to add savings — only
 * an edit form with the saved total in it. Now each goal has the button, and the pace judges the
 * saved amount against a steady saver since the goal began (the same rule as the dashboard).
 */
export default function Goals() {
  const { t, i18n } = useTranslation();
  const f = useOverviewFormat();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isReady, user } = useClerkUserReady();
  const timeZone = useUserTimeZone();
  const { data: categories = [] } = useCategories();
  const goalCategories = categories.filter((category) => category.type === "goal");
  const [view, setView] = useState<"active" | "reached">("active");

  const goalsQuery = useQuery<Goal[]>({
    queryKey: ["goals", user?.id],
    enabled: isReady && !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/goals");
      return response.json();
    },
  });

  const now = new Date();
  const planned = useMemo(
    () => (goalsQuery.data ?? []).map((goal) => ({ goal, plan: planGoal(goal, now, timeZone) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goalsQuery.data, timeZone],
  );
  const active = planned.filter((entry) => !entry.plan.reached).sort((a, b) => a.plan.daysLeft - b.plan.daysLeft);
  const reached = planned.filter((entry) => entry.plan.reached);

  const totalSaved = planned.reduce((sum, entry) => sum + entry.plan.savedCents, 0);
  const totalTarget = planned.reduce((sum, entry) => sum + entry.plan.targetCents, 0);
  const monthlyAll = active.reduce((sum, entry) => sum + (entry.plan.monthlyNeededCents ?? 0), 0);
  const behind = active.filter((entry) => entry.plan.pace === "behind" || entry.plan.pace === "overdue").length;
  const next = active.find((entry) => entry.plan.daysLeft >= 0);

  const [form, setForm] = useState<GoalForm>({ open: false, goal: null, name: "", target: "", saved: "", date: "", category: "", description: "" });
  const [money, setMoney] = useState<MoneyForm>({ goal: null, mode: "add", amount: "" });
  const [deleting, setDeleting] = useState<Goal | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["goals"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
    queryClient.invalidateQueries({ queryKey: ["achievements"] });
  };

  const openNew = () =>
    setForm({ open: true, goal: null, name: "", target: "", saved: "", date: "", category: goalCategories[0] ? goalCategorySlug(goalCategories[0].name) : "other", description: "" });
  const openEdit = (goal: Goal) =>
    setForm({
      open: true,
      goal,
      name: goal.name,
      target: String(Number(goal.targetAmount)),
      saved: String(Number(goal.currentAmount)),
      date: new Date(goal.targetDate).toISOString().slice(0, 10),
      category: goal.category,
      description: goal.description ?? "",
    });

  const saveGoal = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        targetAmount: centsToNumber(parseAmountToCents(form.target)),
        targetDate: form.date,
        category: form.category || "other",
        description: form.description.trim(),
      };
      if (form.goal) {
        body.currentAmount = form.saved.trim() === "" ? 0 : centsToNumber(parseAmountToCents(form.saved));
        await apiRequest("PUT", `/api/goals/${form.goal.id}`, body);
      } else {
        await apiRequest("POST", "/api/goals", body);
      }
    },
    onSuccess: () => {
      refresh();
      toast({ title: form.goal ? t("page.goals.updated") : t("page.goals.created") });
      setForm((current) => ({ ...current, open: false }));
    },
    onError: (error) => toast({ title: t("page.goals.save_failed"), description: apiErrorMessage(error, t("page.common.try_again")), variant: "destructive" }),
  });

  const moveMoney = useMutation({
    mutationFn: async () => {
      if (!money.goal) return { reached: false };
      const goal = money.goal;
      const change = parseAmountToCents(money.amount) * (money.mode === "add" ? 1 : -1);
      const next = Math.max(0, parseAmountToCents(goal.currentAmount ?? 0) + change);
      await apiRequest("PUT", `/api/goals/${goal.id}`, { currentAmount: centsToNumber(next) });
      return { reached: next >= parseAmountToCents(goal.targetAmount) };
    },
    onSuccess: ({ reached: done }) => {
      refresh();
      toast({
        title: done ? t("page.goals.reached_toast", { name: money.goal?.name }) : money.mode === "add" ? t("page.goals.added_toast") : t("page.goals.taken_toast"),
      });
      setMoney({ goal: null, mode: "add", amount: "" });
    },
    onError: (error) => toast({ title: t("page.goals.save_failed"), description: apiErrorMessage(error, t("page.common.try_again")), variant: "destructive" }),
  });

  const duplicate = useMutation({
    mutationFn: async (goal: Goal) => {
      await apiRequest("POST", "/api/goals", {
        name: `${goal.name} (${t("page.goals.copy_suffix")})`,
        targetAmount: Number(goal.targetAmount),
        targetDate: new Date(goal.targetDate).toISOString().slice(0, 10),
        category: goal.category,
        description: goal.description ?? "",
      });
    },
    onSuccess: () => {
      refresh();
      toast({ title: t("page.goals.duplicated") });
    },
    onError: (error) => toast({ title: t("page.goals.save_failed"), description: apiErrorMessage(error, t("page.common.try_again")), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/goals/${id}`);
    },
    onSuccess: () => {
      refresh();
      toast({ title: t("page.goals.deleted") });
    },
    onError: (error) => toast({ title: t("page.goals.delete_failed"), description: apiErrorMessage(error, t("page.common.try_again")), variant: "destructive" }),
  });

  const paceText = (plan: GoalPlan) => {
    if (plan.reached) return t("page.goals.pace_reached");
    if (plan.overdue) return t("page.goals.pace_overdue");
    return t(`page.goals.pace_${plan.pace}`);
  };

  const goalCard = ({ goal, plan }: (typeof planned)[number]) => {
    const expectedPct = plan.expectedCents !== null && plan.targetCents > 0 ? (plan.expectedCents * 100) / plan.targetCents : null;
    return (
      <li key={goal.id} className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900" data-testid="goal-card">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300" aria-hidden="true">
            {plan.reached ? <Trophy className="h-5 w-5" /> : <Target className="h-5 w-5" />}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">{goal.name}</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              {goal.category && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {goalCategoryLabel(goal.category, i18n.language)}
                </span>
              )}
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", PACE_STYLE[plan.pace])}>{paceText(plan)}</span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t("page.goals.actions_for", { name: goal.name })}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => openEdit(goal)}>
                <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("page.common.edit")}
              </DropdownMenuItem>
              {plan.savedCents > 0 && (
                <DropdownMenuItem onSelect={() => setMoney({ goal, mode: "take", amount: "" })}>
                  <PiggyBank className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t("page.goals.take_out")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => duplicate.mutate(goal)}>
                <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("page.goals.duplicate")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDeleting(goal)} className="text-red-700 focus:text-red-800 dark:text-red-400">
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("page.common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {goal.description && <p className="line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{goal.description}</p>}

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{f.money(plan.savedCents)}</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">{t("page.goals.of_target", { amount: f.money(plan.targetCents) })}</span>
          </div>
          <Meter
            percent={plan.percent}
            marker={!plan.reached && expectedPct !== null ? expectedPct : null}
            tone={plan.reached || plan.pace === "ahead" || plan.pace === "on_track" ? "good" : plan.pace === "overdue" ? "bad" : "warn"}
            label={t("page.goals.meter_label", { name: goal.name, pct: plan.percent })}
          />
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>{plan.percent}%</span>
            {!plan.reached && <span>{t("page.goals.left_amount", { amount: f.money(plan.remainingCents) })}</span>}
          </div>
        </div>

        {!plan.reached && (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex flex-col gap-0.5 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60">
              <dt className="text-xs text-gray-600 dark:text-gray-400">{t("page.goals.per_month")}</dt>
              <dd className="font-semibold tabular-nums text-gray-900 dark:text-white">
                {plan.monthlyNeededCents !== null ? f.money(plan.monthlyNeededCents) : "—"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60">
              <dt className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                <CalendarDays className="h-3 w-3" aria-hidden="true" />
                {f.dateLabel(plan.targetDay)}
              </dt>
              <dd className={cn("font-semibold text-gray-900 dark:text-white", plan.overdue && "text-red-700 dark:text-red-400")}>
                {plan.daysLeft > 0
                  ? t("page.goals.days_left", { count: plan.daysLeft })
                  : plan.daysLeft === 0 ? t("page.goals.due_today") : t("page.goals.days_late", { count: -plan.daysLeft })}
              </dd>
            </div>
          </dl>
        )}

        {!plan.reached ? (
          <button type="button" className={cn(primaryButton, "justify-center")} onClick={() => setMoney({ goal, mode: "add", amount: "" })} data-testid="goal-add-savings">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("page.goals.add_savings")}
          </button>
        ) : (
          <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-center text-sm font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            {t("page.goals.reached_line")}
          </p>
        )}
      </li>
    );
  };

  const moneyPlan = money.goal ? planGoal(money.goal, now, timeZone) : null;
  const moneyValid = validPositive(money.amount);
  const formValid = form.name.trim() && validPositive(form.target) && form.date && (!form.goal || form.saved.trim() === "" || validPositive(form.saved, true));
  const shown = view === "active" ? active : reached;

  return (
    <RequirePlan plan="standard">
      <PageShell testId="goals-page">
        <PageHeader
          title={t("page.goals.title")}
          subtitle={t("page.goals.subtitle")}
          actions={
            <button type="button" className={primaryButton} onClick={openNew} data-testid="goal-new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("page.goals.new")}
            </button>
          }
        />

        {goalsQuery.error && <LoadError onRetry={() => goalsQuery.refetch()} />}

        {goalsQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            <PanelSkeleton className="h-56 md:col-span-2 xl:col-span-3" />
            <PanelSkeleton className="h-72" />
            <PanelSkeleton className="h-72" />
          </div>
        ) : planned.length === 0 ? (
          <Panel label={t("page.goals.title")}>
            <EmptyState
              icon={<Flag className="h-6 w-6" aria-hidden="true" />}
              title={t("page.goals.empty_title")}
              body={t("page.goals.empty_body")}
              action={<button type="button" className={primaryButton} onClick={openNew}>{t("page.goals.new")}</button>}
            />
          </Panel>
        ) : (
          <>
            <HeroCard
              tone="violet"
              testId="goals-hero"
              label={t("page.goals.hero_label")}
              amount={f.money(totalSaved)}
              sub={
                active.length === 0
                  ? t("page.goals.hero_sub_all_reached")
                  : monthlyAll > 0
                    ? t("page.goals.hero_sub_monthly", { amount: f.money(monthlyAll) })
                    : t("page.goals.hero_sub_progress", { pct: totalTarget > 0 ? Math.floor((totalSaved * 100) / totalTarget) : 0 })
              }
              help={t("page.goals.hero_help")}
            >
              <div className="h-3 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white/90" style={{ width: `${totalTarget > 0 ? Math.min(100, (totalSaved * 100) / totalTarget) : 0}%` }} />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                <HeroStat label={t("page.goals.stat_target")} value={f.money(totalTarget)} note={t("page.goals.stat_goals", { count: planned.length })} />
                <HeroStat
                  label={t("page.goals.stat_behind")}
                  value={behind === 0 ? t("page.goals.none_behind") : String(behind)}
                  note={t("page.goals.stat_behind_note")}
                />
                <HeroStat
                  label={t("page.goals.stat_next")}
                  value={next ? f.dateLabel(next.plan.targetDay) : "—"}
                  note={next ? next.goal.name : t("page.goals.stat_next_none")}
                />
              </div>
            </HeroCard>

            {reached.length > 0 && (
              <Segmented
                label={t("page.goals.view_label")}
                value={view}
                onChange={setView}
                options={[
                  { value: "active", label: t("page.goals.view_active", { count: active.length }) },
                  { value: "reached", label: t("page.goals.view_reached", { count: reached.length }) },
                ]}
              />
            )}

            {shown.length === 0 ? (
              <Panel label={t("page.goals.title")}>
                <EmptyState
                  icon={<Trophy className="h-6 w-6" aria-hidden="true" />}
                  title={t("page.goals.all_reached_title")}
                  body={t("page.goals.all_reached_body")}
                  action={<button type="button" className={primaryButton} onClick={openNew}>{t("page.goals.new")}</button>}
                />
              </Panel>
            ) : (
              <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{shown.map(goalCard)}</ul>
            )}
          </>
        )}

        <AchievementsCard className="rounded-2xl border-gray-200 shadow-none dark:border-gray-800 dark:bg-gray-900" />

        {/* Add or take out savings */}
        <Dialog open={Boolean(money.goal)} onOpenChange={(open) => !open && setMoney({ goal: null, mode: "add", amount: "" })}>
          <DialogContent className="sm:max-w-md" data-testid="goal-money-form">
            <DialogHeader>
              <DialogTitle>{money.mode === "add" ? t("page.goals.add_title", { name: money.goal?.name }) : t("page.goals.take_title", { name: money.goal?.name })}</DialogTitle>
              <DialogDescription>
                {moneyPlan && t("page.goals.money_description", { saved: f.money(moneyPlan.savedCents), target: f.money(moneyPlan.targetCents) })}
              </DialogDescription>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (moneyValid && !moveMoney.isPending) moveMoney.mutate();
              }}
            >
              <Segmented
                label={t("page.goals.money_mode")}
                value={money.mode}
                onChange={(mode) => setMoney((current) => ({ ...current, mode }))}
                options={[
                  { value: "add", label: t("page.goals.add_savings") },
                  { value: "take", label: t("page.goals.take_out") },
                ]}
              />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="goal-money">{t("page.form.amount")}</Label>
                <Input
                  id="goal-money"
                  inputMode="decimal"
                  autoComplete="off"
                  autoFocus
                  value={money.amount}
                  onChange={(event) => setMoney((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="0.00"
                  className="h-12 text-xl font-semibold tabular-nums"
                />
              </div>
              {money.mode === "add" && moneyPlan && (
                <div className="flex flex-wrap gap-2">
                  {moneyPlan.monthlyNeededCents !== null && (
                    <button
                      type="button"
                      className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      onClick={() => setMoney((current) => ({ ...current, amount: String(centsToNumber(moneyPlan.monthlyNeededCents ?? 0)) }))}
                    >
                      {t("page.goals.chip_monthly", { amount: f.money(moneyPlan.monthlyNeededCents) })}
                    </button>
                  )}
                  {moneyPlan.remainingCents > 0 && (
                    <button
                      type="button"
                      className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      onClick={() => setMoney((current) => ({ ...current, amount: String(centsToNumber(moneyPlan.remainingCents)) }))}
                    >
                      {t("page.goals.chip_finish", { amount: f.money(moneyPlan.remainingCents) })}
                    </button>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-600 dark:text-gray-400">{t("page.goals.money_hint")}</p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className={cn(secondaryButton, "justify-center")} onClick={() => setMoney({ goal: null, mode: "add", amount: "" })}>
                  {t("page.common.cancel")}
                </button>
                <button type="submit" className={cn(primaryButton, "justify-center")} disabled={!moneyValid || moveMoney.isPending} data-testid="goal-money-save">
                  {money.mode === "add" ? t("page.goals.add_confirm") : t("page.goals.take_confirm")}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Create / edit */}
        <Dialog open={form.open} onOpenChange={(open) => setForm((current) => ({ ...current, open }))}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md" data-testid="goal-form">
            <DialogHeader>
              <DialogTitle>{form.goal ? t("page.goals.edit_title") : t("page.goals.new_title")}</DialogTitle>
              <DialogDescription>{t("page.goals.form_description")}</DialogDescription>
            </DialogHeader>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (formValid && !saveGoal.isPending) saveGoal.mutate();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="goal-name">{t("page.goals.name")}</Label>
                <Input id="goal-name" maxLength={100} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder={t("page.goals.name_placeholder")} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="goal-target">{t("page.goals.target")}</Label>
                  <Input id="goal-target" inputMode="decimal" autoComplete="off" value={form.target} onChange={(event) => setForm((current) => ({ ...current, target: event.target.value }))} placeholder="0.00" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="goal-date">{t("page.goals.by_when")}</Label>
                  <Input id="goal-date" type="date" min={dayKeyIn(new Date(), timeZone)} value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
                </div>
              </div>
              {form.goal && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="goal-saved">{t("page.goals.saved_so_far")}</Label>
                  <Input id="goal-saved" inputMode="decimal" autoComplete="off" value={form.saved} onChange={(event) => setForm((current) => ({ ...current, saved: event.target.value }))} />
                </div>
              )}
              {goalCategories.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="goal-category">{t("page.form.category")}</Label>
                  <Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value }))}>
                    <SelectTrigger id="goal-category"><SelectValue placeholder={t("page.form.category_placeholder")} /></SelectTrigger>
                    <SelectContent>
                      {goalCategories.map((category) => (
                        <SelectItem key={category.id} value={goalCategorySlug(category.name)}>{category.name}</SelectItem>
                      ))}
                      {form.category && !goalCategories.some((c) => goalCategorySlug(c.name) === form.category) && (
                        <SelectItem value={form.category}>{goalCategoryLabel(form.category, i18n.language)}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="goal-description">{t("page.goals.why")}</Label>
                <Textarea id="goal-description" maxLength={1000} rows={2} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder={t("page.goals.why_placeholder")} />
              </div>
              {(() => {
                if (!validPositive(form.target) || !form.date) return null;
                const preview = planGoal({ targetAmount: form.target, currentAmount: form.goal ? form.saved || 0 : 0, targetDate: `${form.date}T12:00:00Z` }, now, timeZone);
                return preview.monthlyNeededCents !== null ? (
                  <p className="rounded-xl bg-violet-50 px-3.5 py-2.5 text-sm text-violet-900 dark:bg-violet-950 dark:text-violet-200">
                    {t("page.goals.preview", { amount: f.money(preview.monthlyNeededCents), count: preview.monthsLeft })}
                  </p>
                ) : null;
              })()}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className={cn(secondaryButton, "justify-center")} onClick={() => setForm((current) => ({ ...current, open: false }))}>
                  {t("page.common.cancel")}
                </button>
                <button type="submit" className={cn(primaryButton, "justify-center")} disabled={!formValid || saveGoal.isPending} data-testid="goal-save">
                  {form.goal ? t("page.form.save_changes") : t("page.goals.create")}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={Boolean(deleting)}
          onOpenChange={(open) => !open && setDeleting(null)}
          title={t("page.goals.delete_title", { name: deleting?.name ?? "" })}
          body={t("page.goals.delete_body")}
          onConfirm={() => deleting && remove.mutate(deleting.id)}
        />
      </PageShell>
    </RequirePlan>
  );
}
