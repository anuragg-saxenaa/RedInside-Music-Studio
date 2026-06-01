import { useEffect, useState } from 'react';

// Slim banner shown when the device goes offline. Downloaded tracks still play;
// this just sets expectations (Spotify-style "No internet connection").
export default function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  if (online) return null;
  return (
    <div style={{
      flexShrink: 0,
      background: 'linear-gradient(90deg, #3a1a00, #2a1200)',
      color: '#ffc38a',
      fontSize: '12px', fontWeight: 600,
      padding: '6px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      borderBottom: '1px solid rgba(255,180,100,0.2)',
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffc38a" strokeWidth="2" strokeLinecap="round">
        <path d="M1 1l22 22M16.7 16.7A6 6 0 008 17M12 20h.01M5 12.6a10 10 0 015.5-2.6M2 8.8a14 14 0 014.7-2.9M19.8 11.9A10 10 0 0017 9.9"/>
      </svg>
      Offline — playing downloaded tracks only
    </div>
  );
}
