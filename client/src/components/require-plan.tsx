import React, { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
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

  // Get user plan from database user object
  let userPlan: PlanType = 'free';
  
  // Check for plan property directly on user object (from database)
  if (user && 'plan' in user && user.plan) {
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

  // For form sections and transaction dialogs, show a compact inline upgrade message instead of full page
  const isFormContext = typeof window !== 'undefined' && 
    (window.location.pathname.includes('/income') || 
     window.location.pathname.includes('/expenses') || 
     window.location.pathname.includes('/transactions') ||
     // Check if we're inside a dialog by looking for dialog-specific elements
     document.querySelector('[role="dialog"]') !== null);

  if (isFormContext) {
    // Check if an upgrade box already exists in this dialog to prevent duplicates
    const existingUpgradeBox = typeof window !== 'undefined' && 
      document.querySelector('[data-upgrade-box="true"]');
    
    if (existingUpgradeBox) {
      // If an upgrade box already exists, just return null to prevent duplicates
      return null;
    }

    return (
      <div data-upgrade-box="true" className="border-2 border-dashed border-blue-300 dark:border-blue-600 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">
            {config?.icon ? <config.icon className="h-4 w-4 text-blue-600 dark:text-blue-400" /> : <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
          </div>
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-100">
              {feature || config?.feature || "Premium Feature"}
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
          <Link href="/pricing">
            <Button size="sm" variant="outline">
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