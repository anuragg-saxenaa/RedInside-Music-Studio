// Remembers whether the user has signed in before, so an offline launch (or an
// unreachable auth server) can open straight to downloads instead of blocking.
const KEY = 'ris_was_signed_in';

export function rememberSignedIn(): void {
  try { localStorage.setItem(KEY, '1'); } catch { /* quota */ }
}

export function wasSignedIn(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}
