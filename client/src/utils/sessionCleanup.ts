/**
 * Utility functions for cleaning up localStorage and session data
 * to prevent cross-user data contamination
 */

export function clearUserSession() {
  // Preserve cookie consent and other non-user-specific data
  const cookieConsent = localStorage.getItem('cookie-consent');
  const theme = localStorage.getItem('theme');
  
  // Clear all localStorage
  localStorage.clear();
  
  // Restore non-user-specific data
  if (cookieConsent) {
    localStorage.setItem('cookie-consent', cookieConsent);
  }
  if (theme) {
    localStorage.setItem('theme', theme);
  }
  
  console.log('Session cleaned - localStorage cleared for user switch');
}

export function initializeCleanSession(newUserId: string) {
  // Store new user ID for tracking
  localStorage.setItem('clerk-user-id', newUserId);
  
  console.log('Clean session initialized for user:', newUserId);
}

export function detectUserSwitch(currentUserId: string): boolean {
  const storedUserId = localStorage.getItem('clerk-user-id');
  
  if (storedUserId && storedUserId !== currentUserId) {
    console.log('User switch detected:', storedUserId, '->', currentUserId);
    return true;
  }
  
  return false;
}