import { useState, useEffect } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { useAuthFetch } from '../../../hooks/useAuthFetch';
import type { MusicGeneration } from '../../../types';

interface TrackRowProps {
  track: MusicGeneration;
  onDoubleClick?: () => void;
  onEdit?: () => void;
  isEditOpen?: boolean;
}

function fmtDuration(s?: number | null) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: '9px',
      fontWeight: 700,
      letterSpacing: '0.6px',
      padding: '2px 5px',
      borderRadius: '3px',
      border: `1px solid ${color}44`,
      color,
      background: `${color}11`,
      flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

export default function TrackRow({ track, onDoubleClick, onEdit, isEditOpen }: TrackRowProps) {
  const { selectedTrack, setSelectedTrack, playTrack, playerTrack, playerIsPlaying, refreshTracks, setActiveTab } = useWorkspace();
  const authFetch = useAuthFetch();
  const isSelected = selectedTrack?.id === track.id;
  const isPlaying = playerTrack?.id === track.id && playerIsPlaying;
  const isMastered = !!track.processed_file_path;
  const [bpm, setBpm] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    authFetch(`/api/music/${track.id}/tags`)
      .then(r => r.json())
      .then((t: { bpm?: number | null }) => { if (t.bpm) setBpm(Math.round(t.bpm)); })
      .catch(() => {});
  }, [track.id]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  const deleteTrack = async () => {
    if (!confirm(`Delete "${track.title || `Track v${track.version}`}"? This cannot be undone.`)) return;
    await authFetch(`/api/music/${track.id}`, { method: 'DELETE' });
    if (selectedTrack?.id === track.id) setSelectedTrack(null);
    refreshTracks();
  };

  return (
    <div
      data-testid={`track-row-${track.id}`}
      style={{ position: 'relative' }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => { setSelectedTrack(track); playTrack(track); }}
        onDoubleClick={onDoubleClick}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (setSelectedTrack(track), playTrack(track))}
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
        <div style={{
          width: '40px', height: '40px', borderRadius: '6px',
          background: track.artwork_url
            ? 'transparent'
            : `linear-gradient(135deg, rgba(230,57,70,0.3) 0%, rgba(8,2,4,0.8) 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, overflow: 'hidden', position: 'relative',
          border: `1px solid ${isSelected ? C.borderActive : C.border}`,
        }}>
          {track.artwork_url ? (
            <img
              src={`/api/projects/${track.project_id}/artwork/${track.id}`}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : isPlaying ? (
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
          {isPlaying && track.artwork_url && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '14px' }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{ width: '3px', background: C.red, borderRadius: '1px', height: `${8 + i * 2}px`, animation: `barPulse${i} 0.8s ease-in-out infinite alternate` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: C.text, fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {track.title || `Track v${track.version}`}
          </div>
          <div style={{ color: C.textDim, fontSize: '11px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span>{fmtDuration(track.duration_seconds)}{track.bitrate ? ` · ${track.bitrate}kbps` : ''}</span>
            {isMastered && <Badge label="MASTERED" color={C.gold} />}
            {track.is_instrumental && <Badge label="INSTRUMENTAL" color="#60a5fa" />}
            {bpm && <Badge label={`${bpm} BPM`} color="rgba(255,255,255,0.5)" />}
          </div>
        </div>


        <button
          onClick={e => { e.stopPropagation(); onEdit?.(); }}
          title="Edit track metadata"
          style={{
            background: isEditOpen ? 'rgba(230,57,70,0.12)' : 'none',
            border: `1px solid ${isEditOpen ? 'rgba(230,57,70,0.3)' : 'transparent'}`,
            color: isEditOpen ? C.red : 'rgba(255,255,255,0.25)',
            cursor: 'pointer', fontSize: '13px', padding: '3px 6px', lineHeight: 1,
            borderRadius: '4px', flexShrink: 0,
          }}
          onMouseOver={e => { (e.currentTarget.style.color = C.text); }}
          onMouseOut={e => { if (!isEditOpen) e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; }}
        >✎</button>
        <button
          onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
          data-testid={`track-menu-btn-${track.id}`}
          style={{
            background: 'none', border: 'none',
            color: menuOpen ? C.text : 'rgba(255,255,255,0.25)',
            cursor: 'pointer', fontSize: '16px', padding: '2px 4px', lineHeight: 1,
          }}
          onMouseOver={e => (e.currentTarget.style.color = C.text)}
          onMouseOut={e => { if (!menuOpen) e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; }}
        >⋯</button>
      </div>

      {menuOpen && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', right: '8px', top: '100%', zIndex: 400,
            background: '#1a1a1a', border: `1px solid ${C.border}`, borderRadius: '8px',
            padding: '4px', minWidth: '148px', boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          }}
        >
          {([
            { icon: '▶', label: 'Play',   action: () => playTrack(track),                                              danger: false },
            { icon: '✎', label: 'Write',  action: () => { setSelectedTrack(track); setActiveTab('write'); },           danger: false },
            { icon: '⚙', label: 'Craft',  action: () => { setSelectedTrack(track); setActiveTab('craft'); },           danger: false },
            { icon: '⬆', label: 'Master', action: () => { setSelectedTrack(track); setActiveTab('release'); },         danger: false },
            { icon: '↗', label: 'Export', action: () => { setSelectedTrack(track); setActiveTab('release'); },         danger: false },
            { icon: '✕', label: 'Delete', action: () => deleteTrack(),                                                  danger: true  },
          ] as const).map(({ icon, label, action, danger }) => (
            <button
              key={label}
              onClick={() => { setMenuOpen(false); action(); }}
              data-testid={label === 'Delete' ? `delete-track-btn-${track.id}` : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', background: 'none', border: 'none',
                color: danger ? C.red : 'rgba(255,255,255,0.7)', padding: '8px 12px', cursor: 'pointer',
                textAlign: 'left', fontSize: '13px', borderRadius: '5px',
              }}
              onMouseOver={e => (e.currentTarget.style.background = danger ? 'rgba(230,57,70,0.12)' : 'rgba(255,255,255,0.08)')}
              onMouseOut={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ width: '14px', textAlign: 'center', flexShrink: 0, opacity: 0.7 }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes barPulse1 { from { height: 6px } to { height: 14px } }
        @keyframes barPulse2 { from { height: 10px } to { height: 4px } }
        @keyframes barPulse3 { from { height: 8px } to { height: 12px } }
      `}</style>
    </div>
  );
}
