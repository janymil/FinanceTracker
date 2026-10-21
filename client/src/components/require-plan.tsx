import React, { ReactNode, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { apiRequest } from '@/lib/queryClient';
import UpgradePrompt from './upgrade-prompt';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Target, Crosshair, BarChart3, Calendar, TrendingUp, Users, Lock, Crown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type PlanType = 'free' | 'standard' | 'premium';

interface RequirePlanProps {
  plan: PlanType;
  children: ReactNode;
  feature?: string;
  description?: string;
  benefits?: string[];
  compact?: boolean;
}

const planHierarchy: Record<PlanType, number> = {
  free: 0,
  standard: 1,
  premium: 2,
};

// Feature configurations for upgrade prompts - using translation function
const getFeatureConfigs = (t: any) => ({
  budget: {
    feature: t('require_plan.features.budget.title'),
    description: t('require_plan.features.budget.description'),
    benefits: [
      t('require_plan.features.budget.benefits.0'),
      t('require_plan.features.budget.benefits.1'),
      t('require_plan.features.budget.benefits.2')
    ],
    icon: Target
  },
  goals: {
    feature: t('require_plan.features.goals.title'),
    description: t('require_plan.features.goals.description'),
    benefits: [
      t('require_plan.features.goals.benefits.0'),
      t('require_plan.features.goals.benefits.1'),
      t('require_plan.features.goals.benefits.2')
    ],
    icon: Crosshair
  },
  analytics: {
    feature: t('require_plan.features.analytics.title'),
    description: t('require_plan.features.analytics.description'),
    benefits: [
      t('require_plan.features.analytics.benefits.0'),
      t('require_plan.features.analytics.benefits.1'),
      t('require_plan.features.analytics.benefits.2')
    ],
    icon: BarChart3
  },
  trends: {
    feature: t('require_plan.features.trends.title'),
    description: t('require_plan.features.trends.description'),
    benefits: [
      t('require_plan.features.trends.benefits.0'),
      t('require_plan.features.trends.benefits.1'),
      t('require_plan.features.trends.benefits.2')
    ],
    icon: TrendingUp
  },
  calendar: {
    feature: t('require_plan.features.calendar.title'),
    description: t('require_plan.features.calendar.description'),
    benefits: [
      t('require_plan.features.calendar.benefits.0'),
      t('require_plan.features.calendar.benefits.1'),
      t('require_plan.features.calendar.benefits.2')
    ],
    icon: Calendar
  },
  export: {
    feature: t('require_plan.features.export.title'),
    description: t('require_plan.features.export.description'),
    benefits: [
      t('require_plan.features.export.benefits.0'),
      t('require_plan.features.export.benefits.1'),
      t('require_plan.features.export.benefits.2'),
      t('require_plan.features.export.benefits.3')
    ],
    requiredPlan: "premium" as PlanType,
    icon: BarChart3
  },
  collaborative: {
    feature: t('require_plan.features.collaborative.title'),
    description: t('require_plan.features.collaborative.description'),
    benefits: [
      t('require_plan.features.collaborative.benefits.0'),
      t('require_plan.features.collaborative.benefits.1'),
      t('require_plan.features.collaborative.benefits.2'),
      t('require_plan.features.collaborative.benefits.3')
    ],
    icon: Users
  }
});

export default function RequirePlan({ plan, children, feature, description, benefits, compact }: RequirePlanProps) {
  const { isLoaded, isSignedIn, user } = useUser();
  const isReady = isLoaded && isSignedIn && !!user?.id;
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  // Check for successful upgrade in URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const upgradeSuccess = urlParams.get('upgrade');
    
    if (upgradeSuccess === 'success' && user?.id) {
      // Force refresh user data after successful upgrade
      queryClient.invalidateQueries({ queryKey: ["auth-user", user.id] });
      
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [user?.id, queryClient]);

  // Get user's plan from database
  const { data: databaseUser, isLoading } = useQuery({
    queryKey: ["auth-user", user?.id],
    enabled: isReady && !!user?.id,
    staleTime: 0, // Always fresh for immediate updates
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/auth/user");
      return response.json();
    },
  });

  if (isLoading || !isReady || !user) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Get user plan from database user object
  const userPlan: PlanType = databaseUser?.plan || 'free';

  const requiredPlanLevel = planHierarchy[plan];
  const userPlanLevel = planHierarchy[userPlan];

  // Only render children if user's plan level is equal or higher than required
  if (userPlanLevel >= requiredPlanLevel) {
    return <>{children}</>;
  }

  // Try to auto-detect feature from current URL if not provided
  let featureKey = '';
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    if (path.includes('/budget')) featureKey = 'budget';
    else if (path.includes('/goals')) featureKey = 'goals';
    else if (path.includes('/analytics')) featureKey = 'analytics';
    else if (path.includes('/trends')) featureKey = 'trends';
    else if (path.includes('/calendar')) featureKey = 'calendar';
    else if (path.includes('/collaborative')) featureKey = 'collaborative';
  }

  const featureConfigs = getFeatureConfigs(t);
  const config = featureConfigs[featureKey as keyof typeof featureConfigs];

  // Show compact version if explicitly requested via prop OR if in dialog context
  if (compact || (typeof window !== 'undefined' && document.querySelector('[role="dialog"]') !== null)) {
    const isPremium = plan === 'premium';
    const planLabel = isPremium ? t('Premium') : t('Standard');
    // Standard = blue (primary brand), Premium = purple (premium brand)
    const accent = isPremium
      ? {
          card: 'border-purple-200/70 dark:border-purple-500/20 bg-gradient-to-br from-white via-white to-purple-50/70 dark:from-gray-900 dark:via-gray-900 dark:to-purple-950/40',
          glow: 'bg-purple-400/10 dark:bg-purple-500/10',
          tile: 'bg-gradient-to-br from-purple-600 to-fuchsia-600 shadow-purple-500/25',
          chip: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
          primaryBtn: 'from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 shadow-purple-500/20',
          outlineBtn: 'border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-500/30 dark:text-purple-300 dark:hover:bg-purple-500/10',
          previewBorder: 'border-purple-100/80 dark:border-purple-500/10',
          previewBar: 'bg-purple-200 dark:bg-purple-500/25',
          previewBarSoft: 'bg-purple-100 dark:bg-purple-500/20',
          previewGradient: 'from-purple-100 via-fuchsia-100 to-purple-50 dark:from-purple-500/10 dark:via-fuchsia-500/10 dark:to-transparent',
          overlay: 'border-purple-100 dark:border-purple-500/20 text-purple-600 dark:text-purple-300',
        }
      : {
          card: 'border-blue-200/70 dark:border-blue-500/20 bg-gradient-to-br from-white via-white to-blue-50/70 dark:from-gray-900 dark:via-gray-900 dark:to-blue-950/40',
          glow: 'bg-blue-400/10 dark:bg-blue-500/10',
          tile: 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-500/25',
          chip: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
          primaryBtn: 'from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/20',
          outlineBtn: 'border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-500/30 dark:text-blue-300 dark:hover:bg-blue-500/10',
          previewBorder: 'border-blue-100/80 dark:border-blue-500/10',
          previewBar: 'bg-blue-200 dark:bg-blue-500/25',
          previewBarSoft: 'bg-blue-100 dark:bg-blue-500/20',
          previewGradient: 'from-blue-100 via-indigo-100 to-blue-50 dark:from-blue-500/10 dark:via-indigo-500/10 dark:to-transparent',
          overlay: 'border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300',
        };

    return (
      <div className={`relative flex h-full flex-col overflow-hidden rounded-2xl border p-5 shadow-sm ${accent.card}`}>
        {/* soft glow */}
        <div className={`pointer-events-none absolute -top-20 -right-16 h-44 w-44 rounded-full blur-3xl ${accent.glow}`} aria-hidden />

        <div className="relative flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-lg ${accent.tile}`}>
            <Lock className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                {feature || config?.feature || t('require_plan.default.feature')}
              </h4>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${accent.chip}`}>
                <Crown className="h-3 w-3" />
                {planLabel}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
              {description || t('require_plan.compact.available_with', { plan: planLabel })}
            </p>
          </div>
        </div>

        {/* blurred preview of the locked panel */}
        <div className={`relative mt-4 h-24 select-none overflow-hidden rounded-xl border bg-white/60 dark:bg-gray-900/40 ${accent.previewBorder}`} aria-hidden>
          <div className="absolute inset-0 space-y-2 p-3 opacity-70 blur-[2px]">
            <div className={`h-2 w-1/3 rounded ${accent.previewBar}`} />
            <div className={`h-10 rounded-lg bg-gradient-to-r ${accent.previewGradient}`} />
            <div className={`h-2 w-2/3 rounded ${accent.previewBarSoft}`} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`rounded-full border bg-white/80 px-3 py-1 text-[11px] font-medium backdrop-blur dark:bg-gray-900/70 ${accent.overlay}`}>
              {t('require_plan.compact.available_with', { plan: planLabel })}
            </span>
          </div>
        </div>

        <div className="relative mt-4 flex flex-wrap gap-2">
          <Link href="/subscribe">
            <Button size="sm" className={`border-0 bg-gradient-to-r text-white shadow-md ${accent.primaryBtn}`}>
              {t('require_plan.compact.upgrade_now')}
            </Button>
          </Link>
          <Link href="/subscribe">
            <Button size="sm" variant="outline" className={accent.outlineBtn}>
              {t('require_plan.compact.view_plans')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <UpgradePrompt
      requiredPlan={plan}
      feature={feature || config?.feature || t('require_plan.default.feature')}
      description={description || config?.description || t('require_plan.default.description')}
      benefits={benefits || config?.benefits || [
        t('require_plan.default.benefits.0'),
        t('require_plan.default.benefits.1'),
        t('require_plan.default.benefits.2')
      ]}
      icon={config?.icon}
    />
  );
}