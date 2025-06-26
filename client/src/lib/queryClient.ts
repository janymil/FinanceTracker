import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // Handle deleted user scenario
    if (res.status === 401) {
      try {
        const errorData = JSON.parse(text);
        if (errorData.redirectToAuth) {
          // User account was deleted, redirect to auth
          window.location.href = '/auth';
          return;
        }
      } catch (e) {
        // Continue with normal error handling
      }
    }
    
    throw new Error(`${res.status}: ${text}`);
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  // Get Clerk session token for authentication
  try {
    if (typeof window !== 'undefined' && window.Clerk?.session) {
      const token = await window.Clerk.session.getToken();
      console.log('Clerk token available:', !!token);
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
    }
    console.log('No Clerk session available');
  } catch (error) {
    console.warn('Failed to get Clerk token:', error);
  }
  return {};
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = {
    ...authHeaders,
  };
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const authHeaders = await getAuthHeaders();
    
    const res = await fetch(queryKey[0] as string, {
      headers: authHeaders,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 0, // Always fresh
      gcTime: 5 * 60 * 1000,
      retry: 2,
      retryDelay: 500,
      networkMode: 'online',
    },
    mutations: {
      retry: false,
      networkMode: 'online',
    },
  },
});

// Security function to clear all user data on logout
export function clearUserSession() {
  // Clear all React Query cache
  queryClient.clear();
  
  // Clear localStorage but preserve cookie consent and AI-generated content
  if (typeof window !== 'undefined') {
    // Backup important data that should persist across sessions
    const cookieConsent = localStorage.getItem('cookie-consent');
    
    // Backup data that should persist across sessions
    const dataToPreserve: { [key: string]: string } = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        // App preferences (theme, language, user experience)
        key === 'theme' ||
        key.startsWith('theme-') ||
        key.startsWith('language-') ||
        key.startsWith('app-preference-') ||
        key.includes('user-settings') ||
        // Non-sensitive cached data
        key.includes('app-cache') ||
        key.includes('non-sensitive-cache') ||
        // AI-generated content
        key.startsWith('ai-tip-') ||
        key.startsWith('ai-financial-tip-') ||
        key.startsWith('daily-rec-') ||
        key.startsWith('expense-pred-') ||
        key.startsWith('ai-insights-') ||
        key.startsWith('financial-health-') ||
        key.startsWith('trend-pred-') ||
        key.startsWith('mascot_') ||
        key.includes('ai-generated') ||
        key.includes('openai-cache')
      )) {
        const value = localStorage.getItem(key);
        if (value) {
          dataToPreserve[key] = value;
        }
      }
    }
    
    // Clear all localStorage
    localStorage.clear();
    sessionStorage.clear();
    
    // Restore preserved data
    if (cookieConsent) {
      localStorage.setItem('cookie-consent', cookieConsent);
    }
    
    // Restore preserved data
    Object.entries(dataToPreserve).forEach(([key, value]) => {
      localStorage.setItem(key, value);
    });
  }
  
  // Clear query cache without forcing reload on auth, help, contact, and other public pages
  const publicPages = ['/auth', '/help', '/contact', '/privacy-policy', '/terms-of-service', '/cookie-policy', '/pricing', '/'];
  const isPublicPage = publicPages.some(page => 
    window.location.pathname === page || 
    window.location.pathname.startsWith('/auth')
  );
  
  if (!isPublicPage) {
    window.location.reload();
  }
}

// Security function to clear cache when user changes
export function clearCacheOnUserChange(newUserId: string) {
  const currentUserId = localStorage.getItem('currentUserId');
  
  if (currentUserId && currentUserId !== newUserId) {
    // Different user detected - clear everything
    queryClient.clear();
    localStorage.clear();
  }
  
  // Store new user ID
  localStorage.setItem('currentUserId', newUserId);
}

// Optimistic update helper
export const updateCacheOptimistically = (newData: any, type: 'transaction' | 'summary') => {
  if (type === 'transaction') {
    queryClient.setQueryData(['transactions'], (old: any[]) => {
      if (!old) return [newData];
      return [newData, ...old];
    });
  }
  
  if (type === 'summary') {
    queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
  }
};
