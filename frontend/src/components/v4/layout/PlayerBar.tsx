import { useState, useRef, useEffect, useCallback } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { useAuthFetch } from '../../../hooks/useAuthFetch';

function fmtTime(s: number) {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const btnBase: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '6px',
  borderRadius: '50%',
  transition: 'all 150ms',
  color: 'rgba(255,255,255,0.5)',
};

export default function PlayerBar() {
  const {
    playerTrack, playerIsPlaying, playerProgress, playerCurrentTime, playerDuration, playerVolume,
    togglePlay, seekTo, setPlayerVolume, playNext, playPrev, playTrack, tracks,
    selectedTrack, setSelectedTrack, refreshTracks,
    isLooping, isShuffled, toggleLoop, toggleShuffle,
    setActiveTab,
  } = useWorkspace();
  const authFetch = useAuthFetch();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const isDragging = useRef(false);
  const [dragProgress, setDragProgress] = useState<number | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const preMuteVolume = useRef(0.8);
  const [showQueue, setShowQueue] = useState(false);

  const startEditTitle = () => {
    if (!playerTrack) return;
    setTitleDraft(playerTrack.title || `Track v${playerTrack.version}`);
    setEditingTitle(true);
  };

  const saveTitle = async () => {
    if (!playerTrack || !titleDraft.trim()) { setEditingTitle(false); return; }
    const trimmed = titleDraft.trim();
    await authFetch(`/api/music/${playerTrack.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    });
    if (selectedTrack?.id === playerTrack.id) {
      setSelectedTrack({ ...selectedTrack, title: trimmed });
    }
    refreshTracks();
    setEditingTitle(false);
  };

  const getFractionFromMouseEvent = useCallback((clientX: number): number => {
    if (!progressBarRef.current) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      setDragProgress(getFractionFromMouseEvent(e.clientX));
    };
    const onMouseUp = (e: MouseEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const fraction = getFractionFromMouseEvent(e.clientX);
      setDragProgress(null);
      seekTo(fraction);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [getFractionFromMouseEvent, seekTo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as Element).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); seekTo(Math.min(1, playerProgress + 0.05)); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); seekTo(Math.max(0, playerProgress - 0.05)); }
      else if (e.key === 'm' || e.key === 'M') { setPlayerVolume(playerVolume === 0 ? 0.8 : 0); }
      else if (e.code === 'KeyN') playNext();
      else if (e.code === 'KeyP') playPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, seekTo, playerProgress, playerVolume, setPlayerVolume, playNext, playPrev]);

  useEffect(() => {
    if (!showQueue) return;
    const dismiss = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-queue-popover]')) setShowQueue(false);
    };
    document.addEventListener('mousedown', dismiss);
    return () => document.removeEventListener('mousedown', dismiss);
  }, [showQueue]);

  const handleMuteToggle = useCallback(() => {
    if (playerVolume === 0) {
      setPlayerVolume(preMuteVolume.current > 0 ? preMuteVolume.current : 0.8);
    } else {
      preMuteVolume.current = playerVolume;
      setPlayerVolume(0);
    }
  }, [playerVolume, setPlayerVolume]);

  const queueTracks = (() => {
    if (!playerTrack || tracks.length === 0) return [];
    if (isShuffled) {
      return tracks.filter(t => t.id !== playerTrack.id).slice(0, 5);
    }
    const idx = tracks.findIndex(t => t.id === playerTrack.id);
    const next: typeof tracks = [];
    for (let i = 1; i <= 5; i++) {
      const candidate = tracks[(idx + i) % tracks.length];
      if (candidate && candidate.id !== playerTrack.id) next.push(candidate);
    }
    return next;
  })();

  // Precompute scrubber values
  const displayFraction = dragProgress !== null ? dragProgress : playerProgress;
  const thumbSize = dragProgress !== null ? '14px' : '12px';
  const fillTransition = dragProgress !== null ? 'none' : 'width 0.1s linear';
  const opacityTransition = dragProgress !== null ? 'none' : 'opacity 200ms';
  const thumbShadow = dragProgress !== null
    ? `0 0 8px ${C.red}88, 0 0 4px rgba(0,0,0,0.6)`
    : '0 0 4px rgba(0,0,0,0.6)';
  const dotOpacity = playerTrack ? 1 : 0;

  return (
    <div
      data-testid="player-bar"
      style={{
        background: 'rgba(8,2,4,0.97)',
        backdropFilter: 'blur(28px) saturate(1.6)',
        borderTop: `1px solid rgba(230,57,70,0.22)`,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: '16px',
        padding: '0 24px',
        height: '78px',
        flexShrink: 0,
      }}
    >
      {/* Left — track info — clickable to jump to track in Sounds tab */}
      <div
        onClick={() => {
          if (!playerTrack) return;
          setActiveTab('sounds');
          setSelectedTrack(playerTrack);
          // Scroll to track row once tab renders
          setTimeout(() => {
            const el = document.querySelector(`[data-testid="track-row-${playerTrack.id}"]`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 80);
        }}
        style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, cursor: 'pointer' }}
      >
        <style>{`
          @keyframes marquee-scroll {
            0%   { transform: translateX(0); }
            30%  { transform: translateX(0); }
            70%  { transform: translateX(var(--marquee-shift)); }
            100% { transform: translateX(var(--marquee-shift)); }
          }
        `}</style>

        {/* Thumbnail */}
        <div style={{
          width: '46px',
          height: '46px',
          borderRadius: '8px',
          background: playerTrack
            ? `linear-gradient(135deg, ${C.redDark}, #080108)`
            : 'rgba(255,255,255,0.06)',
          border: `1px solid ${playerTrack ? C.borderActive : C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: playerTrack && playerIsPlaying ? `0 0 16px ${C.red}33` : 'none',
          transition: 'box-shadow 400ms',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {playerTrack?.artwork_url ? (
            <img
              src={`/api/projects/${playerTrack.project_id}/artwork/${playerTrack.id}`}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke={playerTrack ? C.red : 'rgba(255,255,255,0.15)'} strokeWidth="1.5"/>
              <circle cx="8" cy="8" r="2" fill={playerTrack ? C.red : 'rgba(255,255,255,0.1)'} opacity={playerTrack ? 0.6 : 1}/>
            </svg>
          )}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          {playerTrack ? (
            <>
              {editingTitle ? (
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                  onBlur={saveTitle}
                  data-testid="player-title-input"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: `1px solid ${C.borderActive}`,
                    borderRadius: '5px',
                    padding: '3px 8px',
                    color: C.text,
                    fontSize: '14px',
                    fontWeight: 600,
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              ) : (
                <div
                  style={{ overflow: 'hidden', position: 'relative', cursor: 'text' }}
                  title="Double-click to rename"
                  onDoubleClick={startEditTitle}
                  data-testid="player-track-title"
                >
                  <div
                    style={{
                      color: C.text,
                      fontSize: '14px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      letterSpacing: '-0.1px',
                      display: 'inline-block',
                      animation: (playerTrack.title || `Track v${playerTrack.version}`).length > 22
                        ? 'marquee-scroll 6s ease-in-out infinite alternate'
                        : 'none',
                    }}
                  >
                    {playerTrack.title || `Track v${playerTrack.version}`}
                  </div>
                </div>
              )}
              <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: '11px', marginTop: '3px', fontVariantNumeric: 'tabular-nums' }}>
                {fmtTime(playerCurrentTime)} · {fmtTime(playerDuration)}
              </div>
            </>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>
              No track selected
            </div>
          )}
        </div>
      </div>

      {/* Centre — controls + scrubber */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '380px' }}>
        {/* Transport buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={toggleShuffle}
            title="Shuffle"
            style={{ ...btnBase, fontSize: '12px', color: isShuffled ? C.red : 'rgba(255,255,255,0.35)', background: isShuffled ? `${C.red}18` : 'none' }}
            onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.color = isShuffled ? C.red : '#fff'; }}
            onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.color = isShuffled ? C.red : 'rgba(255,255,255,0.35)'; }}
          >⇌</button>

          <button
            onClick={playPrev}
            title="Previous"
            style={{ ...btnBase, fontSize: '13px' }}
            onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
            onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)'; }}
          >⏮</button>

          <button
            onClick={togglePlay}
            data-testid="player-play-pause"
            title={playerIsPlaying ? 'Pause' : 'Play'}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              background: playerIsPlaying
                ? C.red
                : 'rgba(255,255,255,0.92)',
              color: playerIsPlaying ? '#fff' : '#000',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: playerIsPlaying
                ? `0 0 20px ${C.red}55, 0 2px 8px rgba(0,0,0,0.5)`
                : '0 2px 8px rgba(0,0,0,0.4)',
              transition: 'all 200ms',
              margin: '0 4px',
            }}
          >
            {playerIsPlaying ? '⏸' : '▶'}
          </button>

          <button
            onClick={playNext}
            title="Next"
            style={{ ...btnBase, fontSize: '13px' }}
            onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
            onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)'; }}
          >⏭</button>

          <button
            onClick={toggleLoop}
            title="Loop"
            style={{ ...btnBase, fontSize: '12px', color: isLooping ? C.red : 'rgba(255,255,255,0.35)', background: isLooping ? `${C.red}18` : 'none' }}
            onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.color = isLooping ? C.red : '#fff'; }}
            onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.color = isLooping ? C.red : 'rgba(255,255,255,0.35)'; }}
          >↺</button>
        </div>

        {/* Scrubber */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontVariantNumeric: 'tabular-nums', width: '30px', textAlign: 'right', flexShrink: 0 }}>
            {fmtTime(playerCurrentTime)}
          </span>
          <div
            ref={progressBarRef}
            onMouseDown={e => {
              isDragging.current = true;
              setDragProgress(getFractionFromMouseEvent(e.clientX));
            }}
            onClick={e => {
              if (!isDragging.current) {
                const rect = e.currentTarget.getBoundingClientRect();
                seekTo((e.clientX - rect.left) / rect.width);
              }
            }}
            data-testid="player-progress"
            style={{
              flex: 1,
              height: '4px',
              background: 'rgba(255,255,255,0.12)',
              borderRadius: '2px',
              cursor: 'pointer',
              position: 'relative',
              userSelect: 'none',
            }}
          >
            <div style={{ height: '100%', width: `${displayFraction * 100}%`, background: `linear-gradient(to right, ${C.red}, ${C.gold})`, borderRadius: '2px', transition: fillTransition }} />
            <div style={{ position: 'absolute', top: '50%', left: `${displayFraction * 100}%`, transform: 'translate(-50%, -50%)', width: thumbSize, height: thumbSize, borderRadius: '50%', background: '#fff', boxShadow: thumbShadow, opacity: dotOpacity, transition: opacityTransition }} />
          </div>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontVariantNumeric: 'tabular-nums', width: '30px', flexShrink: 0 }}>
            {fmtTime(playerDuration)}
          </span>
        </div>
      </div>

      {/* Right — volume */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={handleMuteToggle}
          title={playerVolume === 0 ? 'Unmute' : 'Mute'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: playerVolume === 0 ? C.red : 'rgba(255,255,255,0.3)', fontSize: '14px', padding: '4px', lineHeight: 1, transition: 'color 150ms', flexShrink: 0 }}
        >
          {playerVolume === 0 ? '🔇' : playerVolume < 0.4 ? '🔈' : playerVolume < 0.8 ? '🔉' : '🔊'}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={playerVolume}
          onChange={e => setPlayerVolume(Number(e.target.value))}
          data-testid="volume-slider"
          style={{ width: '88px', accentColor: C.red, cursor: 'pointer' }}
        />
        <div style={{ position: 'relative' }} data-queue-popover>
          <button
            onClick={() => setShowQueue(v => !v)}
            title="Up Next"
            style={{ ...btnBase, fontSize: '11px', fontWeight: 600, letterSpacing: '0.3px', color: showQueue ? C.red : 'rgba(255,255,255,0.35)', background: showQueue ? `${C.red}18` : 'none', borderRadius: '6px', padding: '4px 8px', whiteSpace: 'nowrap' }}
          >
            ≡ UP NEXT
          </button>
          {showQueue && (
            <div style={{ position: 'absolute', bottom: '52px', right: 0, width: '260px', background: 'rgba(8,2,4,0.97)', backdropFilter: 'blur(28px) saturate(1.6)', border: `1px solid rgba(230,57,70,0.22)`, borderRadius: '10px', padding: '8px 0', boxShadow: '0 -8px 40px rgba(0,0,0,0.7)', zIndex: 200 }}>
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px', padding: '4px 14px 8px', textTransform: 'uppercase' }}>
                {isShuffled ? 'Shuffle Queue' : 'Up Next'}
              </div>
              {queueTracks.length === 0 ? (
                <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: '12px', padding: '4px 14px 8px' }}>No tracks queued</div>
              ) : queueTracks.map((t, i) => (
                <button key={t.id} onClick={() => { playTrack(t); setShowQueue(false); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '7px 14px', textAlign: 'left' }}
                  onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(230,57,70,0.10)'; }}
                  onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontVariantNumeric: 'tabular-nums', width: '14px', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ flex: 1, color: '#fff', fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title || `Track v${t.version}`}</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmtTime(t.duration_seconds ?? 0)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}