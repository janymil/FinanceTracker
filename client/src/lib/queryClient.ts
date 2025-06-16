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
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
    }
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
export const getQueryFn = (options: {
  on401?: "signOut" | "returnNull";
  onError?: (error: any) => void;
} = {}) => async ({ queryKey }: { queryKey: readonly unknown[] }) => {
  const { on401 = "signOut", onError } = options;
  const url = queryKey[0] as string;

  try {
    const response = await fetch(url, {
      credentials: "include",
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Check if this might be a server restart by looking at response headers or timing
        const isServerRestart = !response.headers.get('x-powered-by') || 
                               response.headers.get('connection') === 'close';

        if (on401 === "signOut" && !isServerRestart) {
          // Only force sign out if it's not a server restart
          setTimeout(() => {
            window.location.href = "/auth";
          }, 1000); // Small delay to allow for potential reconnection
          return null;
        } else {
          return null;
        }
      }
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
  } catch (error: any) {
    // Handle network errors that might indicate server restart
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      error.code = 'NETWORK_ERROR';
    }

    if (onError) {
      onError(error);
    }
    throw error;
  }
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 15 * 60 * 1000, // 15 minutes - much more aggressive caching
      gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
      retry: false, // Disable retries for faster loading
      networkMode: 'online',
    },
    mutations: {
      retry: false,
      networkMode: 'online',
    },
  },
});