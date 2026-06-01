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
    setSheetY(Math.max(0, dy)); // only downward
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
    if (artStart.current.axis === '') {
      artStart.current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (artStart.current.axis === 'x') {
      e.stopPropagation();
      setArtX(dx);
    }
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

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'linear-gradient(180deg, #1a0408 0%, #08020a 60%)',
        display: 'flex', flexDirection: 'column',
        padding: 'env(safe-area-inset-top, 20px) 0 env(safe-area-inset-bottom, 20px)',
        overflowY: 'auto',
        transform: `translateY(${sheetY}px)`,
        transition: sheetSettling ? 'transform 280ms cubic-bezier(0.22,1,0.36,1)' : 'none',
        borderRadius: sheetY > 0 ? '20px 20px 0 0' : 0,
        opacity: 1 - dismissProgress * 0.25,
      }}
    >
      {/* Grab handle + Header — drag here to dismiss */}
      <div onTouchStart={onSheetTouchStart} onTouchMove={onSheetTouchMove} onTouchEnd={onSheetTouchEnd}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '8px' }}>
          <div style={{ width: '40px', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.25)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 24px 0' }}>
          <button onClick={close} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '8px', fontSize: '20px' }}>
            ⌄
          </button>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Now Playing</span>
          <div style={{ width: 36 }} />
        </div>
      </div>

      {/* Artwork — swipe left/right to skip */}
      <div style={{ flex: '0 0 auto', padding: '32px 32px 24px', display: 'flex', justifyContent: 'center' }}>
        <div
          onTouchStart={onArtTouchStart}
          onTouchMove={onArtTouchMove}
          onTouchEnd={onArtTouchEnd}
          style={{
            width: 'min(calc(100vw - 64px), 320px)',
            height: 'min(calc(100vw - 64px), 320px)',
            borderRadius: '16px',
            background: `linear-gradient(135deg, ${C.redDark}, #080108)`,
            border: `1px solid ${C.borderActive}`,
            overflow: 'hidden',
            boxShadow: playerIsPlaying ? `0 16px 64px ${C.red}44` : '0 8px 32px rgba(0,0,0,0.6)',
            transform: `translateX(${artX}px) rotate(${artX * 0.02}deg)`,
            transition: artSettling ? 'transform 300ms cubic-bezier(0.22,1,0.36,1), box-shadow 400ms' : 'box-shadow 400ms',
            flexShrink: 0,
            touchAction: 'pan-y',
          }}
        >
          {artworkUrl ? (
            <img src={artworkUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
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
          style={{ position: 'relative', height: '36px', display: 'flex', alignItems: 'center', cursor: 'pointer', touchAction: 'none' }}
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
          onTouchMove={e => { if (isDragging.current) { e.stopPropagation(); setDragProgress(getFrac(e.touches[0].clientX)); } }}
          onTouchEnd={e => {
            if (isDragging.current) {
              seekTo(getFrac(e.changedTouches[0].clientX));
              isDragging.current = false; setDragProgress(null);
              tapLight();
            }
          }}
        >
          <div style={{ position: 'absolute', left: 0, right: 0, height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px' }}>
            <div style={{ height: '100%', width: `${displayFraction * 100}%`, background: C.red, borderRadius: '2px' }} />
          </div>
          <div style={{
            position: 'absolute', top: '50%', transform: `translateX(-50%) translateY(-50%) scale(${dragProgress !== null ? 1.3 : 1})`,
            left: `${displayFraction * 100}%`, width: '16px', height: '16px',
            background: '#fff', borderRadius: '50%', boxShadow: `0 0 8px ${C.red}88`,
            transition: 'transform 120ms',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
          <span>{fmtTime(playerCurrentTime)}</span>
          <span>{fmtTime(playerDuration)}</span>
        </div>
      </div>

      {/* Transport Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 24px 24px' }}>
        <button onClick={() => { selectionChanged(); toggleShuffle(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isShuffled ? C.red : 'rgba(255,255,255,0.5)', padding: '8px', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShuffleIcon size={22} />
        </button>
        <button onClick={() => { tapLight(); playPrev(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.9)', padding: '8px', minWidth: '56px', minHeight: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PrevIcon size={30} />
        </button>
        <button
          onClick={() => { tapMedium(); togglePlay(); }}
          style={{
            background: `linear-gradient(135deg, rgba(255,255,255,0.96), rgba(255,255,255,0.84))`,
            border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
            width: '68px', height: '68px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#0a0a0a',
            boxShadow: `inset 0 1px 2px rgba(255,255,255,0.6), 0 6px 24px rgba(0,0,0,0.5)`,
          }}
        >
          {playerIsPlaying ? <PauseIcon size={26} /> : <span style={{ marginLeft: '3px' }}><PlayIcon size={26} /></span>}
        </button>
        <button onClick={() => { tapLight(); playNext(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.9)', padding: '8px', minWidth: '56px', minHeight: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <NextIcon size={30} />
        </button>
        <button onClick={() => { selectionChanged(); toggleLoop(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isLooping ? C.red : 'rgba(255,255,255,0.5)', padding: '8px', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LoopIcon size={22} />
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
