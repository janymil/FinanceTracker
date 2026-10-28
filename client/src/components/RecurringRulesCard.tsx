import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Repeat, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { useDateFormat } from "@/hooks/useDateFormat";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Panel, PanelTitle, useOverviewFormat } from "@/components/page/kit";
import { parseAmountToCents } from "@shared/money";

interface RecurringRule {
  id: number;
  description: string;
  amount: string;
  type: "income" | "expense";
  frequency: string;
  startDate: string;
  endDate: string | null;
  lastProcessed: string | null;
}

/** How many times a frequency happens in an average month. */
const PER_MONTH: Record<string, number> = {
  daily: 365 / 12,
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

/**
 * The repeating transactions the user has set up, what they add up to in an average month, and a
 * way to stop each one. Free accounts get a 403 from the API and simply see nothing here.
 */
export function RecurringRulesCard({ kind }: { kind: "income" | "expense" }) {
  const { t, i18n } = useTranslation();
  const f = useOverviewFormat();
  const { formatDate } = useDateFormat();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [stopping, setStopping] = useState<RecurringRule | null>(null);

  const { data: rules = [] } = useQuery<RecurringRule[]>({
    queryKey: ["/api/recurring-transactions", i18n.language],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/recurring-transactions");
        return response.json();
      } catch {
        return [];
      }
    },
    retry: false,
  });

  const stop = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/recurring-transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      toast({ title: t("recurring.stopped") });
    },
    onError: () => toast({ title: t("recurring.stop_failed"), variant: "destructive" }),
  });

  const mine = rules.filter((rule) => rule.type === kind);
  if (mine.length === 0) return null;

  const monthlyCents = Math.round(
    mine.reduce((sum, rule) => {
      try {
        return sum + Math.abs(parseAmountToCents(rule.amount)) * (PER_MONTH[rule.frequency] ?? 1);
      } catch {
        return sum;
      }
    }, 0),
  );

  return (
    <Panel labelledBy={`recurring-${kind}-title`} testId="recurring-rules" className="flex flex-col gap-3">
      <PanelTitle id={`recurring-${kind}-title`}>
        <Repeat className="h-4 w-4 text-gray-500" aria-hidden="true" />
        {t("recurring.title")}
      </PanelTitle>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {kind === "expense"
          ? t("page.recurring.monthly_expense", { amount: f.money(monthlyCents) })
          : t("page.recurring.monthly_income", { amount: f.money(monthlyCents) })}
      </p>
      <ul className="flex flex-col">
        {mine.map((rule) => (
          <li key={rule.id} className="flex items-center justify-between gap-3 border-b border-gray-100 py-2.5 text-sm last:border-b-0 dark:border-gray-800">
            <div className="min-w-0">
              <p className="truncate font-semibold text-gray-900 dark:text-white">{rule.description}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {t(`recurring.frequency.${rule.frequency}`, rule.frequency)} · {t("recurring.since", { date: formatDate(rule.startDate) })}
                {rule.endDate ? ` · ${t("recurring.until", { date: formatDate(rule.endDate) })}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="whitespace-nowrap font-semibold tabular-nums text-gray-900 dark:text-white">
                {f.money(Math.abs(parseAmountToCents(rule.amount)))}
              </span>
              <button
                type="button"
                disabled={stop.isPending}
                onClick={() => setStopping(rule)}
                aria-label={t("page.recurring.stop_named", { name: rule.description })}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 px-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                {t("recurring.stop")}
              </button>
            </div>
          </li>
        ))}
      </ul>
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
