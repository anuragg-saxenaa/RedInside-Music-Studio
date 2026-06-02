import { useState } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { useDownloads } from '../../../contexts/DownloadsContext';
import AddToPlaylistSheet from './AddToPlaylistSheet';
import { tapLight, tapMedium, notifySuccess } from '../../../lib/haptics';
import type { MusicGeneration } from '../../../types';

interface Props { track: MusicGeneration; onClose: () => void }

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// Long-press track menu (Spotify/Apple style bottom sheet): Play Next, Add to
// Queue, Like, Add to Playlist, Download.
export default function TrackActionsSheet({ track, onClose }: Props) {
  const { playTrackNext, addToQueue, isLiked, toggleLike } = useWorkspace();
  const { statusOf, download, remove } = useDownloads();
  const [showAdd, setShowAdd] = useState(false);
  const liked = isLiked(track.id);
  const dlStatus = statusOf(track.id);
  const art = track.artwork_url ? (track.artwork_url.startsWith('http') ? track.artwork_url : `${API_BASE}/api/projects/${track.project_id}/artwork/${track.id}`) : null;
  const meta = { id: track.id, title: track.title || `Track v${track.version}`, artist: track.artist, projectId: track.project_id };

  if (showAdd) return <AddToPlaylistSheet track={track} onClose={onClose} />;

  const Row = ({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) => (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 24px', color: danger ? C.red : '#fff', fontSize: 16 }}>
      <span style={{ width: 24, display: 'flex', justifyContent: 'center', color: danger ? C.red : 'rgba(255,255,255,0.75)' }}>{icon}</span>
      {label}
    </button>
  );
  const ic = (d: string) => <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2600, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', animation: 'ris-fade 200ms ease' }}>
      <style>{`@keyframes ris-fade{from{opacity:0}to{opacity:1}}@keyframes ris-sheet{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: 'rgba(22,8,12,0.9)', backdropFilter: 'blur(40px) saturate(1.6)', WebkitBackdropFilter: 'blur(40px) saturate(1.6)', borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: '22px 22px 0 0', paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 10px)', animation: 'ris-sheet 320ms cubic-bezier(0.22,1,0.36,1)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}><div style={{ width: 38, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.25)' }} /></div>
        {/* Track header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 24px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 6 }}>
          <div style={{ width: 50, height: 50, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: `linear-gradient(135deg, ${C.redDark}, #080108)` }}>{art && <img src={art} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title || `Track v${track.version}`}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{track.artist || 'RedInside Studio'}</div>
          </div>
        </div>

        <Row icon={ic('M5 12h14M13 6l6 6-6 6')} label="Play Next" onClick={() => { tapLight(); playTrackNext(track); notifySuccess(); onClose(); }} />
        <Row icon={ic('M4 6h11M4 12h11M4 18h7M17 14v6M14 17h6')} label="Add to Queue" onClick={() => { tapLight(); addToQueue(track); notifySuccess(); onClose(); }} />
        <Row icon={<svg width="21" height="21" viewBox="0 0 24 24" fill={liked ? C.red : 'none'} stroke={liked ? C.red : 'currentColor'} strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"/></svg>} label={liked ? 'Remove from Liked Songs' : 'Like'} onClick={() => { tapMedium(); toggleLike(track); onClose(); }} />
        <Row icon={ic('M12 5v14M5 12h14')} label="Add to Playlist" onClick={() => { tapLight(); setShowAdd(true); }} />
        <Row
          icon={dlStatus === 'done' ? ic('M20 6L9 17l-5-5') : ic('M12 3v12M7 11l5 5 5-5M5 21h14')}
          label={dlStatus === 'done' ? 'Remove Download' : dlStatus === 'downloading' ? 'Downloading…' : 'Download'}
          onClick={() => { tapLight(); if (dlStatus === 'done') remove(track.id); else download(meta); onClose(); }}
        />
      </div>
    </div>
  );
}
