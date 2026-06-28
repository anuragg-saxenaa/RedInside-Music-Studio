import { SignIn, SignUp, useSignIn } from '@clerk/clerk-react';
import { useState } from 'react';

type Mode = 'signin' | 'signup';

// Custom "Continue with Google" button. Uses authenticateWithRedirect — a FULL-PAGE
// redirect to Google and back, NOT a popup. Popups get blocked by browsers (esp.
// mobile Safari) which is the "blocked popup" the user hit. Redirect never blocks.
function GoogleButton() {
  const { isLoaded, signIn } = useSignIn();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!isLoaded || !signIn || busy) return;
    setBusy(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}/`,
      });
    } catch {
      setBusy(false); // stays on page; user can use email/code below
    }
  };
  return (
    <button onClick={go} disabled={!isLoaded || busy}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        padding: '13px 16px', borderRadius: 12, cursor: busy ? 'default' : 'pointer',
        background: '#fff', border: 'none', color: '#1f1f1f', fontWeight: 600, fontSize: 14,
        fontFamily: "'Outfit', sans-serif", boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        opacity: !isLoaded ? 0.6 : 1, transition: 'transform 120ms',
      }}>
      {busy
        ? <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.25)', borderTopColor: '#1f1f1f', display: 'inline-block', animation: 'ris-glow 0.7s linear infinite' }} />
        : <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>}
      Continue with Google
    </button>
  );
}

export default function Login() {
  const [mode, setMode] = useState<Mode>('signin');

  return (
    <div style={styles.root}>
      {/* Ambient glow */}
      <div style={styles.glow} />

      {/* Header */}
      <div style={styles.header}>
        <svg width="44" height="44" viewBox="0 0 28 28" fill="none" style={{ filter: 'drop-shadow(0 0 12px rgba(230,57,70,0.5))' }}>
          <circle cx="14" cy="14" r="13" stroke="#E63946" strokeWidth="1.5"/>
          <path d="M10 8L20 14L10 20V8Z" fill="#E63946"/>
        </svg>
        <div style={styles.wordmark}>
          <span style={{ color: '#E63946', fontWeight: 700 }}>RedInside</span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 400 }}> Studio</span>
        </div>
      </div>

      <p style={styles.tagline}>Your private music creation studio</p>

      {/* Mode tabs */}
      <div style={styles.tabs}>
        <button
          onClick={() => setMode('signin')}
          style={{
            ...styles.tab,
            ...(mode === 'signin' ? styles.tabActive : styles.tabInactive),
          }}
        >
          Sign in
        </button>
        <button
          onClick={() => setMode('signup')}
          style={{
            ...styles.tab,
            ...(mode === 'signup' ? styles.tabActive : styles.tabInactive),
          }}
        >
          Create account
        </button>
      </div>

      {/* Custom Google button — redirect flow (no popup, never blocked) */}
      <div style={{ ...styles.card, marginBottom: 14 }}>
        <GoogleButton />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 2px 2px' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em' }}>OR EMAIL</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        </div>
      </div>

      {/* Clerk component (email/code; prebuilt social buttons hidden — see appearance) */}
      <div style={styles.card}>
        {mode === 'signin' ? (
          <SignIn
            appearance={{
              variables: {
                colorBackground: 'transparent',
                colorPrimary: '#E63946',
                colorText: '#ffffff',
                colorTextSecondary: 'rgba(255,255,255,0.4)',
                colorInputBackground: 'rgba(255,255,255,0.04)',
                colorBorder: 'rgba(230,57,70,0.2)',
                colorInputText: '#ffffff',
                borderRadius: '12px',
                fontFamily: "'Outfit', sans-serif",
              },
              elements: {
                card: { background: 'transparent', border: 'none', boxShadow: 'none', padding: '0', width: '100%' },
                header: { display: 'none' },
                logoBox: { display: 'none' },
                // Prebuilt social buttons hidden — we use a custom Google button
                // above that does a redirect (no popup, never blocked).
                socialButtons: { display: 'none' },
                socialButtonsBlockButton: { display: 'none' },
                socialButtonsBlockButtonText: { display: 'none' },
                socialButtonsBlockIcon: { display: 'none' },
                dividerRow: { display: 'none' },
                dividerLine: { display: 'none' },
                dividerText: { display: 'none' },
                formButtonPrimary: {
                  background: '#E63946',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '14px',
                  fontFamily: "'Outfit', sans-serif",
                  boxShadow: '0 4px 16px rgba(230,57,70,0.25)',
                  transition: 'all 150ms ease',
                },
                formFieldInput: {
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '14px',
                  transition: 'border-color 150ms ease',
                },
                formFieldLabel: {
                  color: 'rgba(255,255,255,0.45)',
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '12px',
                  fontWeight: 500,
                },
                footer: { display: 'none' },
              },
            }}
            routing="hash"
          />
        ) : (
          <SignUp
            appearance={{
              variables: {
                colorBackground: 'transparent',
                colorPrimary: '#E63946',
                colorText: '#ffffff',
                colorTextSecondary: 'rgba(255,255,255,0.4)',
                colorInputBackground: 'rgba(255,255,255,0.04)',
                colorBorder: 'rgba(230,57,70,0.2)',
                colorInputText: '#ffffff',
                borderRadius: '12px',
                fontFamily: "'Outfit', sans-serif",
              },
              elements: {
                card: { background: 'transparent', border: 'none', boxShadow: 'none', padding: '0', width: '100%' },
                header: { display: 'none' },
                logoBox: { display: 'none' },
                // Prebuilt social buttons hidden — we use a custom Google button
                // above that does a redirect (no popup, never blocked).
                socialButtons: { display: 'none' },
                socialButtonsBlockButton: { display: 'none' },
                socialButtonsBlockButtonText: { display: 'none' },
                socialButtonsBlockIcon: { display: 'none' },
                dividerRow: { display: 'none' },
                dividerLine: { display: 'none' },
                dividerText: { display: 'none' },
                formButtonPrimary: {
                  background: '#E63946',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '14px',
                  fontFamily: "'Outfit', sans-serif",
                  boxShadow: '0 4px 16px rgba(230,57,70,0.25)',
                  transition: 'all 150ms ease',
                },
                formFieldInput: {
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '14px',
                  transition: 'border-color 150ms ease',
                },
                formFieldLabel: {
                  color: 'rgba(255,255,255,0.45)',
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '12px',
                  fontWeight: 500,
                },
                footer: { display: 'none' },
              },
            }}
            routing="hash"
          />
        )}
      </div>

      {/* Invite notice */}
      <p style={styles.inviteNote}>
        Invite-only — access granted by the studio owner
      </p>

      <style>{`
        @keyframes ris-fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ris-glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }
        .ris-clerk-btn:hover {
          background: rgba(255,255,255,0.07) !important;
          border-color: rgba(255,255,255,0.15) !important;
          transform: translateY(-1px);
        }
        .ris-clerk-primary:hover {
          background: #f05060 !important;
          box-shadow: 0 6px 24px rgba(230,57,70,0.35) !important;
        }
        .ris-clerk-input:focus {
          border-color: rgba(230,57,70,0.4) !important;
          outline: none;
          box-shadow: 0 0 0 3px rgba(230,57,70,0.06) !important;
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: '#08020a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Outfit', sans-serif",
    position: 'relative',
    overflow: 'hidden',
    padding: '24px',
  },
  glow: {
    position: 'absolute',
    width: '700px',
    height: '700px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(230,57,70,0.06) 0%, transparent 65%)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    animation: 'ris-glow 6s ease-in-out infinite',
    pointerEvents: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '8px',
    animation: 'ris-fade-up 0.5s ease forwards',
  },
  wordmark: {
    fontSize: '24px',
    fontWeight: 700,
    letterSpacing: '-0.4px',
  },
  tagline: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: '13px',
    marginBottom: '32px',
    animation: 'ris-fade-up 0.5s ease forwards',
    animationDelay: '0.05s',
    opacity: 0,
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px',
    padding: '4px',
    marginBottom: '24px',
    animation: 'ris-fade-up 0.5s ease forwards',
    animationDelay: '0.1s',
    opacity: 0,
  },
  tab: {
    padding: '8px 20px',
    borderRadius: '9px',
    border: 'none',
    cursor: 'pointer',
    fontFamily: "'Outfit', sans-serif",
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 150ms ease',
  },
  tabActive: {
    background: 'rgba(230,57,70,0.15)',
    color: '#E63946',
    border: '1px solid ' + 'rgba(230,57,70,0.25)',
  },
  tabInactive: {
    background: 'transparent',
    color: 'rgba(255,255,255,0.35)',
  },
  card: {
    width: '360px',
    maxWidth: '100%',
    animation: 'ris-fade-up 0.5s ease forwards',
    animationDelay: '0.15s',
    opacity: 0,
  },
  inviteNote: {
    color: 'rgba(255,255,255,0.18)',
    fontSize: '11px',
    marginTop: '24px',
    letterSpacing: '0.03em',
    animation: 'ris-fade-up 0.5s ease forwards',
    animationDelay: '0.25s',
    opacity: 0,
  },
};