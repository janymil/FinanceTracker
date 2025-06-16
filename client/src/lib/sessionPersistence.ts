import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';

export function useSessionPersistence() {
  const { isSignedIn, user, getToken } = useAuth();

  useEffect(() => {
    if (isSignedIn && user) {
      // Store authentication state in localStorage
      const authState = {
        userId: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        timestamp: Date.now(),
        lastActivity: Date.now()
      };
      
      localStorage.setItem('financepro_auth_state', JSON.stringify(authState));
      
      // Refresh token periodically to maintain session
      const refreshInterval = setInterval(async () => {
        try {
          await getToken();
          // Update last activity timestamp
          const currentState = JSON.parse(localStorage.getItem('financepro_auth_state') || '{}');
          currentState.lastActivity = Date.now();
          localStorage.setItem('financepro_auth_state', JSON.stringify(currentState));
        } catch (error) {
          console.log('Token refresh failed:', error);
        }
      }, 5 * 60 * 1000); // Refresh every 5 minutes

      return () => {
        clearInterval(refreshInterval);
      };
    } else {
      // Clear stored auth state when signed out
      localStorage.removeItem('financepro_auth_state');
    }
  }, [isSignedIn, user, getToken]);

  return { isSignedIn, user };
}

// Helper function to check if user should remain logged in
export function shouldMaintainSession(): boolean {
  const authState = localStorage.getItem('financepro_auth_state');
  if (!authState) return false;

  try {
    const parsed = JSON.parse(authState);
    const now = Date.now();
    const lastActivity = parsed.lastActivity || parsed.timestamp;
    
    // Keep session active for 24 hours of inactivity
    const sessionTimeout = 24 * 60 * 60 * 1000;
    
    return (now - lastActivity) < sessionTimeout;
  } catch {
    return false;
  }
}

// Function to restore session state
export function getStoredAuthState() {
  const authState = localStorage.getItem('financepro_auth_state');
  if (!authState) return null;

  try {
    return JSON.parse(authState);
  } catch {
    return null;
  }
}