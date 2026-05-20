import { useState, useEffect, useRef } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import type { Album, MusicGeneration } from '../../../types';

export default function AlbumTab() {
  const { activeProjectId, tracks } = useWorkspace();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [albumTracks, setAlbumTracks] = useState<MusicGeneration[]>([]);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ title: '', artist: '', year: '', genre: '', label: '' });
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [artPrompt, setArtPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragSrcIdx = useRef<number | null>(null);

  const selectedAlbum = albums.find(a => a.id === selectedAlbumId) ?? null;

  const loadAlbums = () => {
    if (!activeProjectId) return;
    fetch(`/api/projects/${activeProjectId}/albums`)
      .then(r => r.json())
      .then((list: Album[]) => setAlbums(list))
      .catch(() => {});
  };

  useEffect(loadAlbums, [activeProjectId]);

  const loadAlbumTracks = (albumId: string) => {
    fetch(`/api/projects/${activeProjectId}/albums/${albumId}/tracks`)
      .then(r => r.json())
      .then((list: MusicGeneration[]) => setAlbumTracks(list))
      .catch(() => {});
  };

  const selectAlbum = (album: Album) => {
    setSelectedAlbumId(album.id);
    setForm({
      title: album.title,
      artist: album.artist ?? '',
      year: album.year?.toString() ?? '',
      genre: album.genre ?? '',
      label: album.label ?? '',
    });
    setArtworkUrl(album.artwork_path ? `/api/projects/${activeProjectId}/albums/${album.id}/artwork` : null);
    setShowGenerate(false);
    loadAlbumTracks(album.id);
  };

  const createAlbum = async () => {
    if (!activeProjectId) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${activeProjectId}/albums`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Album' }),
      });
      const album: Album = await res.json();
      setAlbums(prev => [album, ...prev]);
      selectAlbum(album);
    } finally { setCreating(false); }
  };

  const saveAlbum = async () => {
    if (!selectedAlbumId || !activeProjectId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${activeProjectId}/albums/${selectedAlbumId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title || 'Untitled Album',
          artist: form.artist || null,
          year: form.year ? parseInt(form.year, 10) : null,
          genre: form.genre || null,
          label: form.label || null,
        }),
      });
      const updated: Album = await res.json();
      setAlbums(prev => prev.map(a => a.id === updated.id ? updated : a));
    } finally { setSaving(false); }
  };

  const deleteAlbum = async () => {
    if (!selectedAlbumId || !activeProjectId) return;
    if (!confirm(`Delete album "${selectedAlbum?.title}"? This cannot be undone.`)) return;
    await fetch(`/api/projects/${activeProjectId}/albums/${selectedAlbumId}`, { method: 'DELETE' });
    setAlbums(prev => prev.filter(a => a.id !== selectedAlbumId));
    setSelectedAlbumId(null);
    setAlbumTracks([]);
  };

  const addTrack = async (musicId: string) => {
    if (!selectedAlbumId || !activeProjectId) return;
    await fetch(`/api/projects/${activeProjectId}/albums/${selectedAlbumId}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ musicId }),
    });
    loadAlbumTracks(selectedAlbumId);
  };

  const removeTrack = async (musicId: string) => {
    if (!selectedAlbumId || !activeProjectId) return;
    await fetch(`/api/projects/${activeProjectId}/albums/${selectedAlbumId}/tracks/${musicId}`, { method: 'DELETE' });
    setAlbumTracks(prev => prev.filter(t => t.id !== musicId));
  };

  const reorder = async (newOrder: MusicGeneration[]) => {
    if (!selectedAlbumId || !activeProjectId) return;
    setAlbumTracks(newOrder);
    await fetch(`/api/projects/${activeProjectId}/albums/${selectedAlbumId}/tracks/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: newOrder.map(t => t.id) }),
    });
  };

  const generateCover = async () => {
    if (!artPrompt.trim() || !activeProjectId || !selectedAlbumId) return;
    setGenerating(true);
    setGenError(null);
    try {
      const genRes = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProjectId, prompt: artPrompt.trim(), aspectRatio: '1:1', n: 1 }),
      });
      const genData = await genRes.json();
      if (!genRes.ok || genData.error) { setGenError(genData.error || 'Generation failed'); return; }

      const imageUrl = genData.imageUrls?.[0];
      if (!imageUrl) { setGenError('No image returned'); return; }

      const fetchRes = await fetch(`/api/projects/${activeProjectId}/artwork/fetch-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });
      const fetchData = await fetchRes.json();
      if (!fetchRes.ok || !fetchData.base64) { setGenError('Failed to fetch image'); return; }

      const saveRes = await fetch(`/api/projects/${activeProjectId}/albums/${selectedAlbumId}/artwork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: fetchData.base64 }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) { setGenError('Failed to save artwork'); return; }

      setArtworkUrl(saveData.artworkUrl + '?t=' + Date.now());
      setShowGenerate(false);
      setArtPrompt('');
    } catch { setGenError('Network error'); }
    finally { setGenerating(false); }
  };

  const tracksNotInAlbum = tracks.filter(t => !albumTracks.some(at => at.id === t.id));

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
    borderRadius: '5px', padding: '6px 10px', color: C.text, fontSize: '12px',
    outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
  };

  const labelStyle: React.CSSProperties = {
    color: 'rgba(255,255,255,0.3)', fontSize: '9px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '3px',
  };

  if (!activeProjectId) {
    return <div data-testid="album-tab" style={{ color: C.textDim, textAlign: 'center', padding: '48px 0' }}>Select a project first</div>;
  }

  return (
    <div data-testid="album-tab" style={{ display: 'flex', gap: '16px', height: '100%' }}>

      {/* Left: album list */}
      <div style={{ width: '180px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <button
          onClick={createAlbum}
          disabled={creating}
          data-testid="create-album-btn"
          style={{
            background: C.red, border: 'none', borderRadius: '7px', color: '#fff',
            fontSize: '12px', fontWeight: 700, padding: '8px', cursor: 'pointer',
            opacity: creating ? 0.5 : 1,
          }}
        >+ New Album</button>

        {albums.length === 0 && (
          <div style={{ color: C.textDim, fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>
            No albums yet
          </div>
        )}

        {albums.map(album => (
          <div
            key={album.id}
            role="button"
            tabIndex={0}
            data-testid={`album-item-${album.id}`}
            onClick={() => selectAlbum(album)}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && selectAlbum(album)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px', borderRadius: '7px', cursor: 'pointer',
              background: selectedAlbumId === album.id ? 'rgba(230,57,70,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${selectedAlbumId === album.id ? 'rgba(230,57,70,0.3)' : C.border}`,
            }}
          >
            {album.artwork_path ? (
              <img src={`/api/projects/${activeProjectId}/albums/${album.id}/artwork`} alt="" style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: '36px', height: '36px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px' }}>◈</div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{album.title}</div>
              <div style={{ fontSize: '10px', color: C.textDim }}>{album.track_count ?? 0} tracks</div>
            </div>
          </div>
        ))}
      </div>

      {/* Right: editor */}
      {selectedAlbum ? (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>

          {/* Cover + fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {artworkUrl ? (
                <img src={artworkUrl} alt="Album cover" style={{ width: '120px', height: '120px', borderRadius: '8px', objectFit: 'cover', border: `1px solid ${C.border}` }} />
              ) : (
                <div style={{ width: '120px', height: '120px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: `1px dashed ${C.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '28px', color: 'rgba(255,255,255,0.15)' }}>◈</span>
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase' }}>No Cover</span>
                </div>
              )}
              <button
                onClick={() => setShowGenerate(v => !v)}
                style={{
                  background: showGenerate ? 'rgba(230,57,70,0.1)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${showGenerate ? 'rgba(230,57,70,0.3)' : C.border}`,
                  borderRadius: '5px', color: showGenerate ? C.red : C.textDim,
                  fontSize: '11px', fontWeight: 600, padding: '5px', cursor: 'pointer',
                }}
              >✦ Generate Cover</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={labelStyle}>Album Title</label>
                <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Album title" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>Artist</label>
                  <input style={inputStyle} value={form.artist} onChange={e => setForm(f => ({ ...f, artist: e.target.value }))} placeholder="Artist" />
                </div>
                <div>
                  <label style={labelStyle}>Year</label>
                  <input style={inputStyle} value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} placeholder="2026" type="number" />
                </div>
                <div>
                  <label style={labelStyle}>Genre</label>
                  <input style={inputStyle} value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))} placeholder="Genre" />
                </div>
                <div>
                  <label style={labelStyle}>Label</label>
                  <input style={inputStyle} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Optional" />
                </div>
              </div>
            </div>
          </div>

          {/* Artwork generate panel */}
          {showGenerate && (
            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: '7px' }}>
              <label style={labelStyle}>Cover art prompt</label>
              <textarea
                value={artPrompt}
                onChange={e => setArtPrompt(e.target.value)}
                placeholder="Describe the album cover…"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              />
              {genError && <div style={{ color: C.red, fontSize: '11px', marginTop: '4px' }}>{genError}</div>}
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <button onClick={() => { setShowGenerate(false); setArtPrompt(''); setGenError(null); }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '5px', color: C.textDim, fontSize: '11px', padding: '5px 10px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={generateCover} disabled={generating || !artPrompt.trim()} style={{ background: C.red, border: 'none', borderRadius: '5px', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '5px 12px', cursor: 'pointer', opacity: (generating || !artPrompt.trim()) ? 0.5 : 1 }}>{generating ? 'Generating…' : '✦ Generate'}</button>
              </div>
            </div>
          )}

          {/* Tracklist */}
          <div>
            <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.4px', marginBottom: '8px' }}>
              Tracklist — drag to reorder
            </div>

            {albumTracks.map((t, idx) => (
              <div
                key={t.id}
                draggable
                onDragStart={() => { dragSrcIdx.current = idx; }}
                onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
                onDragLeave={() => setDragOverIdx(null)}
                onDrop={() => {
                  setDragOverIdx(null);
                  if (dragSrcIdx.current === null || dragSrcIdx.current === idx) return;
                  const next = [...albumTracks];
                  const [moved] = next.splice(dragSrcIdx.current, 1);
                  next.splice(idx, 0, moved);
                  dragSrcIdx.current = null;
                  reorder(next);
                }}
                onDragEnd={() => { dragSrcIdx.current = null; setDragOverIdx(null); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 8px', borderRadius: '6px', marginBottom: '4px',
                  background: dragOverIdx === idx ? 'rgba(230,57,70,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${dragOverIdx === idx ? 'rgba(230,57,70,0.2)' : C.border}`,
                  cursor: 'grab',
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px', userSelect: 'none' }}>⠿</span>
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', width: '16px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}>{idx + 1}</span>
                <span style={{ flex: 1, fontSize: '12px', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.title || `Track v${t.version}`}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}>
                  {t.duration_seconds ? `${Math.floor(t.duration_seconds / 60)}:${String(Math.floor(t.duration_seconds % 60)).padStart(2, '0')}` : '—'}
                </span>
                <button
                  onClick={() => removeTrack(t.id)}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: '13px', padding: '0 2px', lineHeight: 1 }}
                  onMouseOver={e => (e.currentTarget.style.color = C.red)}
                  onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
                >✕</button>
              </div>
            ))}

            {tracksNotInAlbum.length > 0 && (
              <select
                onChange={e => { if (e.target.value) { addTrack(e.target.value); e.target.value = ''; } }}
                defaultValue=""
                style={{ ...inputStyle, marginTop: '4px', cursor: 'pointer' }}
              >
                <option value="">+ Add track from project…</option>
                {tracksNotInAlbum.map(t => (
                  <option key={t.id} value={t.id}>{t.title || `Track v${t.version}`}</option>
                ))}
              </select>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
            <button
              onClick={deleteAlbum}
              style={{ background: 'none', border: `1px solid rgba(230,57,70,0.3)`, borderRadius: '6px', color: C.red, fontSize: '12px', padding: '7px 14px', cursor: 'pointer' }}
            >Delete Album</button>
            <button
              onClick={saveAlbum}
              disabled={saving}
              data-testid="save-album-btn"
              style={{ background: C.red, border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: 700, padding: '7px 20px', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
            >{saving ? 'Saving…' : 'Save Album'}</button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textDim, fontSize: '13px' }}>
          Select an album or create a new one
        </div>
      )}
    </div>
  );
}
