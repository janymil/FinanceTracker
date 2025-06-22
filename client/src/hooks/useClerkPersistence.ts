import { useEffect } from 'react';
import { useClerk, useUser } from '@clerk/clerk-react';

export function useClerkPersistence() {
  const clerk = useClerk();
  const { user } = useUser();

  useEffect(() => {
    if (!clerk.loaded) return;

    // Store session state in localStorage for persistence
    const storeSessionState = () => {
      if (user) {
        localStorage.setItem('clerk_session_active', 'true');
        localStorage.setItem('clerk_user_id', user.id);
      } else {
        localStorage.removeItem('clerk_session_active');
        localStorage.removeItem('clerk_user_id');
      }
    };

    storeSessionState();

    // Listen for session changes
    const handleSessionChange = () => {
      storeSessionState();
    };

    // Store session state on visibility change (browser tab switching)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        storeSessionState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clerk.loaded, user]);

  // Check if user should be logged in based on stored session
  useEffect(() => {
    if (clerk.loaded && !user) {
      const wasLoggedIn = localStorage.getItem('clerk_session_active') === 'true';
      if (wasLoggedIn) {
        // Session tokens are automatically managed by Clerk
        // Just clear stored state if session is invalid
        setTimeout(() => {
          if (!user) {
            localStorage.removeItem('clerk_session_active');
            localStorage.removeItem('clerk_user_id');
          }
        }, 2000);
      }
    }
  }, [clerk.loaded, user]);
}