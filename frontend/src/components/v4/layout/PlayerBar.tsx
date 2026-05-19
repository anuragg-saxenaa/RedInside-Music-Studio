import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';

function fmtTime(s: number) {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function PlayerBar() {
  const { playerTrack, playerIsPlaying, playerProgress, playerCurrentTime, playerDuration, playerVolume,
          togglePlay, seekTo, setPlayerVolume, playNext, playPrev } = useWorkspace();

  return (
    <div style={{
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(20px)',
      borderTop: `1px solid ${C.border}`,
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
    }} data-testid="player-bar">

      {/* Track info */}
      <div style={{ width: '200px', flexShrink: 0 }}>
        {playerTrack ? (
          <>
            <div style={{ color: C.text, fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {playerTrack.title || `Track v${playerTrack.version}`}
            </div>
            <div style={{ color: C.textDim, fontSize: '10px', marginTop: '2px' }}>
              {fmtTime(playerCurrentTime)} / {fmtTime(playerDuration)}
            </div>
          </>
        ) : (
          <div style={{ color: C.textDim, fontSize: '11px' }}>No track selected</div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <button onClick={playPrev} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: '14px', padding: '4px' }}>⏮</button>
        <button
          onClick={togglePlay}
          data-testid="player-play-pause"
          style={{
            width: '36px', height: '36px', borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: playerIsPlaying ? C.red : 'rgba(255,255,255,0.15)',
            color: '#fff', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: playerIsPlaying ? `0 0 12px ${C.red}66` : 'none',
            transition: 'all 200ms',
          }}
        >
          {playerIsPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={playNext} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: '14px', padding: '4px' }}>⏭</button>
      </div>

      {/* Progress bar */}
      <div
        style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', cursor: 'pointer', position: 'relative' }}
        onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          seekTo((e.clientX - rect.left) / rect.width);
        }}
        data-testid="player-progress"
      >
        <div style={{
          height: '100%',
          width: `${playerProgress * 100}%`,
          background: `linear-gradient(to right, ${C.red}, ${C.gold})`,
          borderRadius: '2px',
          transition: 'width 0.1s linear',
        }} />
        <div style={{
          position: 'absolute', top: '50%', left: `${playerProgress * 100}%`,
          transform: 'translate(-50%, -50%)',
          width: '10px', height: '10px', borderRadius: '50%', background: C.text,
          boxShadow: '0 0 4px rgba(0,0,0,0.5)',
        }} />
      </div>

      {/* Volume */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <span style={{ color: C.textDim, fontSize: '12px' }}>🔊</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={playerVolume}
          onChange={e => setPlayerVolume(Number(e.target.value))}
          data-testid="volume-slider"
          style={{ width: '80px', accentColor: C.red, cursor: 'pointer' }}
        />
      </div>
    </div>
  );
}
