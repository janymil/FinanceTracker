import { useMemo } from "react";
import { format } from "date-fns";
import { Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loggingStreak } from "@shared/streaks";

interface LoggingStreakCardProps {
  /** Undefined while the list is still loading or failed to load: the card then stays hidden. */
  transactions?: Array<{ date: string | Date }> | null;
}

/** Real streak: days in a row on which the person recorded at least one transaction. */
export function LoggingStreakCard({ transactions: loaded }: LoggingStreakCardProps) {
  const { t } = useTranslation();
  const transactions = Array.isArray(loaded) ? loaded : [];

  const streak = useMemo(() => {
    const keys = transactions
      .map((transaction) => new Date(transaction.date))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map((date) => format(date, "yyyy-MM-dd"));
    return loggingStreak(keys, format(new Date(), "yyyy-MM-dd"));
  }, [loaded]);

  if (transactions.length === 0) return null;

  return (
    <Card data-testid="logging-streak">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className={`h-5 w-5 ${streak.current > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
          {t("streak.title")}
        </CardTitle>
        <CardDescription>{t("streak.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-6">
          <div>
            <p className="text-4xl font-bold" data-testid="streak-current">{streak.current}</p>
            <p className="text-xs text-muted-foreground">{t("streak.days_in_a_row")}</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-muted-foreground">{streak.best}</p>
            <p className="text-xs text-muted-foreground">{t("streak.best")}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {streak.loggedToday ? t("streak.logged_today") : t("streak.log_today")}
        </p>
      </CardContent>
    </Card>
  );
}
