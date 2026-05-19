import { useState, useEffect } from 'react';
import { C } from '../components/v4/shared/colors';
import type { Project, MusicGeneration } from '../types';

interface ShareData {
  project: Project;
  music: MusicGeneration[];
  expiresAt: string;
}

interface ShareViewProps {
  token: string;
}

export default function ShareView({ token }: ShareViewProps) {
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then(r => r.ok ? r.json() : r.json().then((e: { error?: string }) => { throw new Error(e.error ?? 'Not found'); }))
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [token]);

  const playTrack = (id: string) => {
    const audio = new Audio(`/api/music/${id}/file`);
    audio.play().catch(() => {});
    setPlayingId(id);
    audio.addEventListener('ended', () => setPlayingId(null));
  };

  if (error) {
    return (
      <div style={{ background: C.bgApp, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔗</div>
          <div style={{ color: C.text, fontSize: '18px', fontWeight: 600 }}>Share link not found or expired</div>
          <div style={{ color: C.textDim, fontSize: '13px', marginTop: '8px' }}>{error}</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ background: C.bgApp, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.textDim }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bgApp, minHeight: '100vh', padding: '40px 24px', fontFamily: "'SF Pro Text', Inter, sans-serif", color: C.text }} data-testid="share-view">
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke={C.red} strokeWidth="2"/>
            <path d="M10 8L20 14L10 20V8Z" fill={C.red}/>
          </svg>
          <div>
            <div style={{ color: C.text, fontSize: '20px', fontWeight: 700 }}>{data.project.name}</div>
            <div style={{ color: C.textDim, fontSize: '12px' }}>Shared via RedInside Music Studio · Read-only</div>
          </div>
        </div>

        {/* Track list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {data.music.length === 0 && (
            <div style={{ color: C.textDim, textAlign: 'center', padding: '32px' }}>No tracks in this project</div>
          )}
          {data.music.map(track => (
            <div
              key={track.id}
              data-testid={`share-track-${track.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(18px)',
                border: `1px solid ${C.border}`, borderRadius: '10px', padding: '12px 16px',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ color: C.text, fontSize: '14px', fontWeight: 500 }}>{track.title || `Track v${track.version}`}</div>
                {track.duration_seconds != null && (
                  <div style={{ color: C.textDim, fontSize: '11px', marginTop: '2px' }}>
                    {Math.floor(track.duration_seconds / 60)}:{String(Math.floor(track.duration_seconds % 60)).padStart(2, '0')}
                  </div>
                )}
              </div>
              <button
                onClick={() => playTrack(track.id)}
                style={{
                  width: '36px', height: '36px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: playingId === track.id ? C.red : 'rgba(255,255,255,0.12)', color: '#fff', fontSize: '12px',
                }}
              >{playingId === track.id ? '⏸' : '▶'}</button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '24px', color: C.textDim, fontSize: '11px', textAlign: 'center' }}>
          Expires {new Date(data.expiresAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
