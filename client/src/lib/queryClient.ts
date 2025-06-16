import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
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
