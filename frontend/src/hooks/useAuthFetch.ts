import { useCallback } from 'react';
import { useSafeAuth } from '../lib/clerkSafe';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function useAuthFetch() {
  const { getToken } = useSafeAuth();

  return useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = await getToken();
    // Prefix relative /api/ URLs with API_BASE in production
    const fullUrl = (url.startsWith('/api/') && API_BASE) ? `${API_BASE}${url}` : url;
    return fetch(fullUrl, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }, [getToken]);
}
