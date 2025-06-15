import React, { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import UpgradePrompt from './upgrade-prompt';
import { Target, Crosshair, BarChart3, Calendar, TrendingUp, Users } from 'lucide-react';

type PlanType = 'free' | 'standard' | 'premium';

interface RequirePlanProps {
  plan: PlanType;
  children: ReactNode;
  feature?: string;
  description?: string;
  benefits?: string[];
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

export default function RequirePlan({ plan, children, feature, description, benefits }: RequirePlanProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Support both Clerk and Replit auth systems
  let userPlan: PlanType = 'free';
  
  // Check for Clerk user with publicMetadata.plan
  if (user.publicMetadata && typeof user.publicMetadata === 'object' && 'plan' in user.publicMetadata) {
    userPlan = (user.publicMetadata.plan as PlanType) || 'free';
  }
  // Check for Replit user with direct plan property
  else if (user.plan) {
    userPlan = (user.plan as PlanType) || 'free';
  }

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