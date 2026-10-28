import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, Repeat } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import RequirePlan from "@/components/require-plan";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/CurrencyContext";
import { useCategories, invalidateMoney } from "@/hooks/useCategories";
import { useTransactions } from "@/hooks/useTransactions";
import { useUserTimeZone } from "@/hooks/useUserTimeZone";
import { apiRequest, newIdempotencyKey } from "@/lib/queryClient";
import { apiErrorMessage } from "@/lib/apiError";
import type { QuickAddPreset } from "@/lib/quickAdd";
import { cn } from "@/lib/utils";
import { centsToNumber, isValidAmount, parseAmountToCents } from "@shared/money";
import { dayKeyIn, payeeKey } from "@shared/ledger";
import { primaryButton, safeColor, secondaryButton } from "@/components/page/kit";

export interface EditableTransaction {
  id: number;
  amount: string | number;
  description: string;
  date: string;
  type: "income" | "expense" | string;
  categoryId?: number | null;
  isRecurring?: boolean | null;
  recurringFrequency?: string | null;
  recurringEndDate?: string | null;
  paymentUrl?: string | null;
  referenceNote?: string | null;
}

type Kind = "income" | "expense";
const FREQUENCIES = ["weekly", "biweekly", "monthly", "quarterly", "yearly"] as const;

interface FormState {
  type: Kind;
  amount: string;
  description: string;
  date: string;
  categoryId: string;
  isRecurring: boolean;
  recurringFrequency: string;
  recurringEndDate: string;
  paymentUrl: string;
  referenceNote: string;
}

/**
 * The one form for adding and editing a transaction.
 *
 * There were four copies (top bar, Transactions, Income, Expenses), each with its own idea of
 * which fields exist, which caches to refresh and whether a double tap makes two rows. This one:
 *
 *   - accepts "12,50" as well as "12.50" (the parser the server uses),
 *   - remembers the category the person gave the same description last time ("Lidl" -> Food),
 *   - sends an idempotency key, so a repeated tap or a retry cannot add the expense twice,
 *   - refreshes every screen that shows money (`invalidateMoney`).
 */
export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  preset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: EditableTransaction | null;
  preset?: QuickAddPreset;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currency } = useCurrency();
  const timeZone = useUserTimeZone();
  const { data: categories = [] } = useCategories();
  const { data: history } = useTransactions();
  const editing = Boolean(transaction);
  const requestKey = useRef(newIdempotencyKey());
  const [moreOpen, setMoreOpen] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(false);

  const blank = (): FormState => ({
    type: preset?.type ?? "expense",
    amount: "",
    description: "",
    date: preset?.date ?? dayKeyIn(new Date(), timeZone),
    categoryId: "",
    isRecurring: false,
    recurringFrequency: "monthly",
    recurringEndDate: "",
    paymentUrl: "",
    referenceNote: "",
  });

  const [form, setForm] = useState<FormState>(blank);

  // Fill the form each time it opens: with the row being edited, or empty with the preset.
  useEffect(() => {
    if (!open) return;
    requestKey.current = newIdempotencyKey();
    setCategoryTouched(false);
    if (transaction) {
      setForm({
        type: transaction.type === "income" ? "income" : "expense",
        amount: String(Math.abs(Number(transaction.amount) || 0)),
        description: transaction.description ?? "",
        date: dayKeyIn(transaction.date, timeZone),
        categoryId: transaction.categoryId ? String(transaction.categoryId) : "",
        isRecurring: Boolean(transaction.isRecurring),
        recurringFrequency: transaction.recurringFrequency || "monthly",
        recurringEndDate: transaction.recurringEndDate ? dayKeyIn(transaction.recurringEndDate, timeZone) : "",
        paymentUrl: transaction.paymentUrl ?? "",
        referenceNote: transaction.referenceNote ?? "",
      });
      setMoreOpen(Boolean(transaction.isRecurring || transaction.paymentUrl || transaction.referenceNote));
    } else {
      setForm(blank());
      setMoreOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction?.id]);

  const typeCategories = categories.filter((category) => category.type === form.type);

  // The category last used with each description, newest row wins.
  const remembered = useMemo(() => {
    const map = new Map<string, { categoryId: number; description: string }>();
    const rows = Array.isArray(history) ? [...history] : [];
    rows.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (const row of rows as any[]) {
      if (!row.categoryId || row.type !== form.type) continue;
      const key = payeeKey(row.description);
      if (key) map.set(key, { categoryId: row.categoryId, description: row.description });
    }
    return map;
  }, [history, form.type]);

  const suggestions = useMemo(
    () => Array.from(remembered.values()).map((entry) => entry.description).slice(-30).reverse(),
    [remembered],
  );

  const setDescription = (description: string) => {
    setForm((current) => {
      const next = { ...current, description };
      if (!categoryTouched) {
        const match = remembered.get(payeeKey(description));
        if (match && typeCategories.some((category) => category.id === match.categoryId)) {
          next.categoryId = String(match.categoryId);
        }
      }
      return next;
    });
  };

  const amountValid = isValidAmount(form.amount) && (() => {
    try {
      return parseAmountToCents(form.amount) > 0;
    } catch {
      return false;
    }
  })();
  const canSave = amountValid && form.description.trim().length > 0 && Boolean(form.date);

  const save = useMutation({
    mutationFn: async ({ again }: { again: boolean }) => {
      const body = {
        type: form.type,
        amount: centsToNumber(parseAmountToCents(form.amount)),
        description: form.description.trim(),
        date: form.date,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        isRecurring: form.isRecurring,
        recurringFrequency: form.recurringFrequency,
        recurringEndDate: form.isRecurring && form.recurringEndDate ? form.recurringEndDate : null,
        paymentUrl: form.type === "expense" ? form.paymentUrl.trim() : "",
        referenceNote: form.referenceNote.trim(),
      };
      if (transaction) {
        await apiRequest("PUT", `/api/transactions/${transaction.id}`, body);
      } else {
        await apiRequest("POST", "/api/transactions", body, { "Idempotency-Key": requestKey.current });
      }
      return { again };
    },
    onSuccess: ({ again }) => {
      invalidateMoney(queryClient);
      toast({
        title: editing
          ? t("page.form.saved_edit")
          : form.type === "income" ? t("page.form.saved_income") : t("page.form.saved_expense"),
      });
      if (again) {
        // Same type and day, fresh key: the next entry is a new write, not a replay.
        requestKey.current = newIdempotencyKey();
        setCategoryTouched(false);
        setForm((current) => ({ ...blank(), type: current.type, date: current.date }));
      } else {
        onOpenChange(false);
      }
    },
    onError: (error) => {
      toast({ title: t("page.form.save_failed"), description: apiErrorMessage(error, t("page.common.try_again")), variant: "destructive" });
    },
  });

  const submit = (again: boolean) => {
    if (!canSave || save.isPending) return;
    save.mutate({ again });
  };

  const title = editing
    ? t("page.form.edit_title")
    : form.type === "income" ? t("page.form.add_income_title") : t("page.form.add_expense_title");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg" data-testid="transaction-form">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("page.form.description")}</DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit(false);
          }}
        >
          <div role="radiogroup" aria-label={t("page.form.type")} className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
            {(["expense", "income"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={form.type === kind}
                onClick={() => setForm((current) => ({ ...current, type: kind, categoryId: current.type === kind ? current.categoryId : "" }))}
                className={cn(
                  "flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors",
                  form.type === kind
                    ? kind === "expense"
                      ? "bg-white text-gray-900 shadow-sm dark:bg-gray-950 dark:text-white"
                      : "bg-white text-emerald-800 shadow-sm dark:bg-gray-950 dark:text-emerald-300"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
                )}
              >
                {kind === "expense" ? <ArrowDownLeft className="h-4 w-4" aria-hidden="true" /> : <ArrowUpRight className="h-4 w-4" aria-hidden="true" />}
                {kind === "expense" ? t("page.form.expense") : t("page.form.income")}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-amount">{t("page.form.amount")}</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-gray-500">{currency}</span>
              <Input
                id="tx-amount"
                inputMode="decimal"
                autoComplete="off"
                autoFocus={!editing}
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                placeholder="0.00"
                className="h-12 pl-12 text-xl font-semibold tabular-nums"
                aria-invalid={form.amount !== "" && !amountValid}
              />
            </div>
            {form.amount !== "" && !amountValid && (
              <span className="text-xs text-red-700 dark:text-red-400">{t("page.form.amount_invalid")}</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-description">{t("page.form.what")}</Label>
            <Input
              id="tx-description"
              list="tx-description-suggestions"
              autoComplete="off"
              maxLength={200}
              value={form.description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={form.type === "income" ? t("page.form.what_income_placeholder") : t("page.form.what_expense_placeholder")}
            />
            <datalist id="tx-description-suggestions">
              {suggestions.map((value) => <option key={value} value={value} />)}
            </datalist>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-date">{t("page.form.date")}</Label>
              <Input id="tx-date" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tx-category">{t("page.form.category")}</Label>
              <Select
                value={form.categoryId || "none"}
                onValueChange={(value) => {
                  setCategoryTouched(true);
                  setForm({ ...form, categoryId: value === "none" ? "" : value });
                }}
              >
                <SelectTrigger id="tx-category">
                  <SelectValue placeholder={t("page.form.category_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("page.common.uncategorized")}</SelectItem>
                  {typeCategories.map((category) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: safeColor(category.color) }} aria-hidden="true" />
                        {category.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMoreOpen((value) => !value)}
            aria-expanded={moreOpen}
            className="flex items-center gap-1.5 self-start text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", moreOpen && "rotate-180")} aria-hidden="true" />
            {t("page.form.more")}
          </button>

          {moreOpen && (
            <RequirePlan plan="standard" compact>
              <div className="flex flex-col gap-4 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={form.isRecurring}
                    onCheckedChange={(checked) => setForm({ ...form, isRecurring: checked === true })}
                  />
                  <Repeat className="h-4 w-4" aria-hidden="true" />
                  {form.type === "income" ? t("page.form.repeat_income") : t("page.form.repeat_expense")}
                </label>
                {form.isRecurring && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="tx-frequency">{t("page.form.frequency")}</Label>
                      <Select value={form.recurringFrequency} onValueChange={(value) => setForm({ ...form, recurringFrequency: value })}>
                        <SelectTrigger id="tx-frequency"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FREQUENCIES.map((frequency) => (
                            <SelectItem key={frequency} value={frequency}>{t(`recurring.frequency.${frequency}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="tx-end">{t("page.form.until")}</Label>
                      <Input id="tx-end" type="date" value={form.recurringEndDate} onChange={(event) => setForm({ ...form, recurringEndDate: event.target.value })} />
                    </div>
                  </div>
                )}
                {form.type === "expense" && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="tx-url">{t("page.form.payment_link")}</Label>
                    <Input id="tx-url" type="url" inputMode="url" value={form.paymentUrl} onChange={(event) => setForm({ ...form, paymentUrl: event.target.value })} placeholder="https://" />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tx-note">{t("page.form.note")}</Label>
                  <Input id="tx-note" maxLength={1000} value={form.referenceNote} onChange={(event) => setForm({ ...form, referenceNote: event.target.value })} placeholder={t("page.form.note_placeholder")} />
                </div>
              </div>
            </RequirePlan>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" className={cn(secondaryButton, "justify-center")} onClick={() => onOpenChange(false)}>
              {t("page.common.cancel")}
            </button>
            {!editing && (
              <button type="button" className={cn(secondaryButton, "justify-center")} disabled={!canSave || save.isPending} onClick={() => submit(true)}>
                {t("page.form.save_and_another")}
              </button>
            )}
            <button type="submit" className={cn(primaryButton, "justify-center")} disabled={!canSave || save.isPending} data-testid="transaction-save">
              {editing ? t("page.form.save_changes") : t("page.form.save")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
