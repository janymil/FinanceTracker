import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Repeat, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useCurrency } from "@/context/CurrencyContext";
import { useDateFormat } from "@/hooks/useDateFormat";
import { useToast } from "@/hooks/use-toast";

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

/**
 * The repeating transactions the user has set up, with a way to stop each one.
 * Free accounts get a 403 from the API and simply see nothing here.
 */
export function RecurringRulesCard({ kind }: { kind: "income" | "expense" }) {
  const { t, i18n } = useTranslation();
  const { formatMoney } = useCurrency();
  const { formatDate } = useDateFormat();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rules = [] } = useQuery<RecurringRule[]>({
    queryKey: ["/api/recurring-transactions", i18n.language],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/recurring-transactions");
      return response.ok ? response.json() : [];
    },
    retry: false,
  });

  const stop = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/recurring-transactions/${id}`);
      if (!response.ok) throw new Error("stop failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-transactions"] });
      toast({ title: t("recurring.stopped") });
    },
    onError: () => toast({ title: t("recurring.stop_failed"), variant: "destructive" }),
  });

  const mine = rules.filter((rule) => rule.type === kind);
  if (mine.length === 0) return null;

  return (
    <Card className="mb-6" data-testid="recurring-rules">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Repeat className="h-4 w-4" />
          {t("recurring.title")}
        </CardTitle>
        <CardDescription>{t("recurring.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {mine.map((rule) => (
          <div key={rule.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium truncate">{rule.description}</p>
              <p className="text-xs text-muted-foreground">
                {formatMoney(Number(rule.amount))} · {t(`recurring.frequency.${rule.frequency}`, rule.frequency)} ·{" "}
                {t("recurring.since", { date: formatDate(rule.startDate) })}
                {rule.endDate ? ` · ${t("recurring.until", { date: formatDate(rule.endDate) })}` : ""}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={stop.isPending}
              onClick={() => stop.mutate(rule.id)}
              aria-label={t("recurring.stop")}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              {t("recurring.stop")}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
