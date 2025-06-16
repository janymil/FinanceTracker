import { ClerkProvider as BaseClerkProvider } from '@clerk/clerk-react';
import { useEffect } from 'react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}

export function ClerkProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Simple session persistence using localStorage
    const handleBeforeUnload = () => {
      // Mark that we had an active session
      if (window.Clerk?.loaded) {
        localStorage.setItem('clerk_was_active', 'true');
        localStorage.setItem('clerk_last_active', Date.now().toString());
      }
    };

    // Check for recent session on mount
    const checkRecentSession = () => {
      const wasActive = localStorage.getItem('clerk_was_active');
      const lastActive = localStorage.getItem('clerk_last_active');
      
      if (wasActive && lastActive) {
        const lastActiveTime = parseInt(lastActive);
        const now = Date.now();
        const timeDiff = now - lastActiveTime;
        
        // If less than 10 minutes ago, try to maintain session
        if (timeDiff < 600000) {
          localStorage.setItem('clerk_restore_session', 'true');
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    checkRecentSession();

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <BaseClerkProvider 
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/auth"
      appearance={{
        variables: {
          colorPrimary: "hsl(221.2 83.2% 53.3%)",
        }
      }}
    >
      {children}
    </BaseClerkProvider>
  );
}