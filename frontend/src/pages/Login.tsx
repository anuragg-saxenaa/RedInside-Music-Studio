import { SignIn } from '@clerk/clerk-react';

export default function Login() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#08020a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Outfit', sans-serif",
    }}>
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="13" stroke="#E63946" strokeWidth="2"/>
          <path d="M10 8L20 14L10 20V8Z" fill="#E63946"/>
        </svg>
        <span style={{ color: '#E63946', fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px' }}>
          RedInside <span style={{ color: '#fff' }}>Studio</span>
        </span>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', marginBottom: '24px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Invite-only platform
      </p>

      <SignIn
        appearance={{
          variables: {
            colorBackground: 'rgba(18,6,22,0.95)',
            colorPrimary: '#E63946',
            colorText: '#ffffff',
            colorTextSecondary: 'rgba(255,255,255,0.5)',
            colorInputBackground: 'rgba(255,255,255,0.05)',
            colorInputText: '#ffffff',
            borderRadius: '12px',
            fontFamily: "'Outfit', sans-serif",
          },
          elements: {
            card: {
              border: '1px solid rgba(230,57,70,0.25)',
              boxShadow: '0 8px 40px rgba(230,57,70,0.08)',
              backdropFilter: 'blur(20px)',
            },
            headerTitle: { color: '#ffffff', fontWeight: 700 },
            socialButtonsBlockButton: {
              border: '1px solid rgba(230,57,70,0.3)',
              background: 'rgba(230,57,70,0.08)',
              color: '#ffffff',
            },
            formButtonPrimary: { background: '#E63946', fontWeight: 700 },
            footerAction: { display: 'none' },
          },
        }}
        routing="hash"
        signUpUrl="#/login"
      />
    </div>
  );
}
