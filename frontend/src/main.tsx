import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SharedAudioProvider } from './contexts/SharedAudioContext';
import { DownloadsProvider } from './contexts/DownloadsContext';
import { ClerkProvider } from '@clerk/clerk-react';
import { registerSW } from './pwa/registerSW';
import UpdateToast from './pwa/UpdateToast';
import ErrorBoundary from './components/ErrorBoundary';

// Intercept all relative /api/ fetch calls: rewrite URL + inject Clerk JWT
if (import.meta.env.VITE_API_BASE_URL) {
  const _fetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api')) {
      input = import.meta.env.VITE_API_BASE_URL + input;
      // Native (Tauri/Capacitor) authenticates with the baked studio token —
      // Clerk's redirect OAuth can't run in a native webview (non-http origin).
      // Web sends a real Clerk JWT below.
      const desktopToken = import.meta.env.VITE_DESKTOP_TOKEN;
      if (desktopToken) {
        init = { ...(init || {}), headers: { 'X-Desktop-Token': desktopToken, ...(init?.headers || {}) } };
      }
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

// Native builds (Tauri/Capacitor) must NOT mount Clerk — its OAuth can't run in a
// non-http webview origin. They auto-auth with the baked token. Web mounts Clerk.
const IS_NATIVE = !!(import.meta.env.VITE_NATIVE || import.meta.env.VITE_TAURI);
const PUBLISHABLE_KEY = (!IS_NATIVE && import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) || '';

const tree = (
  <ErrorBoundary>
    <SharedAudioProvider>
      <DownloadsProvider>
        <App />
        <UpdateToast />
      </DownloadsProvider>
    </SharedAudioProvider>
  </ErrorBoundary>
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
