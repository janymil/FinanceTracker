import { useUser } from "@clerk/clerk-react";
import { useMemo } from "react";

export function useClerkUserReady() {
  const { isLoaded, isSignedIn, user } = useUser();
  
  // Memoize the ready state to prevent unnecessary re-renders
  const isReady = useMemo(() => {
    return isLoaded && isSignedIn && !!user?.id;
  }, [isLoaded, isSignedIn, user?.id]);
  
  return { isReady, user, isLoaded, isSignedIn };
}