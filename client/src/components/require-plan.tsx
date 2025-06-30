import React, { ReactNode, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { apiRequest } from '@/lib/queryClient';
import UpgradePrompt from './upgrade-prompt';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Target, Crosshair, BarChart3, Calendar, TrendingUp, Users, Lock } from 'lucide-react';
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
    return (
      <div className="border-2 border-dashed border-blue-300 dark:border-blue-600 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">
            <Lock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 text-lg">
              {t('require_plan.compact.feature_title', { plan: t(`plans.${plan}`) })}
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t('require_plan.compact.available_with', { plan: t(`plans.${plan}`) })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/subscribe">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
              {t('require_plan.compact.upgrade_now')}
            </Button>
          </Link>
          <Link href="/subscribe">
            <Button size="sm" variant="outline" className="border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-900/30">
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