import { useState } from 'react';
import { C } from '../shared/colors';
import GlassPanel from '../shared/GlassPanel';
import { useWorkspace } from '../../../contexts/WorkspaceContext';

const SMART_PLAYLISTS = [
  { id: '__all_mastered', name: 'All Mastered' },
  { id: '__instrumentals', name: 'Instrumentals' },
  { id: '__unmastered', name: 'Unmastered' },
];

export default function PlaylistSection() {
  const { playlists, refreshPlaylists } = useWorkspace();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);

  const createPlaylist = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      refreshPlaylists();
      setNewName('');
    } finally {
      setCreating(false);
    }
  };

  const deletePlaylist = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/playlists/${id}`, { method: 'DELETE' });
    refreshPlaylists();
    if (activePlaylistId === id) setActivePlaylistId(null);
  };

  return (
    <GlassPanel style={{ padding: '12px' }} data-testid="playlist-section">
      <div style={{ color: C.textLabel, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '8px' }}>
        Playlists
      </div>

      {/* Create */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createPlaylist()}
          placeholder="New playlist…"
          data-testid="new-playlist-input"
          style={{
            flex: 1, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
            borderRadius: '6px', padding: '6px 8px', color: C.text, fontSize: '12px', outline: 'none',
          }}
        />
        <button
          onClick={createPlaylist}
          disabled={creating || !newName.trim()}
          data-testid="create-playlist-btn"
          style={{ background: C.red, border: 'none', borderRadius: '6px', color: '#fff', padding: '6px 10px', fontSize: '14px', cursor: 'pointer' }}
        >+</button>
      </div>

      {/* Smart playlists */}
      <div style={{ color: C.textDim, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Smart</div>
      {SMART_PLAYLISTS.map(sp => (
        <div
          key={sp.id}
          role="button"
          tabIndex={0}
          onClick={() => setActivePlaylistId(activePlaylistId === sp.id ? null : sp.id)}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setActivePlaylistId(activePlaylistId === sp.id ? null : sp.id)}
          data-testid={`smart-playlist-${sp.id}`}
          style={{
            padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
            color: activePlaylistId === sp.id ? C.text : C.textDim,
            background: activePlaylistId === sp.id ? C.glassActive : 'transparent',
          }}
        >
          {sp.name}
        </div>
      ))}

      {/* Manual playlists */}
      {playlists.length > 0 && (
        <>
          <div style={{ color: C.textDim, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '8px 0 4px' }}>My Playlists</div>
          {playlists.map(pl => (
            <div
              key={pl.id}
              role="button"
              tabIndex={0}
              onClick={() => setActivePlaylistId(activePlaylistId === pl.id ? null : pl.id)}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setActivePlaylistId(activePlaylistId === pl.id ? null : pl.id)}
              data-testid={`playlist-item-${pl.id}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
                color: activePlaylistId === pl.id ? C.text : C.textDim,
                background: activePlaylistId === pl.id ? C.glassActive : 'transparent',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pl.name} <span style={{ color: C.textDim }}>({pl.track_count ?? 0})</span>
              </span>
              <button
                onClick={e => deletePlaylist(pl.id, e)}
                style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: '12px', padding: '0 2px', lineHeight: 1 }}
              >×</button>
            </div>
          ))}
        </>
      )}
    </GlassPanel>
  );
}
