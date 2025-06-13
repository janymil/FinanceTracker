
import React, { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

type PlanType = 'free' | 'basic' | 'premium';

interface RequirePlanProps {
  plan: PlanType;
  children: ReactNode;
}

const planHierarchy: Record<PlanType, number> = {
  free: 0,
  basic: 1,
  premium: 2,
};

export default function RequirePlan({ plan, children }: RequirePlanProps) {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  const userPlan = (user.plan as PlanType) || 'free';
  const requiredPlanLevel = planHierarchy[plan];
  const userPlanLevel = planHierarchy[userPlan];

  // Only render children if user's plan level is equal or higher than required
  if (userPlanLevel >= requiredPlanLevel) {
    return <>{children}</>;
  }

  return null;
}
