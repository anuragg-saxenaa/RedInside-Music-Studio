import { SignIn, SignUp } from '@clerk/clerk-react';
import { useState } from 'react';

type Mode = 'signin' | 'signup';

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

      {/* Clerk component */}
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
                socialButtonsBlockButton: {
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '14px',
                  fontWeight: 500,
                  transition: 'all 150ms ease',
                },
                socialButtonsBlockButtonText: { color: '#ffffff', fontFamily: "'Outfit', sans-serif" },
                socialButtonsBlockIcon: { display: 'none' },
                dividerLine: { background: 'rgba(255,255,255,0.05)' },
                dividerText: { color: 'rgba(255,255,255,0.18)', fontFamily: "'Outfit', sans-serif", fontSize: '12px' },
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
                socialButtonsBlockButton: {
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '14px',
                  fontWeight: 500,
                  transition: 'all 150ms ease',
                },
                socialButtonsBlockButtonText: { color: '#ffffff', fontFamily: "'Outfit', sans-serif" },
                socialButtonsBlockIcon: { display: 'none' },
                dividerLine: { background: 'rgba(255,255,255,0.05)' },
                dividerText: { color: 'rgba(255,255,255,0.18)', fontFamily: "'Outfit', sans-serif", fontSize: '12px' },
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