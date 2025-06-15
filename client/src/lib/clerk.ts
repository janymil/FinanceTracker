import { ClerkProvider } from '@clerk/clerk-react'

export const clerkConfig = {
  publishableKey: 'pk_test_dXNlZnVsLXJlZGZpc2gtMTUuY2xlcmsuYWNjb3VudHMuZGV2JA',
  signInUrl: '/sign-in',
  signUpUrl: '/sign-up',
  afterSignInUrl: '/',
  afterSignUpUrl: '/'
}

// Helper function to check if user has required subscription plan
export function hasRequiredPlan(userPlan: string | null | undefined, requiredPlan: 'free' | 'standard' | 'premium'): boolean {
  const planHierarchy = { free: 0, standard: 1, premium: 2 };
  const userLevel = planHierarchy[userPlan as keyof typeof planHierarchy] ?? 0;
  const requiredLevel = planHierarchy[requiredPlan];
  return userLevel >= requiredLevel;
}