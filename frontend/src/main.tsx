import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SharedAudioProvider } from './contexts/SharedAudioContext';
import { ClerkProvider } from '@clerk/clerk-react';
import { registerSW } from './pwa/registerSW';
import UpdateToast from './pwa/UpdateToast';

// Intercept all relative /api/ fetch calls: rewrite URL + inject Clerk JWT
if (import.meta.env.VITE_API_BASE_URL) {
  const _fetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api')) {
      input = import.meta.env.VITE_API_BASE_URL + input;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const token = await (window as any).Clerk?.session?.getToken?.();
        if (token) {
          init = { ...(init || {}), headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) } };
        }
      } catch { /* no Clerk session yet */ }
    }
    return _fetch(input, init);
  };
}

// Patch <img src="/api/..."> and CSS background-image to point to Railway
if (import.meta.env.VITE_API_BASE_URL) {
  const BASE = import.meta.env.VITE_API_BASE_URL;
  const patchEl = (el: Element) => {
    const tag = el.tagName;
    if (tag === 'IMG' || tag === 'AUDIO' || tag === 'SOURCE') {
      const attr = (el as HTMLElement).getAttribute('src') || '';
      if (attr.startsWith('/api')) (el as HTMLElement).setAttribute('src', BASE + attr);
    }
  };
  const obs = new MutationObserver(muts => {
    for (const m of muts) {
      m.addedNodes.forEach(n => {
        if (n.nodeType === 1) { patchEl(n as Element); (n as Element).querySelectorAll?.('img[src^="/api"],audio[src^="/api"],source[src^="/api"]').forEach(patchEl); }
      });
      if (m.type === 'attributes' && m.target.nodeType === 1) patchEl(m.target as Element);
    }
  });
  // Start observing once DOM is ready
  const startObs = () => obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  if (document.body) startObs(); else document.addEventListener('DOMContentLoaded', startObs);
}

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? '';

// Only mount ClerkProvider when a key is configured. Without it (local dev / E2E),
// render the app directly — useSafeAuth/useSafeUser/useSafeClerk return inert stubs.
const tree = (
  <SharedAudioProvider>
    <App />
    <UpdateToast />
  </SharedAudioProvider>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {PUBLISHABLE_KEY
      ? <ClerkProvider publishableKey={PUBLISHABLE_KEY}>{tree}</ClerkProvider>
      : tree}
  </React.StrictMode>
);

// Register the PWA service worker (production only; no-op otherwise)
registerSW();
