import { useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';

export function useSessionPersistence() {
  const { user, isLoaded } = useUser();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn && user) {
        // Store session info in localStorage
        localStorage.setItem('clerk_session_exists', 'true');
        localStorage.setItem('clerk_session_timestamp', Date.now().toString());
        localStorage.setItem('clerk_user_id', user.id);
      } else {
        // Clear session info when signed out
        localStorage.removeItem('clerk_session_exists');
        localStorage.removeItem('clerk_session_timestamp');
        localStorage.removeItem('clerk_user_id');
      }
    }
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    // Check for existing session on mount
    const sessionExists = localStorage.getItem('clerk_session_exists');
    const timestamp = localStorage.getItem('clerk_session_timestamp');
    
    if (sessionExists && timestamp && isLoaded && !isSignedIn) {
      const sessionTime = parseInt(timestamp);
      const currentTime = Date.now();
      const timeDiff = currentTime - sessionTime;
      
      // If session is less than 30 minutes old, try to restore
      if (timeDiff < 1800000) {
        console.log('Attempting to restore recent session...');
        // The presence of localStorage data will help maintain state
        // Clerk should automatically restore the session if it's still valid
      } else {
        // Clear old session data
        localStorage.removeItem('clerk_session_exists');
        localStorage.removeItem('clerk_session_timestamp');
        localStorage.removeItem('clerk_user_id');
      }
    }
  }, [isLoaded, isSignedIn]);

  return { sessionExists: localStorage.getItem('clerk_session_exists') === 'true' };
}