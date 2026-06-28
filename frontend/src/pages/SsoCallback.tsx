import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';

// Lands here after Google OAuth redirect (redirectUrl in authenticateWithRedirect).
// Clerk completes the sign-in, then sends the user to '/'. A full-page redirect
// flow — no popup, so nothing for the browser to block.
export default function SsoCallback() {
  return (
    <div style={{
      minHeight: '100vh', background: '#08020a', display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16,
      fontFamily: "'Outfit', sans-serif", color: '#fff',
    }}>
      <span style={{
        width: 30, height: 30, borderRadius: '50%',
        border: '3px solid rgba(230,57,70,0.3)', borderTopColor: '#E63946',
        display: 'inline-block', animation: 'ris-cb-spin 0.7s linear infinite',
      }} />
      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>Signing you in…</span>
      <style>{`@keyframes ris-cb-spin{to{transform:rotate(360deg)}}`}</style>
      <AuthenticateWithRedirectCallback
        signInForceRedirectUrl="/"
        signUpForceRedirectUrl="/"
        signInFallbackRedirectUrl="/"
        signUpFallbackRedirectUrl="/"
      />
    </div>
  );
}
