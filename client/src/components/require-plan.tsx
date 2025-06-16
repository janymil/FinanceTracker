import React, { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { useClerkUserReady } from '@/hooks/useClerkUserReady';
import { apiRequest } from '@/lib/queryClient';
import UpgradePrompt from './upgrade-prompt';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Target, Crosshair, BarChart3, Calendar, TrendingUp, Users, Lock } from 'lucide-react';

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

// Feature configurations for upgrade prompts
const featureConfigs = {
  budget: {
    feature: "Budget Management",
    description: "Take control of your spending with advanced budget tracking and management tools",
    benefits: [
      "Set spending limits for different expense categories",
      "Monitor your progress against budget goals", 
      "Get notified when approaching budget limits"
    ],
    icon: Target
  },
  goals: {
    feature: "Financial Goals",
    description: "Set and track your financial goals with intelligent progress monitoring",
    benefits: [
      "Create custom savings and debt payoff goals",
      "Track progress with visual indicators",
      "Get motivated with milestone celebrations"
    ],
    icon: Crosshair
  },
  analytics: {
    feature: "Advanced Analytics",
    description: "Deep insights into your financial patterns with AI-powered analysis",
    benefits: [
      "Interactive charts and trend analysis",
      "AI-powered spending insights",
      "Export reports in multiple formats"
    ],
    icon: BarChart3
  },
  trends: {
    feature: "Trend Analysis",
    description: "Visualize your financial trends with advanced charting and predictions",
    benefits: [
      "Long-term trend visualization",
      "Predictive spending analysis",
      "Seasonal pattern recognition"
    ],
    icon: TrendingUp
  },
  calendar: {
    feature: "Calendar View",
    description: "View your financial activities in an intuitive calendar interface",
    benefits: [
      "Monthly and weekly financial calendar",
      "Transaction scheduling and reminders",
      "Visual spending patterns by date"
    ],
    icon: Calendar
  },
  export: {
    feature: "Data Management",
    description: "Export and manage your financial data with CSV or PDF format for external analysis or record keeping.",
    benefits: [
      "Export transactions to CSV format",
      "Generate PDF reports",
      "Backup your financial data",
      "Share data with accountants"
    ],
    requiredPlan: "premium" as PlanType,
    icon: BarChart3
  },
  collaborative: {
    feature: "Collaborative Goals",
    description: "Work together with friends and family to achieve shared financial goals",
    benefits: [
      "Create shared savings goals with others",
      "Track group progress in real-time",
      "Send invitations and manage participants",
      "Celebrate milestones together"
    ],
    icon: Users
  }
};

export default function RequirePlan({ plan, children, feature, description, benefits, compact }: RequirePlanProps) {
  const { isReady, user } = useClerkUserReady();

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
              {plan.charAt(0).toUpperCase() + plan.slice(1)} Feature
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Available with {plan.charAt(0).toUpperCase() + plan.slice(1)} plan
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/subscribe">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
              Upgrade Now
            </Button>
          </Link>
          <Link href="/subscribe">
            <Button size="sm" variant="outline" className="border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-900/30">
              View Plans
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <UpgradePrompt
      requiredPlan={plan}
      feature={feature || config?.feature || "Premium Feature"}
      description={description || config?.description || "This feature requires a higher subscription plan"}
      benefits={benefits || config?.benefits || ["Access advanced features", "Get premium support", "Unlock full potential"]}
      icon={config?.icon}
    />
  );
}