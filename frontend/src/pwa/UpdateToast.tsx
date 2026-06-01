import { useEffect, useState } from 'react';

// Shows a "new version available" toast when the service worker reports an update.
export default function UpdateToast() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const h = () => setShow(true);
    window.addEventListener('ris-sw-update', h);
    return () => window.removeEventListener('ris-sw-update', h);
  }, []);
  if (!show) return null;
  return (
    <div
      role="alert"
      style={{
        position: 'fixed', bottom: 96, left: '50%', transform: 'translateX(-50%)', zIndex: 5000,
        background: 'rgba(26,4,8,0.97)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(230,57,70,0.4)', borderRadius: 12, padding: '10px 16px',
        display: 'flex', gap: 12, alignItems: 'center', color: '#fff', fontSize: 13,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}
    >
      New version available
      <button
        onClick={() => location.reload()}
        style={{ background: '#E63946', border: 'none', borderRadius: 8, color: '#fff', padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
      >
        Reload
      </button>
    </div>
  );
}
