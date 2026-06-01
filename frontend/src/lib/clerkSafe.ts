// Safe Clerk wrappers. When no VITE_CLERK_PUBLISHABLE_KEY is configured
// (local dev / E2E / test), Clerk is NOT mounted and these return inert stubs
// so the app renders without an auth provider. CLERK_ON is a build-time
// constant — the hook branch is stable across the app's lifetime (hook-safe).
import { useAuth, useUser, useClerk } from '@clerk/clerk-react';

export const CLERK_ON = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export function useSafeAuth() {
  if (CLERK_ON) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useAuth();
  }
  return {
    isSignedIn: true,
    isLoaded: true,
    getToken: async () => null as string | null,
  };
}

export function useSafeUser() {
  if (CLERK_ON) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useUser();
  }
  return { user: null, isLoaded: true, isSignedIn: true };
}

export function useSafeClerk() {
  if (CLERK_ON) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useClerk();
  }
  return { signOut: async () => {} };
}
