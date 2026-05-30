import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SharedAudioProvider } from './contexts/SharedAudioContext';
import { ClerkProvider } from '@clerk/clerk-react';

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
