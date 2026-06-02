import { useRef, useState, useCallback, useEffect } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { PlayIcon, PauseIcon, PrevIcon, NextIcon, ShuffleIcon, LoopIcon } from '../shared/Icons';
import { tapLight, tapMedium, selectionChanged } from '../../../lib/haptics';
import AddToPlaylistSheet from './AddToPlaylistSheet';
import { useAuthFetch } from '../../../hooks/useAuthFetch';

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
    isLiked, toggleLike,
  } = useWorkspace();

  const liked = playerTrack ? isLiked(playerTrack.id) : false;
  const [showAddSheet, setShowAddSheet] = useState(false);
  const authFetch = useAuthFetch();
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  // Fetch lyrics for the current track when the lyrics view is opened.
  useEffect(() => {
    if (!showLyrics || !playerTrack?.lyrics_id) { if (!playerTrack?.lyrics_id) setLyrics(null); return; }
    setLyricsLoading(true); setLyrics(null);
    authFetch(`/api/lyrics/${playerTrack.lyrics_id}`)
      .then(r => r.json())
      .then((d: { content?: string }) => setLyrics(d?.content || ''))
      .catch(() => setLyrics(''))
      .finally(() => setLyricsLoading(false));
  }, [showLyrics, playerTrack?.lyrics_id, authFetch]);

  const rootRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);

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

  const close = () => { tapLight(); onClose(); };

  // ── Unified gesture (direct DOM transforms = no per-frame React render) ──
  const g = useRef({ x0: 0, y0: 0, axis: '' as '' | 'x' | 'y', overArt: false, dx: 0, dy: 0 });

  const pointInArt = (x: number, y: number) => {
    const r = artRef.current?.getBoundingClientRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    g.current = { x0: t.clientX, y0: t.clientY, axis: '', overArt: pointInArt(t.clientX, t.clientY), dx: 0, dy: 0 };
    if (rootRef.current) rootRef.current.style.transition = 'none';
    if (artRef.current) artRef.current.style.transition = 'none';
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const dx = t.clientX - g.current.x0;
    const dy = t.clientY - g.current.y0;
    g.current.dx = dx; g.current.dy = dy;
    if (g.current.axis === '') {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (g.current.axis === 'x' && g.current.overArt) {
      if (artRef.current) artRef.current.style.transform = `translateX(${dx}px) rotate(${dx * 0.015}deg) scale(${playerIsPlaying ? 1 : 0.86})`;
    } else if (g.current.axis === 'y' && dy > 0) {
      if (rootRef.current) {
        rootRef.current.style.transform = `translateY(${dy}px)`;
        rootRef.current.style.borderRadius = '24px 24px 0 0';
        rootRef.current.style.opacity = String(1 - Math.min(1, dy / 300) * 0.2);
      }
    }
  };

  const onTouchEnd = () => {
    const { axis, overArt, dx, dy } = g.current;
    if (axis === 'x' && overArt) {
      if (artRef.current) {
        artRef.current.style.transition = 'transform 320ms cubic-bezier(0.22,1,0.36,1)';
        artRef.current.style.transform = `translateX(0) rotate(0deg) scale(${playerIsPlaying ? 1 : 0.86})`;
      }
      if (dx <= -70) { tapMedium(); playNext(); }
      else if (dx >= 70) { tapMedium(); playPrev(); }
    } else if (axis === 'y' && dy > 0) {
      if (dy > 110) { tapLight(); onClose(); return; }
      if (rootRef.current) {
        rootRef.current.style.transition = 'transform 300ms cubic-bezier(0.22,1,0.36,1), opacity 300ms, border-radius 300ms';
        rootRef.current.style.transform = 'translateY(0)';
        rootRef.current.style.opacity = '1';
        rootRef.current.style.borderRadius = '0';
      }
    }
    g.current.axis = '';
  };

  const title = playerTrack ? (playerTrack.title || `Track v${playerTrack.version}`) : 'Nothing playing';
  const artist = playerTrack ? (playerTrack.artist || 'RedInside Studio') : '';

  return (
    <div
      ref={rootRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        display: 'flex', flexDirection: 'column',
        background: '#08020a',
        paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        paddingTop: 'env(safe-area-inset-top, 16px)',
        overflow: 'hidden',
        animation: 'ris-player-up 380ms cubic-bezier(0.22,1,0.36,1)',
        willChange: 'transform',
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
              transform: 'scale(1.1)',
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

      {/* ── Foreground ── */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Grab handle + header */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '10px' }}>
            <div style={{ width: '36px', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.3)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 0' }}>
            <button onClick={close} style={iconBtn}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>Now Playing</span>
            <button style={iconBtn} aria-label="Add to playlist" onClick={() => { if (playerTrack) { tapLight(); setShowAddSheet(true); } }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
            </button>
          </div>
        </div>

        {/* Lyrics view (replaces artwork when toggled) */}
        {showLyrics ? (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 30px 20px', WebkitOverflowScrolling: 'touch' }}>
            {lyricsLoading && <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingTop: 40, fontSize: 14 }}>Loading lyrics…</div>}
            {!lyricsLoading && (!lyrics || !lyrics.trim()) && (
              <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingTop: 40, fontSize: 14 }}>No lyrics for this track.</div>
            )}
            {!lyricsLoading && lyrics && lyrics.trim() && (
              <div style={{ fontSize: 21, lineHeight: 1.65, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em', whiteSpace: 'pre-wrap', paddingBottom: 20, animation: 'ris-art-in 400ms ease' }}>
                {lyrics.trim()}
              </div>
            )}
          </div>
        ) : (
        /* Artwork */
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 28px', minHeight: 0 }}>
          <div
            ref={artRef}
            style={{
              width: 'min(78vw, 360px)', aspectRatio: '1 / 1', maxHeight: '100%',
              borderRadius: '18px', overflow: 'hidden', flexShrink: 0,
              background: `linear-gradient(135deg, ${C.redDark}, #080108)`,
              boxShadow: playerIsPlaying
                ? `0 24px 80px rgba(0,0,0,0.6), 0 0 60px ${C.red}33`
                : '0 12px 40px rgba(0,0,0,0.6)',
              transform: `scale(${playerIsPlaying ? 1 : 0.86})`,
              transition: 'transform 420ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 500ms',
              filter: playerIsPlaying ? 'none' : 'brightness(0.8)',
              willChange: 'transform',
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
        )}

        {/* Title + artist + like + lyrics toggle */}
        <div style={{ flexShrink: 0, padding: '0 28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </div>
            <div style={{ fontSize: '15px', color: C.red, fontWeight: 500, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {artist}
            </div>
          </div>
          <button
            style={{ ...iconBtn, width: 40, height: 40, color: showLyrics ? C.red : 'rgba(255,255,255,0.6)' }}
            onClick={() => { tapLight(); setShowLyrics(v => !v); }}
            aria-label="Toggle lyrics"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h10M4 10h16M4 14h10M4 18h16"/></svg>
          </button>
          <button
            style={{ ...iconBtn, width: 40, height: 40 }}
            onClick={() => { if (playerTrack) { tapMedium(); toggleLike(playerTrack); } }}
            aria-label={liked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
          >
            <svg width="25" height="25" viewBox="0 0 24 24"
              fill={liked ? C.red : 'none'}
              stroke={liked ? C.red : 'rgba(255,255,255,0.6)'} strokeWidth="2"
              style={{ transition: 'transform 180ms cubic-bezier(0.34,1.56,0.64,1)', transform: liked ? 'scale(1.12)' : 'scale(1)' }}>
              <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"/>
            </svg>
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
            onTouchStart={e => { e.stopPropagation(); isDragging.current = true; setDragProgress(getFrac(e.touches[0].clientX)); }}
            onTouchMove={e => { if (isDragging.current) { e.stopPropagation(); setDragProgress(getFrac(e.touches[0].clientX)); } }}
            onTouchEnd={e => { if (isDragging.current) { e.stopPropagation(); seekTo(getFrac(e.changedTouches[0].clientX)); isDragging.current = false; setDragProgress(null); tapLight(); } }}
          >
            <div style={{ position: 'absolute', left: 0, right: 0, height: dragProgress !== null ? '7px' : '5px', background: 'rgba(255,255,255,0.18)', borderRadius: '4px', transition: 'height 140ms' }}>
              <div style={{ height: '100%', width: `${displayFraction * 100}%`, background: `linear-gradient(90deg, ${C.red}, #ff5a6a)`, borderRadius: '4px', transition: dragProgress !== null ? 'none' : 'width 0.5s linear' }} />
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
            }}
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
            onTouchStart={e => e.stopPropagation()}
            style={{ flex: 1, accentColor: C.red, height: '4px' }}
          />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 00-2.5-4v8a4.5 4.5 0 002.5-4zM14 3.2v2.1a7 7 0 010 13.4v2.1a9 9 0 000-17.6z"/></svg>
        </div>
      </div>

      {showAddSheet && playerTrack && (
        <AddToPlaylistSheet track={playerTrack} onClose={() => setShowAddSheet(false)} />
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  minWidth: '44px', minHeight: '44px', padding: '8px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
