import { useRef, useState, useCallback } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';

function fmtTime(s: number) {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

interface Props {
  onClose: () => void;
}

export default function MobilePlayerFull({ onClose }: Props) {
  const {
    playerTrack, playerIsPlaying, playerProgress, playerCurrentTime, playerDuration, playerVolume,
    togglePlay, seekTo, setPlayerVolume, playNext, playPrev,
    isLooping, isShuffled, toggleLoop, toggleShuffle,
  } = useWorkspace();

  const isDragging = useRef(false);
  const [dragProgress, setDragProgress] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const getFrac = useCallback((clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const displayFraction = dragProgress !== null ? dragProgress : playerProgress;
  const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

  const artworkUrl = playerTrack?.artwork_url
    ? (playerTrack.artwork_url.startsWith('http') ? playerTrack.artwork_url : `${API_BASE}/api/projects/${playerTrack.project_id}/artwork/${playerTrack.id}`)
    : null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'linear-gradient(180deg, #1a0408 0%, #08020a 60%)',
      display: 'flex', flexDirection: 'column',
      padding: 'env(safe-area-inset-top, 20px) 0 env(safe-area-inset-bottom, 20px)',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px 0' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '8px', fontSize: '20px' }}>
          ⌃
        </button>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Now Playing</span>
        <div style={{ width: 36 }} />
      </div>

      {/* Artwork */}
      <div style={{ flex: '0 0 auto', padding: '32px 32px 24px', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: 'min(calc(100vw - 64px), 320px)',
          height: 'min(calc(100vw - 64px), 320px)',
          borderRadius: '16px',
          background: `linear-gradient(135deg, ${C.redDark}, #080108)`,
          border: `1px solid ${C.borderActive}`,
          overflow: 'hidden',
          boxShadow: playerIsPlaying ? `0 16px 64px ${C.red}44` : '0 8px 32px rgba(0,0,0,0.6)',
          transition: 'box-shadow 400ms',
          flexShrink: 0,
        }}>
          {artworkUrl ? (
            <img src={artworkUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="28" stroke={C.red} strokeWidth="2" opacity="0.6"/>
                <circle cx="32" cy="32" r="10" fill={C.red} opacity="0.4"/>
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Title & Artist */}
      <div style={{ padding: '0 32px 24px' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: C.text, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {playerTrack ? (playerTrack.title || `Track v${playerTrack.version}`) : 'Nothing playing'}
        </div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)' }}>
          {playerTrack ? (playerTrack.artist || 'RedInside Studio') : ''}
        </div>
      </div>

      {/* Scrubber */}
      <div style={{ padding: '0 32px 8px' }}>
        <div
          ref={barRef}
          style={{ position: 'relative', height: '36px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          onMouseDown={e => {
            isDragging.current = true;
            const f = getFrac(e.clientX);
            setDragProgress(f);
          }}
          onMouseMove={e => { if (isDragging.current) setDragProgress(getFrac(e.clientX)); }}
          onMouseUp={e => {
            if (isDragging.current) { seekTo(getFrac(e.clientX)); isDragging.current = false; setDragProgress(null); }
          }}
          onTouchStart={e => {
            isDragging.current = true;
            setDragProgress(getFrac(e.touches[0].clientX));
          }}
          onTouchMove={e => { if (isDragging.current) setDragProgress(getFrac(e.touches[0].clientX)); }}
          onTouchEnd={e => {
            if (isDragging.current) {
              seekTo(getFrac(e.changedTouches[0].clientX));
              isDragging.current = false; setDragProgress(null);
            }
          }}
        >
          <div style={{ position: 'absolute', left: 0, right: 0, height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px' }}>
            <div style={{ height: '100%', width: `${displayFraction * 100}%`, background: C.red, borderRadius: '2px' }} />
          </div>
          <div style={{
            position: 'absolute', top: '50%', transform: `translateX(-50%) translateY(-50%)`,
            left: `${displayFraction * 100}%`, width: '16px', height: '16px',
            background: '#fff', borderRadius: '50%', boxShadow: `0 0 8px ${C.red}88`,
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
          <span>{fmtTime(playerCurrentTime)}</span>
          <span>{fmtTime(playerDuration)}</span>
        </div>
      </div>

      {/* Transport Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 24px 24px' }}>
        {/* Shuffle */}
        <button onClick={toggleShuffle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isShuffled ? C.red : 'rgba(255,255,255,0.4)', fontSize: '20px', padding: '8px', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ⇄
        </button>
        {/* Prev */}
        <button onClick={playPrev} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: '28px', padding: '8px', minWidth: '56px', minHeight: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ⏮
        </button>
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          style={{
            background: C.red, border: 'none', cursor: 'pointer',
            width: '64px', height: '64px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', color: '#fff',
            boxShadow: `0 4px 24px ${C.red}66`,
          }}
        >
          {playerIsPlaying ? '⏸' : '▶'}
        </button>
        {/* Next */}
        <button onClick={playNext} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: '28px', padding: '8px', minWidth: '56px', minHeight: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ⏭
        </button>
        {/* Loop */}
        <button onClick={toggleLoop} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isLooping ? C.red : 'rgba(255,255,255,0.4)', fontSize: '20px', padding: '8px', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ↺
        </button>
      </div>

      {/* Volume */}
      <div style={{ padding: '0 32px 32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>🔈</span>
        <input
          type="range" min={0} max={1} step={0.01} value={playerVolume}
          onChange={e => setPlayerVolume(parseFloat(e.target.value))}
          style={{ flex: 1, accentColor: C.red, height: '4px' }}
        />
        <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>🔊</span>
      </div>
    </div>
  );
}
