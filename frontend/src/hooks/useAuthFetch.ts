import { useCallback } from 'react';
import { useSafeAuth } from '../lib/clerkSafe';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// Sends every /api/ call with a real Clerk JWT — the same on web, iOS, and macOS,
// so login (Google + email) is identical across platforms. The old X-Desktop-Token
// bypass is removed; desktop builds now use the real Clerk session.
export function useAuthFetch() {
  const { getToken } = useSafeAuth();

  return useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = await getToken();
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
