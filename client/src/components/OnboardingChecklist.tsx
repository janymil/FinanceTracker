import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Circle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { onboardingSteps } from "@/lib/onboardingSteps";

interface OnboardingChecklistProps {
  userId: string | undefined;
  lang: string;
  plan: string | null | undefined;
  transactionsCount: number;
  incomeCount: number;
  budgetsCount: number;
}

const storageKey = (userId: string) => `kaptia.onboarding.dismissed.${userId}`;

function readDismissed(userId: string | undefined): boolean {
  if (!userId) return false;
  try {
    return window.localStorage.getItem(storageKey(userId)) === "1";
  } catch {
    return false; // private windows can refuse storage; the card then simply shows
  }
}

/**
 * First steps for a new account, ticked from the person's real data (not a stored flag), so
 * it can never claim something was done that was not. The steps match the plan: a free account
 * is never sent to a budget or goal it cannot create. It disappears by itself once the core
 * steps are done, or when dismissed.
 */
export function OnboardingChecklist({ userId, lang, plan, transactionsCount, incomeCount, budgetsCount }: OnboardingChecklistProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => readDismissed(userId));
  useEffect(() => setDismissed(readDismissed(userId)), [userId]);

  const paid = plan === "standard" || plan === "premium";
  // Goals and import history answer 403 on a plan that does not include them, so only ask when it does.
  const { data: goals } = useQuery<unknown[]>({ queryKey: ["/api/goals"], enabled: Boolean(userId) && paid });
  const { data: imports } = useQuery<unknown[]>({
    queryKey: ["/api/import-logs?limit=1"],
    enabled: Boolean(userId) && plan === "premium",
  });

  const { steps, coreCount } = onboardingSteps({
    plan,
    lang,
    transactionsCount,
    incomeCount,
    budgetsCount,
    goalsCount: Array.isArray(goals) ? goals.length : 0,
    importsCount: Array.isArray(imports) ? imports.length : 0,
  });

  const coreDone = steps.slice(0, coreCount).every((step) => step.done);
  if (!userId || dismissed || coreDone) return null;

  const completed = steps.filter((step) => step.done).length;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(storageKey(userId), "1");
    } catch {
      /* nothing to persist to; it stays hidden for this visit */
    }
  };

  return (
    <Card className="mb-6 border-indigo-200 dark:border-indigo-900" data-testid="onboarding-checklist">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{t("onboarding.title")}</CardTitle>
            <CardDescription>{t("onboarding.subtitle")}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={dismiss} aria-label={t("onboarding.dismiss")}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Progress value={(completed / steps.length) * 100} className="mt-3 h-2" />
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step) => (
          <div key={step.key} className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="flex items-start gap-3">
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              )}
              <div>
                <p className={`text-sm font-medium ${step.done ? "line-through text-muted-foreground" : ""}`}>
                  {t(`onboarding.steps.${step.key}.title`)}
                </p>
                <p className="text-xs text-muted-foreground">{t(`onboarding.steps.${step.key}.description`)}</p>
              </div>
            </div>
            {!step.done && (
              <Button asChild size="sm" variant="outline">
                <Link href={step.href}>{t(step.key === "upgrade" ? "onboarding.see_plans" : "onboarding.go")}</Link>
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
