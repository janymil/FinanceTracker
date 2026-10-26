import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/context/CurrencyContext";
import { apiRequest, newIdempotencyKey } from "@/lib/queryClient";
import { TimeZoneSetting } from "@/components/TimeZoneSetting";

// One key per save attempt: this screen writes the person's very first row, and a repeat of it
// must return that row instead of creating a second.
let firstTransactionKey = newIdempotencyKey();
import { parseFirstTransaction } from "@/lib/firstTransaction";

const doneKey = (userId: string) => `kaptia.welcome.done.${userId}`;

function readDone(userId: string | undefined): boolean {
  if (!userId) return true;
  try {
    return window.localStorage.getItem(doneKey(userId)) === "1";
  } catch {
    return false; // storage can be refused in private windows; the welcome then shows once per visit
  }
}

function markDone(userId: string) {
  try {
    window.localStorage.setItem(doneKey(userId), "1");
  } catch {
    /* nothing to persist to */
  }
}

/**
 * The first minute of a new account, after the currency is chosen: confirm the time zone, then
 * save a first transaction right here. It only appears for an account with no transactions and
 * never comes back once finished or skipped.
 */
export function FirstRunWelcome() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { currency, showSetupModal } = useCurrency();

  const userId = user?.id;
  const hasCurrency = Boolean((user as any)?.currency);
  const [done, setDone] = useState(() => readDone(userId));
  useEffect(() => setDone(readDone(userId)), [userId]);

  // The same cache the dashboard uses, so no extra request once it has loaded.
  const { data: transactions, isSuccess } = useQuery<unknown[]>({
    // Only "does this account have any history" is needed here, so one row is enough: the
    // unfiltered request used to download and decrypt everything to answer the same question.
    queryKey: ["/api/transactions?limit=1"],
    enabled: Boolean(userId) && hasCurrency,
  });
  const isNewAccount = isSuccess && Array.isArray(transactions) && transactions.length === 0;

  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const open = Boolean(userId) && hasCurrency && !showSetupModal && isNewAccount && !done;
  if (!open) return null;

  const finish = () => {
    if (userId) markDone(userId);
    setDone(true);
  };

  const save = async () => {
    const parsed = parseFirstTransaction(amount, description);
    if (!parsed) {
      setMessage(t("welcome.invalid"));
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await apiRequest(
        "POST",
        "/api/transactions",
        {
          amount: parsed.amount,
          description: parsed.description,
          type,
          date: new Date().toISOString(),
        },
        // The first screen only ever writes one row; a repeat of that write must not become two.
        { "Idempotency-Key": firstTransactionKey },
      );
      firstTransactionKey = newIdempotencyKey();
      await queryClient.invalidateQueries();
      toast({ title: t("welcome.saved") });
      finish();
    } catch (error) {
      console.error("First transaction failed:", error);
      setMessage(t("welcome.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && finish()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="first-run-welcome">
        <DialogHeader>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("welcome.step", { current: step, total: 2 })}
          </p>
          <DialogTitle className="text-xl">{step === 1 ? t("welcome.title") : t("welcome.first_title")}</DialogTitle>
          <DialogDescription>{step === 1 ? t("welcome.zone_intro") : t("welcome.first_intro")}</DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <TimeZoneSetting />
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={finish} data-testid="welcome-skip">
                {t("welcome.skip")}
              </Button>
              <Button onClick={() => setStep(2)} data-testid="welcome-next">
                {t("welcome.next")}
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("welcome.type_label")}>
              {(["expense", "income"] as const).map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={type === option ? "default" : "outline"}
                  aria-pressed={type === option}
                  onClick={() => setType(option)}
                  data-testid={`welcome-type-${option}`}
                >
                  {t(`welcome.type_${option}`)}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="welcome-amount">{t("welcome.amount", { currency })}</Label>
              <Input
                id="welcome-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                data-testid="welcome-amount"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="welcome-description">{t("welcome.description")}</Label>
              <Input
                id="welcome-description"
                autoComplete="off"
                maxLength={200}
                placeholder={t("welcome.description_placeholder")}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                data-testid="welcome-description"
              />
            </div>
            {message && (
              <p role="alert" className="text-sm text-red-600" data-testid="welcome-message">
                {message}
              </p>
            )}
            <div className="flex justify-between gap-2">
              <Button type="button" variant="ghost" onClick={finish} data-testid="welcome-skip">
                {t("welcome.skip")}
              </Button>
              <Button type="submit" disabled={saving} data-testid="welcome-save">
                {t("welcome.save")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
