import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Repeat, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RecurringLine } from "@shared/dashboardOverview";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Panel, PanelTitle, useOverviewFormat } from "./overviewShared";

/**
 * The movements that repeat inside the month on screen ("Movimientos que se repiten").
 *
 * The page only draws this card when the month has at least one occurrence, so the row it shares
 * with the adviser goes back to full width for everyone else. Each line says how often the rule
 * lands and on which days, and the totals at the bottom are what the month really repeats — not an
 * average. Stopping one keeps the transactions it already created.
 */
export function RecurringCard({ rules, className }: { rules: RecurringLine[]; className?: string }) {
  const { t } = useTranslation();
  const f = useOverviewFormat();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useClerkUserReady();
  const [stopping, setStopping] = useState<RecurringLine | null>(null);

  const stop = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/recurring-transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-transactions"] });
      toast({ title: t("recurring.stopped") });
    },
    onError: () => toast({ title: t("recurring.stop_failed"), variant: "destructive" }),
  });

  if (rules.length === 0) return null;

  const monthTotal = (type: RecurringLine["type"]) =>
    rules.filter((rule) => rule.type === type).reduce((sum, rule) => sum + rule.amountCents * rule.count, 0);
  const expensesCents = monthTotal("expense");
  const incomeCents = monthTotal("income");

  return (
    <Panel
      labelledBy="recurring-title"
      testId="dashboard-recurring"
      className={`flex flex-col gap-3 ${className ?? ""}`}
    >
      <PanelTitle id="recurring-title">
        <Repeat className="h-4 w-4 text-gray-500" aria-hidden="true" />
        {t("recurring.title")}
      </PanelTitle>

      <p className="text-sm text-gray-600 dark:text-gray-400">{t("recurring.description")}</p>

      <ul className="flex flex-col">
        {rules.map((rule) => {
          const expense = rule.type === "expense";
          const days =
            rule.lastDay === rule.firstDay
              ? f.shortDay(rule.firstDay)
              : `${f.shortDay(rule.firstDay)} – ${f.shortDay(rule.lastDay)}`;
          return (
            <li
              key={rule.id}
              className="flex items-center justify-between gap-3 border-b border-gray-100 py-2.5 last:border-b-0 dark:border-gray-800"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{rule.description}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {t(`recurring.frequency.${rule.frequency}`, rule.frequency)} · {days}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`whitespace-nowrap text-sm font-semibold tabular-nums ${
                    expense ? "text-gray-900 dark:text-white" : "text-emerald-700 dark:text-emerald-400"
                  }`}
                >
                  {expense ? "−" : "+"}
                  {f.money(rule.amountCents)}
                </span>
                <button
                  type="button"
                  disabled={stop.isPending}
                  onClick={() => setStopping(rule)}
                  aria-label={t("page.recurring.stop_named", { name: rule.description })}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 px-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("recurring.stop")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-1 text-[13px] text-gray-600 dark:text-gray-400">
        {expensesCents > 0 && <p>{t("page.recurring.monthly_expense", { amount: f.money(expensesCents) })}</p>}
        {incomeCents > 0 && <p>{t("page.recurring.monthly_income", { amount: f.money(incomeCents) })}</p>}
      </div>

      <ConfirmDialog
        open={Boolean(stopping)}
        onOpenChange={(open) => !open && setStopping(null)}
        title={t("page.recurring.stop_title", { name: stopping?.description ?? "" })}
        body={t("recurring.description")}
        confirmLabel={t("recurring.stop")}
        onConfirm={() => stopping && stop.mutate(stopping.id)}
      />
    </Panel>
  );
}
