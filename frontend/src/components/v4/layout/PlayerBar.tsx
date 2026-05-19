import { useState } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';

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
    togglePlay, seekTo, setPlayerVolume, playNext, playPrev,
    selectedTrack, setSelectedTrack, refreshTracks,
  } = useWorkspace();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  const startEditTitle = () => {
    if (!playerTrack) return;
    setTitleDraft(playerTrack.title || `Track v${playerTrack.version}`);
    setEditingTitle(true);
  };

  const saveTitle = async () => {
    if (!playerTrack || !titleDraft.trim()) { setEditingTitle(false); return; }
    const trimmed = titleDraft.trim();
    await fetch(`/api/music/${playerTrack.id}`, {
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
      {/* Left — track info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
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
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke={playerTrack ? C.red : 'rgba(255,255,255,0.15)'} strokeWidth="1.5"/>
            <circle cx="8" cy="8" r="2" fill={playerTrack ? C.red : 'rgba(255,255,255,0.1)'} opacity={playerTrack ? 0.6 : 1}/>
          </svg>
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
                      /* CSS variable set via style prop on parent isn't possible inline;
                         use animation only for long titles via a conditional class-like approach */
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
        </div>

        {/* Scrubber */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontVariantNumeric: 'tabular-nums', width: '30px', textAlign: 'right', flexShrink: 0 }}>
            {fmtTime(playerCurrentTime)}
          </span>
          <div
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              seekTo((e.clientX - rect.left) / rect.width);
            }}
            data-testid="player-progress"
            style={{
              flex: 1,
              height: '4px',
              background: 'rgba(255,255,255,0.12)',
              borderRadius: '2px',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <div style={{
              height: '100%',
              width: `${playerProgress * 100}%`,
              background: `linear-gradient(to right, ${C.red}, ${C.gold})`,
              borderRadius: '2px',
              transition: 'width 0.1s linear',
            }} />
            <div style={{
              position: 'absolute',
              top: '50%',
              left: `${playerProgress * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 0 4px rgba(0,0,0,0.6)',
              opacity: playerTrack ? 1 : 0,
              transition: 'opacity 200ms',
            }} />
          </div>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontVariantNumeric: 'tabular-nums', width: '30px', flexShrink: 0 }}>
            {fmtTime(playerDuration)}
          </span>
        </div>
      </div>

      {/* Right — volume */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
          {playerVolume === 0 ? '🔇' : playerVolume < 0.4 ? '🔈' : playerVolume < 0.8 ? '🔉' : '🔊'}
        </span>
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
      </div>
    </div>
  );
}
