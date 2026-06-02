import { useEffect, useState } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { useAuthFetch } from '../../../hooks/useAuthFetch';
import { tapLight, tapMedium, notifySuccess } from '../../../lib/haptics';
import type { MusicGeneration } from '../../../types';

interface Props { track: MusicGeneration; onClose: () => void }

// Spotify-style bottom sheet: add the current track to any playlist, or create one.
export default function AddToPlaylistSheet({ track, onClose }: Props) {
  const { playlists, addTrackToPlaylist, removeTrackFromPlaylist, createPlaylistNamed } = useWorkspace();
  const authFetch = useAuthFetch();
  const [member, setMember] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  // Determine which playlists already contain this track.
  useEffect(() => {
    let cancelled = false;
    Promise.all(playlists.map(async (p) => {
      try {
        const ts = await (await authFetch(`/api/playlists/${p.id}/tracks`)).json();
        return Array.isArray(ts) && ts.some((t: MusicGeneration) => t.id === track.id) ? p.id : null;
      } catch { return null; }
    })).then(ids => { if (!cancelled) setMember(new Set(ids.filter(Boolean) as string[])); });
    return () => { cancelled = true; };
  }, [playlists, track.id, authFetch]);

  const toggle = (pid: string) => {
    if (member.has(pid)) { removeTrackFromPlaylist(pid, track.id); setMember(prev => { const n = new Set(prev); n.delete(pid); return n; }); tapLight(); }
    else { addTrackToPlaylist(pid, track.id); setMember(prev => new Set(prev).add(pid)); notifySuccess(); }
  };

  const create = async () => {
    if (!name.trim()) return;
    tapMedium();
    const id = await createPlaylistNamed(name.trim());
    if (id) { addTrackToPlaylist(id, track.id); notifySuccess(); }
    setName(''); setCreating(false);
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2500, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', animation: 'ris-fade 200ms ease' }}>
      <style>{`@keyframes ris-fade { from { opacity: 0 } to { opacity: 1 } } @keyframes ris-sheet { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', background: 'rgba(22,8,12,0.86)', backdropFilter: 'blur(40px) saturate(1.6)', WebkitBackdropFilter: 'blur(40px) saturate(1.6)',
        borderTop: '1px solid rgba(255,255,255,0.1)', borderRadius: '22px 22px 0 0',
        padding: '10px 0 calc(env(safe-area-inset-bottom, 16px) + 12px)', maxHeight: '70vh', display: 'flex', flexDirection: 'column',
        animation: 'ris-sheet 320ms cubic-bezier(0.22,1,0.36,1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 6 }}><div style={{ width: 38, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.25)' }} /></div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', textAlign: 'center', padding: '12px 0 6px' }}>Add to Playlist</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textAlign: 'center', paddingBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 24px 10px' }}>{track.title || `Track v${track.version}`}</div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* New playlist */}
          {creating ? (
            <div style={{ display: 'flex', gap: 8, padding: '10px 20px' }}>
              <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Playlist name"
                onKeyDown={e => e.key === 'Enter' && create()}
                style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: `1px solid ${C.borderActive}`, borderRadius: 9, padding: '10px 12px', color: '#fff', fontSize: 15, outline: 'none' }} />
              <button onClick={create} style={{ background: C.red, border: 'none', color: '#fff', borderRadius: 9, padding: '0 16px', fontWeight: 700, cursor: 'pointer' }}>Add</button>
            </div>
          ) : (
            <button onClick={() => { tapLight(); setCreating(true); }} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 20px' }}>
              <div style={{ width: 46, height: 46, borderRadius: 8, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              </div>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>New Playlist</span>
            </button>
          )}

          {playlists.map(p => {
            const has = member.has(p.id);
            return (
              <button key={p.id} onClick={() => toggle(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 20px' }}>
                <div style={{ width: 46, height: 46, borderRadius: 8, flexShrink: 0, background: p.name === 'Liked Songs' ? 'linear-gradient(135deg,#e0399a,#7a1040)' : `linear-gradient(135deg, ${C.red}, #3a0810)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" opacity="0.9"><path d="M9 18V5l11-2v13" stroke="#fff" strokeWidth="1.5" fill="none"/><circle cx="6" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/></svg>
                </div>
                <span style={{ flex: 1, textAlign: 'left', fontSize: 15, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${has ? C.red : 'rgba(255,255,255,0.25)'}`, background: has ? C.red : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {has && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>}
                </div>
              </button>
            );
          })}
          {playlists.length === 0 && <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center', padding: '16px' }}>No playlists yet — create one above.</div>}
        </div>
      </div>
    </div>
  );
}
