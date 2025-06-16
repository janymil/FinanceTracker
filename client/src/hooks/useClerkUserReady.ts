import { useUser } from "@clerk/clerk-react";

export function useClerkUserReady() {
  const { isLoaded, isSignedIn, user } = useUser();
  const isReady = isLoaded && isSignedIn && !!user?.id;

  return { isReady, user };
}