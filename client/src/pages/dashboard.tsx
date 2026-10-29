import { trackEvent } from '@/lib/analytics';
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { useClerkUserReady } from "@/hooks/useClerkUserReady";
import { useTransactions } from "@/hooks/useTransactions";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";
import { getMonthDateRange, shiftMonthKey } from "@/lib/dateRangeUtils";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import RequirePlan from "@/components/require-plan";
import FinancialHealthMascot from "@/components/financial-health-mascot";
import { useDashboardOverview, useOverviewFormat, PanelSkeleton } from "@/components/dashboard/overviewShared";
import { MonthHeroCard } from "@/components/dashboard/MonthHeroCard";
import { HealthCard } from "@/components/dashboard/HealthCard";
import { NeedsAttention } from "@/components/dashboard/NeedsAttention";
import { SpendingByCategory } from "@/components/dashboard/SpendingByCategory";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { GoalsCard } from "@/components/dashboard/GoalsCard";
import { SixMonthTrend } from "@/components/dashboard/SixMonthTrend";
import { RecurringCard } from "@/components/dashboard/RecurringCard";
import { AdviserTeaser, FreePlanCard } from "@/components/dashboard/PlanCards";

/*
 * The dashboard answers "how am I doing this month?" first, then "what needs me today?", then
 * the detail. Every number comes from one request (`/api/dashboard/overview`) computed on the
 * server in the person's own time zone, so the cards cannot disagree with each other.
 *
 * Adding a transaction lives in the top bar (and the bottom bar on a phone): one place, on every
 * page, instead of a second copy of the same form here.
 *
 * On a phone the cards stack in order of urgency (the month, what needs attention, the score, the
 * adviser, what repeats this month, then the detail); on a wide screen they pair up. The `order-*`
 * classes do that without rendering anything twice. The card of repeating movements shares the
 * adviser's line, and only exists when the month has something that repeats.
 */
export default function Dashboard() {
  const { isReady, user } = useClerkUserReady();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const f = useOverviewFormat();

  // Subscription success / failure coming back from checkout.
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const upgrade = urlParams.get('upgrade');
    const plan = urlParams.get('plan');
    const error = urlParams.get('error');

    if (upgrade === 'success' && plan) {
      trackEvent('purchase', 'subscription', plan);
      toast({
        title: t("Subscription Successful!"),
        description: `${t("You've been upgraded to the")} ${plan} ${t("plan. Enjoy your new features!")}`,
      });
      window.history.replaceState({}, '', '/');
    } else if (error) {
      let message = t("An error occurred during payment processing.");
      switch (error) {
        case 'payment_not_completed':
          message = t("Payment was not completed. Please try again.");
          break;
        case 'user_not_found':
          message = t("User account not found. Please contact support.");
          break;
        case 'plan_update_failed':
          message = t("Payment successful but plan update failed. Please contact support.");
          break;
      }
      toast({ title: t("Payment Error"), description: message, variant: "destructive" });
      window.history.replaceState({}, '', '/');
    } else if (urlParams.get('subscription') === 'success') {
      toast({
        title: t("Subscription Activated!"),
        description: t("Welcome to your new plan! All features are now available."),
      });
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [toast]);

  // undefined = this month, as the server reads it in the person's zone.
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(undefined);
  const { data: overview, isLoading, error, isFetching } = useDashboardOverview(selectedMonth);
  const { data: transactions, isLoading: transactionsLoading, dataUpdatedAt } = useTransactions();

  // Every add / edit / delete invalidates the transactions list; the overview follows it.
  const firstUpdate = useRef(true);
  useEffect(() => {
    if (firstUpdate.current) {
      firstUpdate.current = false;
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['dashboard-overview', user?.id] });
  }, [dataUpdatedAt]);

  if (!user) {
    return null;
  }

  const monthKey = overview?.month.key ?? selectedMonth;
  const plan = overview?.plan ?? 'free';
  const paid = plan !== 'free';
  const isCurrent = overview?.month.status === 'current';
  // Only a month that really has repeating movements gets the card; otherwise the adviser keeps
  // the whole row for itself.
  const recurring = overview?.recurring ?? [];
  const { startDate, endDate } = getMonthDateRange(monthKey ?? '2000-01');

  const progress = !overview
    ? ''
    : overview.month.status === 'current'
      ? t('overview.progress_current', { day: overview.month.day, total: overview.month.daysInMonth, count: overview.month.daysLeft })
      : overview.month.status === 'past'
        ? t('overview.progress_closed')
        : t('overview.progress_future');

  return <>
    <SEO
      title="Dashboard - Spending Overview | Kaptia"
      description="Your spending at a glance: expense tracking, budget progress and AI-organized categories."
      noindex
    />
    <div className="mx-auto flex max-w-7xl flex-col gap-5 pb-24 lg:pb-8">

      {/* Month + streak */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('overview.hello', { name: user.firstName || t('User') })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label={t('overview.prev_month')}
              disabled={!monthKey}
              onClick={() => monthKey && setSelectedMonth(shiftMonthKey(monthKey, -1))}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <h1
              className="min-w-[11rem] text-center font-display text-2xl font-bold tracking-tight text-gray-900 sm:min-w-[14rem] sm:text-3xl dark:text-white"
              aria-live="polite"
              data-testid="dashboard-month"
            >
              {monthKey ? f.monthLabel(monthKey) : ' '}
            </h1>
            <button
              type="button"
              aria-label={t('overview.next_month')}
              disabled={!monthKey || isCurrent}
              onClick={() => monthKey && setSelectedMonth(shiftMonthKey(monthKey, 1))}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
            {progress && (
              <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 sm:text-[13px] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                {progress}
              </span>
            )}
            {!isCurrent && overview && (
              <button
                type="button"
                onClick={() => setSelectedMonth(undefined)}
                className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"
              >
                {t('overview.back_to_current')}
              </button>
            )}
          </div>
        </div>
        {overview && overview.streak.current > 0 && (
          <span
            className="flex h-10 items-center gap-1.5 rounded-xl bg-orange-50 px-3 text-[13px] font-semibold text-orange-800 dark:bg-orange-950 dark:text-orange-300"
            title={t('streak.description')}
            data-testid="streak-chip"
          >
            <Flame className="h-4 w-4" aria-hidden="true" />
            {t('overview.streak', { count: overview.streak.current })}
          </span>
        )}
      </div>

      {!transactionsLoading && overview && (
        <OnboardingChecklist
          userId={user?.id}
          lang={i18n.language?.slice(0, 2) || 'en'}
          plan={plan}
          transactionsCount={Array.isArray(transactions) ? transactions.length : 0}
          incomeCount={Array.isArray(transactions) ? transactions.filter((tx: any) => tx.type === 'income').length : 0}
          budgetsCount={overview.budgetCount}
        />
      )}

      {/* A failed load is said out loud: zeros would read as real data. */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100"
        >
          <p className="font-medium">{t('We could not load your data', 'We could not load your data')}</p>
          <p className="mt-1 text-amber-800 dark:text-amber-200">
            {t(
              'The numbers below may be out of date. Please check your connection and reload the page.',
              'The numbers below may be out of date. Please check your connection and reload the page.',
            )}
          </p>
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['dashboard-overview', user?.id] })}
            className="mt-2 font-medium underline underline-offset-2"
          >
            {t('Try again', 'Try again')}
          </button>
        </div>
      )}

      {isLoading || !overview ? (
        !error && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12" aria-busy="true">
            <PanelSkeleton className="h-72 lg:col-span-8" />
            <PanelSkeleton className="h-72 lg:col-span-4" />
            <PanelSkeleton className="h-80 lg:col-span-5" />
            <PanelSkeleton className="h-80 lg:col-span-7" />
          </div>
        )
      ) : (
        <div className={`grid grid-cols-1 gap-5 transition-opacity lg:grid-cols-12 ${isFetching ? 'opacity-80' : ''}`}>
          <div className="order-1 lg:order-1 lg:col-span-8">
            <MonthHeroCard overview={overview} />
          </div>
          <div className="order-3 lg:order-2 lg:col-span-4">
            <HealthCard overview={overview} />
          </div>

          {isCurrent && (
            <NeedsAttention overview={overview} className="order-2 lg:order-3 lg:col-span-5" />
          )}
          <SpendingByCategory
            overview={overview}
            className={`order-6 lg:order-4 ${isCurrent ? 'lg:col-span-7' : 'lg:col-span-12'}`}
          />

          <div className={`order-4 lg:order-5 ${recurring.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
            {plan === 'premium' ? (
              /*
               * The adviser carries the longest text on the page (summary, findings, actions), so
               * it keeps the wider of the two columns; in a third of a row all of it was cut.
               * The card of repeating movements, when there is one, takes the other.
               */
              <RequirePlan
                plan="premium"
                compact
                ai
                feature={t('financialHealthAdvisor')}
                description={t('features.adviser.description')}
              >
                <FinancialHealthMascot startDate={startDate.toISOString()} endDate={endDate.toISOString()} />
              </RequirePlan>
            ) : plan === 'standard' ? (
              <AdviserTeaser />
            ) : (
              <FreePlanCard />
            )}
          </div>

          {recurring.length > 0 && (
            <div className="order-5 lg:order-5 lg:col-span-5">
              <RecurringCard rules={recurring} />
            </div>
          )}

          <RecentTransactions
            transactions={transactions as any}
            className={`order-7 ${paid ? 'lg:col-span-7' : 'lg:col-span-12'}`}
          />
          {paid && <GoalsCard overview={overview} className="order-8 lg:col-span-5" />}
          {paid && (
            <div className="order-9 lg:col-span-12">
              <SixMonthTrend overview={overview} />
            </div>
          )}
        </div>
      )}
    </div>
  </>
}
