// Safe Clerk wrappers. When no VITE_CLERK_PUBLISHABLE_KEY is configured
// (local dev / E2E / test), Clerk is NOT mounted and these return inert stubs
// so the app renders without an auth provider. CLERK_ON is a build-time
// constant — the hook branch is stable across the app's lifetime (hook-safe).
import { useAuth, useUser, useClerk } from '@clerk/clerk-react';

// Native builds (Tauri desktop / Capacitor iOS) run in a webview whose origin is
// tauri://localhost or capacitor:// — NOT http/https. Clerk's OAuth redirect flow
// rejects those schemes ("Invalid URL scheme"), so interactive Google login can't
// run inside an embedded native webview. Native therefore uses the baked studio
// token (auto-auth) and does NOT mount Clerk. Web (no VITE_NATIVE/VITE_TAURI) gets
// the full Clerk Google + email login.
export const IS_NATIVE = !!(import.meta.env.VITE_NATIVE || import.meta.env.VITE_TAURI);

// Clerk is active only on the web build — has a key AND is not a native build.
export const CLERK_ON = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY && !IS_NATIVE;

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
