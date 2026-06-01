import { useState, useEffect } from 'react';
import { useSafeAuth, CLERK_ON } from './lib/clerkSafe';
import { rememberSignedIn, wasSignedIn, isOnline } from './pwa/offlineAuth';
import History from './pages/History';
import ViralToolkit from './pages/ViralToolkit';
import Settings from './pages/Settings';
import StudioV4 from './pages/StudioV4';
import ShareView from './pages/ShareView';
import Login from './pages/Login';
import type { Project, LyricsGeneration, MusicGeneration } from './types';
import { SharedAudioProvider } from './contexts/SharedAudioContext';

// Re-export for backwards compatibility
export type { Project, LyricsGeneration, MusicGeneration };

function App() {
  const { isSignedIn, isLoaded } = useSafeAuth();

  const [currentView, setCurrentView] = useState<'studio' | 'history' | 'viral' | 'settings' | 'share' | 'login'>(() => {
    if (window.location.hash.startsWith('#/share/')) return 'share';
    if (window.location.hash === '#/login') return 'login';
    if (window.location.hash === '#/history') return 'history';
    if (window.location.hash === '#/viral') return 'viral';
    if (window.location.hash === '#/settings') return 'settings';
    return 'studio';
  });

  const [shareToken, setShareToken] = useState<string>(() => {
    const match = window.location.hash.match(/^#\/share\/(.+)$/);
    return match ? match[1] : '';
  });

  // Force studio view when signed in — handles post-sign-in redirect where hash doesn't change
  useEffect(() => {
    if (isSignedIn && currentView === 'login') {
      setCurrentView('studio');
    }
    if (isSignedIn) rememberSignedIn();
  }, [isSignedIn, currentView]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#/history') setCurrentView('history');
      else if (hash === '#/viral') setCurrentView('viral');
      else if (hash === '#/settings') setCurrentView('settings');
      else if (hash === '#/login') setCurrentView('login');
      else if (hash.startsWith('#/share/')) {
        const match = hash.match(/^#\/share\/(.+)$/);
        if (match) { setShareToken(match[1]); setCurrentView('share'); }
      }
      else setCurrentView('studio');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // No Clerk configured → skip auth entirely (local dev / E2E)
  if (CLERK_ON) {
    // Offline (or auth server unreachable) + previously signed in → open straight
    // to the app so downloaded tracks remain playable without a network round-trip.
    const offlineBypass = !isOnline() && wasSignedIn();

    if (!isLoaded && !offlineBypass) return null;

    if (!offlineBypass && !isSignedIn && currentView !== 'share' && currentView !== 'login') {
      return <Login />;
    }

    if (currentView === 'login' && !offlineBypass) return <Login />;
  }

  // StudioV4 is a full-viewport DAW — render it directly, no wrapper
  if (currentView === 'share') {
    return (
      <SharedAudioProvider>
        <ShareView token={shareToken} />
      </SharedAudioProvider>
    );
  }

  if (currentView === 'studio') {
    return (
      <SharedAudioProvider>
        <StudioV4 />
      </SharedAudioProvider>
    );
  }

  // Legacy pages (history/viral/settings) keep the old branded shell
  return (
    <SharedAudioProvider>
    <div style={{ backgroundColor: '#0A0A0A', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif', position: 'relative', overflow: 'hidden' }}>
      <header style={{
        backgroundColor: 'rgba(10, 10, 10, 0.9)',
        borderBottom: '1px solid rgba(230, 57, 70, 0.3)',
        padding: '20px 32px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(20px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <h1 style={{
          color: '#E63946',
          fontSize: '22px',
          fontWeight: 700,
          fontFamily: 'Outfit, sans-serif',
          letterSpacing: '-0.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="#E63946" strokeWidth="2"/>
            <path d="M10 8L20 14L10 20V8Z" fill="#E63946"/>
          </svg>
          RedInside <span style={{ color: '#FFFFFF' }}>Music Studio</span>
        </h1>
        <nav style={{ display: 'flex', gap: '16px' }}>
          <a href="#/" style={{ color: '#A0A0A0', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>Studio</a>
          <a href="#/history" style={{ color: currentView === 'history' ? '#E63946' : '#A0A0A0', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>History</a>
          <a href="#/viral" style={{ color: currentView === 'viral' ? '#E63946' : '#A0A0A0', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>Viral</a>
          <a href="#/settings" style={{ color: currentView === 'settings' ? '#E63946' : '#A0A0A0', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>Settings</a>
        </nav>
      </header>
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px', position: 'relative', zIndex: 1 }}>
        {currentView === 'history' ? <History /> : currentView === 'viral' ? <ViralToolkit /> : <Settings />}
      </main>
    </div>
    </SharedAudioProvider>
  );
}

export default App;
