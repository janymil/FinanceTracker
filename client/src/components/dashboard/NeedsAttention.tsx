import type { ReactNode } from "react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, Check, Tag, Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AttentionItem } from "@shared/dashboardOverview";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { Panel, PanelTitle, type Overview, useLangHref, useOverviewFormat } from "./overviewShared";

const KIND_STYLE: Record<AttentionItem["kind"], { tile: string; icon: ReactNode }> = {
  bill: { tile: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300", icon: <Bell className="h-[18px] w-[18px]" aria-hidden="true" /> },
  budget: { tile: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300", icon: <AlertTriangle className="h-[18px] w-[18px]" aria-hidden="true" /> },
  uncategorized: { tile: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300", icon: <Tag className="h-[18px] w-[18px]" aria-hidden="true" /> },
  goal: { tile: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300", icon: <Target className="h-[18px] w-[18px]" aria-hidden="true" /> },
};

const actionClass =
  "inline-flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-blue-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-blue-300 dark:hover:bg-gray-800";

/**
 * One list of what the person can act on today.
 *
 * It replaces four panels that each held a piece of it (reminders, the budget card, auto-
 * categorisation, goals). Every line says what it is, the figure behind it, and has one button
 * that goes where it is solved. It is about today, so it only appears on the current month.
 */
export function NeedsAttention({ overview, className }: { overview: Overview; className?: string }) {
  const { t } = useTranslation();
  const f = useOverviewFormat();
  const href = useLangHref();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useClerkUserReady();
  const items = overview.attention;

  const markPaid = useMutation({
    mutationFn: async (reminderId: string) => {
      const id = reminderId.replace(/^reminder_/, "");
      const response = await apiRequest("PUT", `/api/expense-reminders/${id}`, { isCompleted: true });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["expense-reminders", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["transaction-reminders", user?.id] });
    },
    onError: (error: any) => {
      toast({ title: t("Error"), description: error?.message, variant: "destructive" });
    },
  });

  const dueText = (dueDate: string, daysUntil: number) =>
    daysUntil === 0
      ? t("overview.attention.due_today")
      : daysUntil === 1
        ? t("overview.attention.due_tomorrow")
        : t("overview.attention.due_on", { date: f.dayLabel(dueDate) });

  const render = (item: AttentionItem) => {
    switch (item.kind) {
      case "bill":
        return {
          key: `bill-${item.id}`,
          title: t("overview.attention.bill_title", { title: item.title, amount: f.money(item.amountCents) }),
          sub: dueText(item.dueDate, item.daysUntil),
          action: item.canComplete ? (
            <button
              type="button"
              className={actionClass}
              disabled={markPaid.isPending}
              onClick={() => markPaid.mutate(item.id)}
            >
              {t("overview.attention.mark_paid")}
            </button>
          ) : (
            <Link href={href("/calendar")} className={actionClass}>{t("overview.attention.open_calendar")}</Link>
          ),
        };
      case "budget":
        return {
          key: `budget-${item.categoryName}`,
          title: t("overview.attention.budget_title", { category: item.categoryName, pct: item.percent }),
          sub: t("overview.attention.budget_sub", { spent: f.money(item.spentCents), limit: f.money(item.limitCents), count: item.daysLeft }),
          action: <Link href={href("/budget")} className={actionClass}>{t("overview.attention.open_budget")}</Link>,
        };
      case "uncategorized":
        return {
          key: "uncategorized",
          title: t("overview.attention.uncategorized_title", { count: item.count }),
          sub: t("overview.attention.uncategorized_sub", { amount: f.money(item.amountCents) }),
          action: <Link href={href("/transactions")} className={actionClass}>{t("overview.attention.categorize")}</Link>,
        };
      case "goal":
        return {
          key: `goal-${item.id}`,
          title: t("overview.attention.goal_title", { name: item.name, amount: f.money(item.remainingCents) }),
          sub: item.daysLeft < 0
            ? t("overview.attention.goal_overdue", { date: f.dateLabel(item.targetDate) })
            : t("overview.attention.goal_sub", { date: f.dateLabel(item.targetDate) }),
          action: <Link href={href("/goals")} className={actionClass}>{t("overview.attention.add_savings")}</Link>,
        };
    }
  };

  return (
    <Panel labelledBy="attention-title" testId="dashboard-attention" className={`flex flex-col gap-4 ${className ?? ""}`}>
      <PanelTitle
        id="attention-title"
        aside={<span className="text-xs text-gray-600 dark:text-gray-400">{t("overview.attention.today")}</span>}
      >
        {t("overview.attention.title")}
        {items.length > 0 && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-950 dark:text-red-300">
            {items.length}
          </span>
        )}
      </PanelTitle>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <Check className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="text-[15px] font-semibold text-gray-900 dark:text-white">{t("overview.attention.empty_title")}</span>
          <span className="max-w-sm text-sm text-gray-600 dark:text-gray-400">{t("overview.attention.empty_body")}</span>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((item) => {
            const view = render(item);
            const style = KIND_STYLE[item.kind];
            return (
              <li
                key={view.key}
                className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3 sm:flex sm:gap-3.5 sm:p-3.5 dark:border-gray-800 dark:bg-gray-950/40"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.tile}`}>{style.icon}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{view.title}</span>
                  <span className="text-[13px] text-gray-600 dark:text-gray-400">{view.sub}</span>
                </div>
                {/* Under the text on a phone, at the end of the line from `sm` up. */}
                <div className="col-start-2 sm:col-auto">{view.action}</div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
