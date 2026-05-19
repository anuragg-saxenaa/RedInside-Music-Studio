import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import type { MusicGeneration } from '../../../types';

interface TrackRowProps {
  track: MusicGeneration;
  onDoubleClick?: () => void;
}

function fmtDuration(s?: number | null) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function TrackRow({ track, onDoubleClick }: TrackRowProps) {
  const { selectedTrack, setSelectedTrack, playTrack, playerTrack, playerIsPlaying } = useWorkspace();
  const isSelected = selectedTrack?.id === track.id;
  const isPlaying = playerTrack?.id === track.id && playerIsPlaying;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setSelectedTrack(track)}
      onDoubleClick={onDoubleClick}
      onKeyDown={e => e.key === 'Enter' && setSelectedTrack(track)}
      data-testid={`track-row-${track.id}`}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
        background: isSelected ? C.glassActive : 'transparent',
        border: `1px solid ${isSelected ? C.borderActive : 'transparent'}`,
        transition: 'all 120ms',
      }}
      onMouseOver={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseOut={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
    >
      {/* Play indicator */}
      <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isPlaying ? (
          <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '14px' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ width: '3px', background: C.red, borderRadius: '1px', height: `${8 + i * 2}px`, animation: `barPulse${i} 0.8s ease-in-out infinite alternate` }} />
            ))}
          </div>
        ) : (
          <svg width="10" height="12" viewBox="0 0 10 12" fill={isSelected ? C.red : C.textDim}>
            <path d="M0 0L10 6L0 12V0Z"/>
          </svg>
        )}
      </div>

      {/* Title + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.text, fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {track.title || `Track v${track.version}`}
        </div>
        <div style={{ color: C.textDim, fontSize: '11px', marginTop: '2px' }}>
          {fmtDuration(track.duration_seconds)} {track.bitrate ? `· ${track.bitrate}kbps` : ''}
        </div>
      </div>

      {/* Play button */}
      <button
        onClick={e => { e.stopPropagation(); playTrack(track); }}
        data-testid={`play-btn-${track.id}`}
        style={{ background: 'none', border: 'none', color: isSelected ? C.red : C.textDim, cursor: 'pointer', padding: '4px', fontSize: '12px' }}
      >▶</button>

      <style>{`
        @keyframes barPulse1 { from { height: 6px } to { height: 14px } }
        @keyframes barPulse2 { from { height: 10px } to { height: 4px } }
        @keyframes barPulse3 { from { height: 8px } to { height: 12px } }
      `}</style>
    </div>
  );
}
