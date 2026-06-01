import { useRef, useState, useCallback } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { PlayIcon, PauseIcon, PrevIcon, NextIcon, ShuffleIcon, LoopIcon } from '../shared/Icons';
import { tapLight, tapMedium, selectionChanged } from '../../../lib/haptics';

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

  // Sheet drag-down-to-dismiss
  const [sheetY, setSheetY] = useState(0);
  const [sheetSettling, setSheetSettling] = useState(false);
  const sheetStart = useRef<{ y: number; active: boolean }>({ y: 0, active: false });

  // Artwork horizontal swipe-to-skip
  const [artX, setArtX] = useState(0);
  const [artSettling, setArtSettling] = useState(false);
  const artStart = useRef<{ x: number; y: number; axis: '' | 'x' | 'y' }>({ x: 0, y: 0, axis: '' });

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

  const close = () => { tapLight(); onClose(); };

  // ── Sheet vertical dismiss (drag from header / handle) ──
  const onSheetTouchStart = (e: React.TouchEvent) => {
    sheetStart.current = { y: e.touches[0].clientY, active: true };
    setSheetSettling(false);
  };
  const onSheetTouchMove = (e: React.TouchEvent) => {
    if (!sheetStart.current.active) return;
    const dy = e.touches[0].clientY - sheetStart.current.y;
    setSheetY(Math.max(0, dy));
  };
  const onSheetTouchEnd = () => {
    if (!sheetStart.current.active) return;
    sheetStart.current.active = false;
    setSheetSettling(true);
    if (sheetY > 110) { tapLight(); onClose(); }
    setSheetY(0);
  };

  // ── Artwork horizontal skip ──
  const onArtTouchStart = (e: React.TouchEvent) => {
    artStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, axis: '' };
    setArtSettling(false);
  };
  const onArtTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - artStart.current.x;
    const dy = e.touches[0].clientY - artStart.current.y;
    if (artStart.current.axis === '') artStart.current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (artStart.current.axis === 'x') { e.stopPropagation(); setArtX(dx); }
  };
  const onArtTouchEnd = () => {
    if (artStart.current.axis === 'x') {
      setArtSettling(true);
      if (artX <= -70) { tapMedium(); playNext(); }
      else if (artX >= 70) { tapMedium(); playPrev(); }
      setArtX(0);
    }
    artStart.current.axis = '';
  };

  const dismissProgress = Math.min(1, sheetY / 300);
  const title = playerTrack ? (playerTrack.title || `Track v${playerTrack.version}`) : 'Nothing playing';
  const artist = playerTrack ? (playerTrack.artist || 'RedInside Studio') : '';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        display: 'flex', flexDirection: 'column',
        background: '#08020a',
        paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        paddingTop: 'env(safe-area-inset-top, 16px)',
        transform: `translateY(${sheetY}px)`,
        transition: sheetSettling ? 'transform 300ms cubic-bezier(0.22,1,0.36,1)' : 'none',
        borderRadius: sheetY > 0 ? '24px 24px 0 0' : 0,
        overflow: 'hidden',
        opacity: 1 - dismissProgress * 0.2,
        animation: 'ris-player-up 380ms cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      <style>{`
        @keyframes ris-player-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes ris-art-in { from { opacity: 0; transform: scale(1.08); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      {/* ── Ambient backdrop: blurred artwork + scrim ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
        {artworkUrl && (
          <img
            src={artworkUrl}
            alt=""
            style={{
              position: 'absolute', inset: '-15%', width: '130%', height: '130%',
              objectFit: 'cover', filter: 'blur(64px) saturate(1.6) brightness(0.55)',
              transform: 'scale(1.1)', transition: 'opacity 600ms',
            }}
          />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: artworkUrl
            ? 'linear-gradient(180deg, rgba(8,2,10,0.35) 0%, rgba(8,2,10,0.55) 45%, rgba(8,2,10,0.92) 100%)'
            : 'linear-gradient(165deg, #2a0810 0%, #12040a 45%, #08020a 100%)',
        }} />
      </div>

      {/* ── Foreground content ── */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Grab handle + header (drag to dismiss) */}
        <div onTouchStart={onSheetTouchStart} onTouchMove={onSheetTouchMove} onTouchEnd={onSheetTouchEnd} style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '10px' }}>
            <div style={{ width: '36px', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.3)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 0' }}>
            <button onClick={close} style={iconBtn}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>Now Playing</span>
            <button style={iconBtn}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            </button>
          </div>
        </div>

        {/* Artwork — fills available space, scales/dims when paused */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 28px', minHeight: 0 }}>
          <div
            onTouchStart={onArtTouchStart}
            onTouchMove={onArtTouchMove}
            onTouchEnd={onArtTouchEnd}
            style={{
              width: 'min(78vw, 360px)', aspectRatio: '1 / 1', maxHeight: '100%',
              borderRadius: '18px', overflow: 'hidden', flexShrink: 0,
              background: `linear-gradient(135deg, ${C.redDark}, #080108)`,
              boxShadow: playerIsPlaying
                ? `0 24px 80px rgba(0,0,0,0.6), 0 0 60px ${C.red}33`
                : '0 12px 40px rgba(0,0,0,0.6)',
              transform: `translateX(${artX}px) rotate(${artX * 0.015}deg) scale(${playerIsPlaying ? 1 : 0.86})`,
              transition: artSettling
                ? 'transform 320ms cubic-bezier(0.22,1,0.36,1), box-shadow 500ms'
                : 'transform 420ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 500ms',
              touchAction: 'pan-y',
              filter: playerIsPlaying ? 'none' : 'brightness(0.8)',
              animation: 'ris-art-in 500ms ease',
            }}
          >
            {artworkUrl ? (
              <img src={artworkUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="72" height="72" viewBox="0 0 64 64" fill="none">
                  <circle cx="32" cy="32" r="28" stroke={C.red} strokeWidth="2" opacity="0.6"/>
                  <circle cx="32" cy="32" r="10" fill={C.red} opacity="0.4"/>
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Title + artist + like */}
        <div style={{ flexShrink: 0, padding: '0 28px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </div>
            <div style={{ fontSize: '15px', color: C.red, fontWeight: 500, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {artist}
            </div>
          </div>
          <button style={{ ...iconBtn, width: 40, height: 40 }} onClick={() => tapLight()}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"/></svg>
          </button>
        </div>

        {/* Scrubber */}
        <div style={{ flexShrink: 0, padding: '20px 28px 4px' }}>
          <div
            ref={barRef}
            style={{ position: 'relative', height: '28px', display: 'flex', alignItems: 'center', cursor: 'pointer', touchAction: 'none' }}
            onMouseDown={e => { isDragging.current = true; setDragProgress(getFrac(e.clientX)); }}
            onMouseMove={e => { if (isDragging.current) setDragProgress(getFrac(e.clientX)); }}
            onMouseUp={e => { if (isDragging.current) { seekTo(getFrac(e.clientX)); isDragging.current = false; setDragProgress(null); } }}
            onTouchStart={e => { isDragging.current = true; setDragProgress(getFrac(e.touches[0].clientX)); }}
            onTouchMove={e => { if (isDragging.current) { e.stopPropagation(); setDragProgress(getFrac(e.touches[0].clientX)); } }}
            onTouchEnd={e => { if (isDragging.current) { seekTo(getFrac(e.changedTouches[0].clientX)); isDragging.current = false; setDragProgress(null); tapLight(); } }}
          >
            <div style={{ position: 'absolute', left: 0, right: 0, height: dragProgress !== null ? '7px' : '5px', background: 'rgba(255,255,255,0.18)', borderRadius: '4px', transition: 'height 140ms' }}>
              <div style={{ height: '100%', width: `${displayFraction * 100}%`, background: `linear-gradient(90deg, ${C.red}, #ff5a6a)`, borderRadius: '4px' }} />
            </div>
            <div style={{
              position: 'absolute', top: '50%', left: `${displayFraction * 100}%`,
              transform: `translateX(-50%) translateY(-50%) scale(${dragProgress !== null ? 1 : 0})`,
              width: '15px', height: '15px', background: '#fff', borderRadius: '50%',
              boxShadow: `0 0 10px ${C.red}aa`, transition: 'transform 140ms',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '6px', fontVariantNumeric: 'tabular-nums' }}>
            <span>{fmtTime(playerCurrentTime)}</span>
            <span>-{fmtTime(Math.max(0, playerDuration - playerCurrentTime))}</span>
          </div>
        </div>

        {/* Transport */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 28px 16px' }}>
          <button onClick={() => { selectionChanged(); toggleShuffle(); }} style={{ ...iconBtn, color: isShuffled ? C.red : 'rgba(255,255,255,0.55)' }}>
            <ShuffleIcon size={22} />
          </button>
          <button onClick={() => { tapLight(); playPrev(); }} style={{ ...iconBtn, width: 56, height: 56, color: '#fff' }}>
            <PrevIcon size={32} />
          </button>
          <button
            onClick={() => { tapMedium(); togglePlay(); }}
            style={{
              background: `radial-gradient(circle at 35% 30%, #ff5663, ${C.red} 70%)`,
              border: 'none', cursor: 'pointer',
              width: '74px', height: '74px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff',
              boxShadow: `0 8px 28px ${C.red}66, inset 0 1px 1px rgba(255,255,255,0.4)`,
              transition: 'transform 120ms',
            }}
            onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.93)'; }}
            onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
          >
            {playerIsPlaying ? <PauseIcon size={28} /> : <span style={{ marginLeft: '4px' }}><PlayIcon size={28} /></span>}
          </button>
          <button onClick={() => { tapLight(); playNext(); }} style={{ ...iconBtn, width: 56, height: 56, color: '#fff' }}>
            <NextIcon size={32} />
          </button>
          <button onClick={() => { selectionChanged(); toggleLoop(); }} style={{ ...iconBtn, color: isLooping ? C.red : 'rgba(255,255,255,0.55)' }}>
            <LoopIcon size={22} />
          </button>
        </div>

        {/* Volume */}
        <div style={{ flexShrink: 0, padding: '0 28px 8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg>
          <input
            type="range" min={0} max={1} step={0.01} value={playerVolume}
            onChange={e => setPlayerVolume(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: C.red, height: '4px' }}
          />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 00-2.5-4v8a4.5 4.5 0 002.5-4zM14 3.2v2.1a7 7 0 010 13.4v2.1a9 9 0 000-17.6z"/></svg>
        </div>
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  minWidth: '44px', minHeight: '44px', padding: '8px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
