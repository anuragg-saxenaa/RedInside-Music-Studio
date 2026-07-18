import { useState, useEffect } from 'react';
import { useMobile } from './hooks/useMobile';
import { useSafeAuth, CLERK_ON } from './lib/clerkSafe';
import { rememberSignedIn, wasSignedIn, isOnline } from './pwa/offlineAuth';
import History from './pages/History';
import ViralToolkit from './pages/ViralToolkit';
import Settings from './pages/Settings';
import StudioV4 from './pages/StudioV4';
import ShareView from './pages/ShareView';
import Login from './pages/Login';
import SsoCallback from './pages/SsoCallback';
import type { Project, LyricsGeneration, MusicGeneration } from './types';
import { SharedAudioProvider } from './contexts/SharedAudioContext';

// Re-export for backwards compatibility
export type { Project, LyricsGeneration, MusicGeneration };

function App() {
  const { isSignedIn, isLoaded } = useSafeAuth();
  const isMobile = useMobile();

  // Reactive connectivity so the offline bypass recomputes if the device drops mid-load.
  const [online, setOnline] = useState(isOnline());
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

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

  // Google OAuth redirect lands here (full-page, no popup). Render the Clerk
  // callback handler which completes sign-in then sends the user to '/'.
  if (CLERK_ON && window.location.pathname === '/sso-callback') {
    return <SsoCallback />;
  }

  // No Clerk configured → skip auth entirely (local dev / E2E)
  if (CLERK_ON) {
    // Offline (or auth server unreachable) + previously signed in → open straight
    // to the app so downloaded tracks remain playable without a network round-trip.
    const offlineBypass = !online && wasSignedIn();

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

  // Legacy pages on MOBILE — full-bleed page with a safe-area-aware header and
  // a big obvious back button. (The desktop header hid under the notch and its
  // tiny nav links left users stranded with no visible way back.)
  if (isMobile) {
    const title = currentView === 'history' ? 'History' : currentView === 'viral' ? 'Viral Toolkit' : 'Settings';
    return (
      <SharedAudioProvider>
        <div style={{ backgroundColor: '#0A0A0A', minHeight: '100dvh', fontFamily: 'DM Sans, sans-serif' }}>
          <header style={{
            position: 'sticky', top: 0, zIndex: 100,
            paddingTop: 'env(safe-area-inset-top, 0px)',
            background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center',
          }}>
            <a href="#/" style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#E63946', textDecoration: 'none', fontSize: 17, fontWeight: 500, padding: '12px 12px 12px 8px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
              Studio
            </a>
            <span style={{ flex: 1, textAlign: 'center', color: '#fff', fontSize: 16, fontWeight: 700, marginRight: 92 }}>{title}</span>
          </header>
          <main style={{ padding: '20px 16px calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
            {currentView === 'history' ? <History /> : currentView === 'viral' ? <ViralToolkit /> : <Settings />}
          </main>
        </div>
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
