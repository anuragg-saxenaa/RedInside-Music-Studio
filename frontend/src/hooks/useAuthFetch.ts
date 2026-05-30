import { useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

export function useAuthFetch() {
  const { getToken } = useAuth();

  return useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }, [getToken]);
}
