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

// Desktop (Tauri) standalone build runs without Clerk, so there's no live user
// profile. Bake the studio owner's identity at build time (VITE_DESKTOP_USER_*)
// so the UI shows the same name/email as the cloud build instead of "User".
const DESKTOP_USER = import.meta.env.VITE_DESKTOP_USER_EMAIL
  ? {
      fullName: import.meta.env.VITE_DESKTOP_USER_NAME || null,
      username: import.meta.env.VITE_DESKTOP_USER_NAME || null,
      imageUrl: '',
      primaryEmailAddress: { emailAddress: import.meta.env.VITE_DESKTOP_USER_EMAIL },
    }
  : null;

export function useSafeUser() {
  if (CLERK_ON) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useUser();
  }
  return { user: DESKTOP_USER, isLoaded: true, isSignedIn: true };
}

export function useSafeClerk() {
  if (CLERK_ON) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useClerk();
  }
  return { signOut: async () => {} };
}
