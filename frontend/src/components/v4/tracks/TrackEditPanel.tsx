import { useState, useEffect } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import type { MusicGeneration } from '../../../types';

interface TrackEditPanelProps {
  track: MusicGeneration;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  title: string;
  artist: string;
  genre: string;
  year: string;
  track_number: string;
  composer: string;
  lyrics_credit: string;
}

export default function TrackEditPanel({ track, onClose, onSaved }: TrackEditPanelProps) {
  const { activeProjectId, refreshTracks } = useWorkspace();
  const [form, setForm] = useState<FormState>({
    title: track.title ?? '',
    artist: track.artist ?? '',
    genre: track.genre ?? '',
    year: track.year?.toString() ?? '',
    track_number: track.track_number?.toString() ?? '',
    composer: track.composer ?? '',
    lyrics_credit: track.lyrics_credit ?? '',
  });
  const [bpm, setBpm] = useState<number | null>(null);
  const [keyStr, setKeyStr] = useState<string | null>(null);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(
    track.artwork_url ? `/api/projects/${activeProjectId}/artwork/${track.id}` : null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showGenerate, setShowGenerate] = useState(false);
  const [artPrompt, setArtPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/music/${track.id}/tags`)
      .then(r => r.json())
      .then((t: { bpm?: number; key_signature?: string }) => {
        if (t.bpm) setBpm(Math.round(t.bpm));
        if (t.key_signature) setKeyStr(t.key_signature);
      })
      .catch(() => {});
  }, [track.id]);

  useEffect(() => {
    if (!showGenerate || !track.lyrics_id || artPrompt) return;
    fetch(`/api/lyrics/${track.lyrics_id}`)
      .then(r => r.json())
      .then((l: { content?: string }) => {
        if (l.content) setArtPrompt(l.content.slice(0, 300));
      })
      .catch(() => {});
  }, [showGenerate, track.lyrics_id, artPrompt]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/music/${track.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title || null,
          artist: form.artist || null,
          genre: form.genre || null,
          year: form.year ? parseInt(form.year, 10) : null,
          track_number: form.track_number ? parseInt(form.track_number, 10) : null,
          composer: form.composer || null,
          lyrics_credit: form.lyrics_credit || null,
        }),
      });
      if (!res.ok) { setError('Save failed'); return; }
      refreshTracks();
      onSaved();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const generateArtwork = async () => {
    if (!artPrompt.trim() || !activeProjectId) return;
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
      if (!fetchRes.ok || !fetchData.imageData) { setGenError('Failed to fetch image'); return; }

      const saveRes = await fetch(`/api/projects/${activeProjectId}/artwork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ musicId: track.id, imageUrl: fetchData.imageData }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) { setGenError('Failed to save artwork'); return; }

      setArtworkUrl(saveData.artworkUrl + '?t=' + Date.now());
      setShowGenerate(false);
      setArtPrompt('');
    } catch {
      setGenError('Network error');
    } finally {
      setGenerating(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${C.border}`,
    borderRadius: '5px',
    padding: '5px 8px',
    color: C.text,
    fontSize: '12px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  const labelStyle: React.CSSProperties = {
    color: 'rgba(255,255,255,0.3)',
    fontSize: '9px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    display: 'block',
    marginBottom: '3px',
  };

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div style={{
      margin: '2px 0 8px 44px',
      background: 'rgba(0,0,0,0.3)',
      border: `1px solid rgba(230,57,70,0.15)`,
      borderRadius: '8px',
      padding: '14px',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: '14px' }}>

        {/* Artwork column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {artworkUrl ? (
            <img
              src={artworkUrl}
              alt="Track artwork"
              style={{ width: '96px', height: '96px', borderRadius: '6px', objectFit: 'cover', border: `1px solid ${C.border}` }}
            />
          ) : (
            <div style={{
              width: '96px', height: '96px', borderRadius: '6px',
              background: 'rgba(255,255,255,0.04)',
              border: `1px dashed rgba(230,57,70,0.3)`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '4px',
            }}>
              <span style={{ fontSize: '20px', color: 'rgba(230,57,70,0.3)' }}>🎨</span>
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>No Art</span>
            </div>
          )}
          <button
            onClick={() => setShowGenerate(v => !v)}
            style={{
              background: showGenerate ? 'rgba(230,57,70,0.12)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${showGenerate ? 'rgba(230,57,70,0.3)' : C.border}`,
              borderRadius: '5px',
              color: showGenerate ? C.red : C.textDim,
              fontSize: '11px', fontWeight: 600, padding: '5px 4px',
              cursor: 'pointer', width: '96px',
            }}
          >✦ Generate</button>
        </div>

        {/* Metadata fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Title</label>
            <input style={inputStyle} value={form.title} onChange={set('title')} placeholder="Track title" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Artist</label>
            <input style={inputStyle} value={form.artist} onChange={set('artist')} placeholder="Artist name" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Genre</label>
            <input style={inputStyle} value={form.genre} onChange={set('genre')} placeholder="Genre" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Year</label>
            <input style={inputStyle} value={form.year} onChange={set('year')} placeholder="2026" type="number" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Track #</label>
            <input style={inputStyle} value={form.track_number} onChange={set('track_number')} placeholder="1" type="number" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Composer</label>
            <input style={inputStyle} value={form.composer} onChange={set('composer')} placeholder="Composer" />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Lyrics By</label>
            <input style={inputStyle} value={form.lyrics_credit} onChange={set('lyrics_credit')} placeholder="Lyricist" />
          </div>
          {bpm !== null && (
            <div style={fieldStyle}>
              <label style={labelStyle}>BPM (auto)</label>
              <input style={{ ...inputStyle, color: 'rgba(255,255,255,0.35)', fontFamily: 'JetBrains Mono, monospace' }} value={bpm} readOnly />
            </div>
          )}
          {keyStr && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Key (auto)</label>
              <input style={{ ...inputStyle, color: 'rgba(255,255,255,0.35)', fontFamily: 'JetBrains Mono, monospace' }} value={keyStr} readOnly />
            </div>
          )}
        </div>
      </div>

      {showGenerate && (
        <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(230,57,70,0.06)', borderRadius: '6px', border: `1px solid rgba(230,57,70,0.15)` }}>
          <label style={labelStyle}>Artwork prompt {track.lyrics_id ? '(pre-filled from lyrics)' : ''}</label>
          <textarea
            value={artPrompt}
            onChange={e => setArtPrompt(e.target.value)}
            placeholder="Describe the artwork…"
            rows={3}
            style={{
              ...inputStyle,
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.5,
            }}
          />
          {genError && <div style={{ color: C.red, fontSize: '11px', marginTop: '4px' }}>{genError}</div>}
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            <button
              onClick={() => { setShowGenerate(false); setArtPrompt(''); setGenError(null); }}
              style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '5px', color: C.textDim, fontSize: '11px', padding: '5px 10px', cursor: 'pointer' }}
            >Cancel</button>
            <button
              onClick={generateArtwork}
              disabled={generating || !artPrompt.trim()}
              style={{
                background: C.red, border: 'none', borderRadius: '5px', color: '#fff',
                fontSize: '11px', fontWeight: 700, padding: '5px 12px', cursor: 'pointer',
                opacity: (generating || !artPrompt.trim()) ? 0.5 : 1,
              }}
            >{generating ? 'Generating…' : '✦ Generate'}</button>
          </div>
        </div>
      )}

      {error && <div style={{ color: C.red, fontSize: '11px', marginTop: '8px' }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '5px', color: C.textDim, fontSize: '12px', padding: '6px 14px', cursor: 'pointer' }}
        >Cancel</button>
        <button
          onClick={save}
          disabled={saving}
          style={{
            background: C.red, border: 'none', borderRadius: '5px', color: '#fff',
            fontSize: '12px', fontWeight: 700, padding: '6px 16px', cursor: 'pointer',
            opacity: saving ? 0.5 : 1,
          }}
        >{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  );
}
