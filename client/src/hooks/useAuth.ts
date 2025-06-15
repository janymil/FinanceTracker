import { useUser } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export function useAuth() {
  const { user: clerkUser, isLoaded } = useUser();
  
  // Simplified authentication - just use Clerk user directly
  const isLoading = !isLoaded;
  const isAuthenticated = !!clerkUser && isLoaded;

  // Create a simplified user object from Clerk data
  const user = isAuthenticated ? {
    id: clerkUser.id,
    email: clerkUser.emailAddresses[0]?.emailAddress || '',
    firstName: clerkUser.firstName || '',
    lastName: clerkUser.lastName || '',
    profileImageUrl: clerkUser.imageUrl || '',
    plan: 'free', // Default plan
    createdAt: new Date(),
    updatedAt: new Date(),
  } : null;

  return {
    user,
    clerkUser,
    isLoading,
    isAuthenticated,
  };
}