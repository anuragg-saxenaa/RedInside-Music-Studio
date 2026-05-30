import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SharedAudioProvider } from './contexts/SharedAudioContext';
import { ClerkProvider } from '@clerk/clerk-react';

// Intercept all relative /api/ fetch calls and route them to the backend
if (import.meta.env.VITE_API_BASE_URL) {
  const _fetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api')) {
      input = import.meta.env.VITE_API_BASE_URL + input;
    }
    return _fetch(input, init);
  };
}

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? '';
// In dev without Clerk configured, app still renders (backend falls back to 'admin')
if (!PUBLISHABLE_KEY && import.meta.env.DEV) {
  console.warn('[Clerk] VITE_CLERK_PUBLISHABLE_KEY not set — running without auth');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <SharedAudioProvider>
        <App />
      </SharedAudioProvider>
    </ClerkProvider>
  </React.StrictMode>
);
