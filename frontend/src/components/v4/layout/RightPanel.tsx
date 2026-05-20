import { useState, useEffect } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import type { MusicNote, MusicTags } from '../../../types';

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const sectionLabel: React.CSSProperties = {
  color: 'rgba(255,255,255,0.28)',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '1.4px',
  marginBottom: '10px',
};

export default function RightPanel() {
  const { selectedTrack, setSelectedTrack, playTrack, setActiveTab, playerCurrentTime, activeProjectId, playlists, refreshPlaylists, refreshTracks } = useWorkspace();
  const [notes, setNotes] = useState<MusicNote[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [tags, setTags] = useState<MusicTags>({ bpm: null, key: null, mood: null });
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [trackPlaylists, setTrackPlaylists] = useState<string[]>([]);
  const [showAddPlaylist, setShowAddPlaylist] = useState(false);

  useEffect(() => {
    if (!selectedTrack) return;
    setNotes([]);
    setTags({ bpm: null, key: null, mood: null });
    setShareUrl(null);
    fetch(`/api/music/${selectedTrack.id}/notes`).then(r => r.json()).then(setNotes).catch(() => {});
    fetch(`/api/music/${selectedTrack.id}/tags`).then(r => r.json()).then(setTags).catch(() => {});
  }, [selectedTrack?.id]);

  useEffect(() => {
    if (!selectedTrack) { setTrackPlaylists([]); return; }
    Promise.all(
      playlists.map(pl =>
        fetch(`/api/playlists/${pl.id}/tracks`)
          .then(r => r.json())
          .then((tracks: Array<{ music_id?: string; id?: string }>) =>
            tracks.some((t) => t.music_id === selectedTrack.id || t.id === selectedTrack.id)
              ? pl.id : null
          )
          .catch(() => null)
      )
    ).then(results => setTrackPlaylists(results.filter(Boolean) as string[]));
  }, [selectedTrack?.id, playlists]);

  const addNote = async () => {
    if (!selectedTrack || !newNoteText.trim()) return;
    const res = await fetch(`/api/music/${selectedTrack.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp_sec: playerCurrentTime, text: newNoteText.trim() }),
    });
    const note: MusicNote = await res.json();
    setNotes(prev => [...prev, note].sort((a, b) => a.timestamp_sec - b.timestamp_sec));
    setNewNoteText('');
  };

  const deleteNote = async (noteId: string) => {
    if (!selectedTrack) return;
    await fetch(`/api/music/${selectedTrack.id}/notes/${noteId}`, { method: 'DELETE' });
    setNotes(prev => prev.filter(n => n.id !== noteId));
  };

  const generateShare = async () => {
    if (!activeProjectId) return;
    const res = await fetch(`/api/projects/${activeProjectId}/share`, { method: 'POST' });
    const data = await res.json();
    setShareUrl(`${window.location.origin}/#/share/${data.token}`);
  };

  const saveTitle = async () => {
    if (!selectedTrack || !titleDraft.trim()) { setEditingTitle(false); return; }
    const trimmed = titleDraft.trim();
    await fetch(`/api/music/${selectedTrack.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    });
    setSelectedTrack({ ...selectedTrack, title: trimmed });
    refreshTracks();
    setEditingTitle(false);
  };

  const addToPlaylist = async (playlistId: string) => {
    if (!selectedTrack) return;
    await fetch(`/api/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ musicId: selectedTrack.id }),
    });
    setTrackPlaylists(prev => [...prev, playlistId]);
    refreshPlaylists();
    setShowAddPlaylist(false);
  };

  const removeFromPlaylist = async (playlistId: string) => {
    if (!selectedTrack) return;
    await fetch(`/api/playlists/${playlistId}/tracks/${selectedTrack.id}`, { method: 'DELETE' });
    setTrackPlaylists(prev => prev.filter(id => id !== playlistId));
    refreshPlaylists();
  };

  const deleteTrack = async () => {
    if (!selectedTrack) return;
    if (!confirm(`Delete "${selectedTrack.title || `Track v${selectedTrack.version}`}"? This cannot be undone.`)) return;
    await fetch(`/api/music/${selectedTrack.id}`, { method: 'DELETE' });
    setSelectedTrack(null);
    refreshTracks();
  };

  const copyShare = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!selectedTrack) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '12px' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '12px',
          background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="9" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"/>
            <circle cx="11" cy="11" r="3" fill="rgba(255,255,255,0.08)"/>
          </svg>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: '12px', textAlign: 'center' }}>
          Select a track to see details
        </div>
      </div>
    );
  }

  const hasTags = tags.bpm || tags.key || tags.mood || selectedTrack.duration_seconds != null;

  return (
    <div
      data-testid="right-panel-track"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden auto' }}
    >
      {/* Track art + title */}
      <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{
          width: '100%',
          aspectRatio: '1',
          background: `linear-gradient(135deg, ${C.redDark} 0%, #0d0105 60%, #000 100%)`,
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '14px',
          border: `1px solid ${C.border}`,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative vinyl rings */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {[64, 44, 28].map((size, i) => (
              <div key={i} style={{
                position: 'absolute',
                width: `${size}%`, height: `${size}%`,
                borderRadius: '50%',
                border: `1px solid rgba(230,57,70,${0.08 + i * 0.06})`,
              }} />
            ))}
          </div>
          <div style={{
            width: '24px', height: '24px', borderRadius: '50%',
            background: C.red, opacity: 0.35, position: 'relative', zIndex: 1,
          }} />
        </div>

        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
            onBlur={saveTitle}
            data-testid="title-input"
            style={{
              color: C.text, fontSize: '15px', fontWeight: 700,
              background: 'rgba(255,255,255,0.08)', border: `1px solid ${C.borderActive}`,
              borderRadius: '6px', padding: '4px 8px', outline: 'none', width: '100%',
              marginBottom: '8px',
            }}
          />
        ) : (
          <div
            onDoubleClick={() => { setTitleDraft(selectedTrack.title || `Track v${selectedTrack.version}`); setEditingTitle(true); }}
            data-testid="track-title-display"
            title="Double-click to edit"
            style={{
              color: C.text, fontSize: '15px', fontWeight: 700,
              marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', letterSpacing: '-0.2px', cursor: 'text',
            }}
          >
            {selectedTrack.title || `Track v${selectedTrack.version}`}
          </div>
        )}

        {hasTags && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {tags.bpm && (
              <span style={{ background: 'rgba(255,184,0,0.1)', border: '1px solid rgba(255,184,0,0.25)', borderRadius: '5px', padding: '3px 7px', fontSize: '11px', color: C.gold, fontWeight: 600 }}>
                {Math.round(tags.bpm)} BPM
              </span>
            )}
            {tags.key && (
              <span style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: '5px', padding: '3px 7px', fontSize: '11px', color: 'rgba(255,255,255,0.65)' }}>
                {tags.key}
              </span>
            )}
            {selectedTrack.duration_seconds != null && (
              <span style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: '5px', padding: '3px 7px', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                {fmtTime(selectedTrack.duration_seconds)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
        <div style={sectionLabel}>Quick Actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            { label: '▶ Play',    action: () => playTrack(selectedTrack), testId: 'action-play',   danger: false },
            { label: '✎ Craft',  action: () => setActiveTab('craft'),    testId: 'action-edit',   danger: false },
            { label: '⬆ Master', action: () => setActiveTab('release'),  testId: 'action-master', danger: false },
            { label: '↗ Export', action: () => setActiveTab('release'),  testId: 'action-export', danger: false },
            { label: '✕ Delete', action: deleteTrack,                    testId: 'action-delete',  danger: true  },
          ].map(({ label, action, testId, danger }) => (
            <button
              key={testId}
              onClick={action}
              data-testid={testId}
              style={{
                background: danger ? 'rgba(230,57,70,0.06)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${danger ? 'rgba(230,57,70,0.22)' : C.border}`,
                borderRadius: '8px',
                color: danger ? C.red : 'rgba(255,255,255,0.7)',
                padding: '9px 8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 150ms',
              }}
              onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = danger ? 'rgba(230,57,70,0.15)' : 'rgba(230,57,70,0.1)'; (e.currentTarget as HTMLButtonElement).style.borderColor = C.borderActive; (e.currentTarget as HTMLButtonElement).style.color = danger ? '#ff6b6b' : C.text; }}
              onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = danger ? 'rgba(230,57,70,0.06)' : 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.borderColor = danger ? 'rgba(230,57,70,0.22)' : C.border; (e.currentTarget as HTMLButtonElement).style.color = danger ? C.red : 'rgba(255,255,255,0.7)'; }}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* Share */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
        <div style={sectionLabel}>Share</div>
        <button
          onClick={generateShare}
          data-testid="action-share"
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${C.border}`,
            borderRadius: '8px',
            color: 'rgba(255,255,255,0.5)',
            padding: '9px',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'all 150ms',
          }}
          onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.borderActive; (e.currentTarget as HTMLButtonElement).style.color = C.text; }}
          onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)'; }}
        >
          🔗 Generate Share Link
        </button>
        {shareUrl && (
          <div
            onClick={copyShare}
            data-testid="share-url"
            style={{
              marginTop: '8px',
              padding: '8px 10px',
              background: copied ? 'rgba(230,57,70,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${copied ? C.borderActive : C.border}`,
              borderRadius: '8px',
              color: copied ? C.gold : 'rgba(255,255,255,0.4)',
              fontSize: '10px',
              cursor: 'pointer',
              wordBreak: 'break-all',
              transition: 'all 200ms',
            }}
            title="Click to copy"
          >
            {copied ? '✓ Copied!' : shareUrl}
          </div>
        )}
      </div>

      {playlists.length > 0 && (
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={sectionLabel}>Playlists</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
            {playlists.filter(pl => trackPlaylists.includes(pl.id)).map(pl => (
              <div key={pl.id} data-testid={`track-in-playlist-${pl.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                <span style={{ flex: 1 }}>{pl.name}</span>
                <button
                  onClick={() => removeFromPlaylist(pl.id)}
                  data-testid={`remove-from-playlist-${pl.id}`}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}
                  onMouseOver={e => (e.currentTarget.style.color = '#fff')}
                  onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
                >×</button>
              </div>
            ))}
            {trackPlaylists.length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>Not in any playlist</div>
            )}
          </div>
          {!showAddPlaylist ? (
            <button
              onClick={() => setShowAddPlaylist(true)}
              data-testid="add-to-playlist-btn"
              style={{
                background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                borderRadius: '7px', color: 'rgba(255,255,255,0.4)', padding: '7px 10px',
                fontSize: '12px', cursor: 'pointer', width: '100%',
              }}
            >+ Add to Playlist</button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {playlists.filter(pl => !trackPlaylists.includes(pl.id)).map(pl => (
                <button
                  key={pl.id}
                  onClick={() => addToPlaylist(pl.id)}
                  data-testid={`add-to-playlist-option-${pl.id}`}
                  style={{
                    background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
                    borderRadius: '7px', color: C.text, padding: '7px 10px',
                    fontSize: '12px', cursor: 'pointer', textAlign: 'left',
                  }}
                >{pl.name}</button>
              ))}
              <button
                onClick={() => setShowAddPlaylist(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '11px', padding: '4px 0' }}
              >Cancel</button>
            </div>
          )}
        </div>
      )}

      {/* Track notes */}
      <div style={{ padding: '16px 20px', flex: 1 }}>
        <div style={sectionLabel}>Notes</div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          <input
            value={newNoteText}
            onChange={e => setNewNoteText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addNote()}
            placeholder={`Note at ${fmtTime(playerCurrentTime)}…`}
            data-testid="note-input"
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${C.border}`,
              borderRadius: '7px',
              padding: '7px 10px',
              color: C.text,
              fontSize: '12px',
              outline: 'none',
            }}
          />
          <button
            onClick={addNote}
            disabled={!newNoteText.trim()}
            data-testid="add-note-btn"
            style={{
              background: C.red,
              border: 'none',
              borderRadius: '7px',
              color: '#fff',
              padding: '7px 10px',
              fontSize: '14px',
              cursor: 'pointer',
              opacity: newNoteText.trim() ? 1 : 0.35,
            }}
          >+</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {notes.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.18)', fontSize: '12px', padding: '8px 0' }}>No notes yet</div>
          )}
          {notes.map(n => (
            <div
              key={n.id}
              data-testid={`note-${n.id}`}
              style={{
                display: 'flex',
                gap: '8px',
                padding: '7px 10px',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: '7px',
                fontSize: '12px',
                alignItems: 'flex-start',
              }}
            >
              <span style={{ color: C.gold, fontFamily: 'monospace', fontSize: '10px', flexShrink: 0, paddingTop: '1px', opacity: 0.8 }}>
                {fmtTime(n.timestamp_sec)}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.75)', flex: 1, lineHeight: 1.4 }}>{n.text}</span>
              <button
                onClick={() => deleteNote(n.id)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', padding: '0', lineHeight: 1, fontSize: '14px', flexShrink: 0 }}
                onMouseOver={e => (e.currentTarget.style.color = '#fff')}
                onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
              >×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
