import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getCurrentLanguageForAPI } from "../../../lib/languageUtils";

/**
 * Which cached views one change touches.
 *
 * Kept here, next to the client they are invalidated on, so the live-update stream and every
 * screen that writes cannot drift apart. They did: the receipt modal invalidated only
 * `transactions` and `financial-summary`, so a scanned expense left the dashboard showing the
 * previous numbers, and the person reported "it was not saved" and reloaded the page.
 *
 * A key here is a prefix — `["transactions"]` matches `["transactions", userId]`.
 */
export const QUERY_KEYS_BY_CHANGE = {
  transaction: [
    'transactions',
    'financial-summary',
    'expense-breakdown',
    'trend-predictions',
    'financial-health',
    'transaction-reminders',
    'recurring-transactions',
    'dashboard-overview',
  ],
  budget: ['budgets', 'financial-summary', 'dashboard-overview'],
  goal: ['goals', 'collaborative-goals', 'achievements', 'dashboard-overview'],
} as const satisfies Record<string, readonly string[]>;

export type ChangeType = keyof typeof QUERY_KEYS_BY_CHANGE;

/** Marks every view the change affects as stale, and refetches the ones on screen. */
export function invalidateViewsFor(client: QueryClient, changeType: ChangeType): void {
  for (const key of QUERY_KEYS_BY_CHANGE[changeType]) {
    client.invalidateQueries({ queryKey: [key] });
  }
}

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

export async function getAuthToken(): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && window.Clerk?.session) {
      return await window.Clerk.session.getToken();
    }
  } catch (error) {
    console.warn('Failed to get Clerk token:', error);
  }
  return null;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  // Get Clerk session token for authentication
  const token = await getAuthToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  /**
   * Extra headers. Used for `Idempotency-Key` on money writes: the same key on a retry makes the
   * server return the row it already created instead of adding a second expense.
   */
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = {
    ...authHeaders,
    ...(extraHeaders ?? {}),
  };
  
  // Add current language for backend translation
  if (typeof window !== 'undefined') {
    headers['x-user-language'] = getCurrentLanguageForAPI();
  }
  
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

/**
 * A key for one logical money write.
 *
 * Sent as `Idempotency-Key`: if the same one arrives twice (a double tap that beats the disabled
 * button, a retry after a flaky connection), the server answers with the row it already created
 * instead of adding a second expense. `crypto.randomUUID` needs a secure context, which the app
 * always runs in; the fallback is for a local http:// preview.
 */
export function newIdempotencyKey(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const authHeaders = await getAuthHeaders();
    
    // Add current language for backend translation
    const headers: Record<string, string> = { ...authHeaders };
    if (typeof window !== 'undefined') {
      headers['x-user-language'] = getCurrentLanguageForAPI();
    }
    
    const res = await fetch(queryKey[0] as string, {
      headers,
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
      // Every `useQuery({ queryKey: ["/api/..."] })` fetches the URL in its first key element.
      queryFn: getQueryFn({ on401: "throw" }),
      /*
       * `staleTime: 0, gcTime: 0` meant "always fresh, forget immediately": every mount refetched
       * and cached data was dropped the moment nothing was watching it. One person's session in
       * production showed the cost — inside twenty seconds:
       *
       *   GET /api/auth/user      200  x5
       *   GET /api/transactions   304  x4
       *   GET /api/categories     304  x3
       *
       * `/api/transactions` has no pagination, so each of those is the whole history and every
       * row is decrypted on the way out. Freshness is not traded away for it: a mutation
       * invalidates its key and active queries refetch at once, and the live-update stream
       * (`useRealtimeUpdates`) invalidates when another tab or the server changes something.
       * A minute of staleness therefore only affects a page nobody has touched.
       */
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
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
  
  // Do not force reload after logout - let Clerk handle the redirect
}

// Security function to clear cache when user changes
export function clearCacheOnUserChange(newUserId: string) {
  const currentUserId = localStorage.getItem('currentUserId');
  
  if (currentUserId && currentUserId !== newUserId) {
    console.log('Different user detected, clearing user-specific data while preserving preferences');
    
    // Clear all React Query cache
    queryClient.clear();
    
    // Clear localStorage but preserve global preferences that should persist across users
    if (typeof window !== 'undefined') {
      // Backup global preferences that should persist across all users
      const globalPreferences: { [key: string]: string } = {};
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          // Global app preferences (not user-specific)
          key === 'theme' ||
          key === 'cookie-consent' ||
          key.startsWith('app-preference-') ||
          key.includes('global-settings') ||
          key === 'language-preference' // Keep global language choice
        )) {
          const value = localStorage.getItem(key);
          if (value) {
            globalPreferences[key] = value;
          }
        }
      }
      
      // Clear all localStorage and sessionStorage
      localStorage.clear();
      sessionStorage.clear();
      
      // Restore only global preferences (not user-specific data)
      Object.entries(globalPreferences).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
    }
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
