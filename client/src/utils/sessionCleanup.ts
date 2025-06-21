// Session cleanup utility for handling authentication issues
export function clearStaleSession() {
  // Clear all Clerk-related localStorage data
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('clerk') || key.includes('__clerk'))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  // Clear session storage as well
  const sessionKeysToRemove = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && (key.includes('clerk') || key.includes('__clerk'))) {
      sessionKeysToRemove.push(key);
    }
  }
  
  sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
  
  console.log('Cleared stale authentication session data');
}

// Force sign out and redirect to auth
export async function forceSignOutAndRedirect() {
  try {
    const clerk = (window as any).Clerk;
    if (clerk) {
      await clerk.signOut();
    }
  } catch (error) {
    console.warn('Error during Clerk signOut:', error);
  }
  
  clearStaleSession();
  window.location.href = '/auth';
}