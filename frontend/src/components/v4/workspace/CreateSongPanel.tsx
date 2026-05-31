import { useState, useEffect, useRef, useCallback } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { useAuthFetch } from '../../../hooks/useAuthFetch';
import type { LyricsGeneration } from '../../../types';

type LyricsSource = 'instrumental' | 'existing' | 'write';

const MUSIC_STYLES = [
  { label: 'Hip-Hop', value: 'hip-hop' },
  { label: 'Trap / Drill', value: 'trap' },
  { label: 'Pop', value: 'pop' },
  { label: 'R&B', value: 'rnb' },
  { label: 'Lo-fi', value: 'lofi' },
  { label: 'Electronic', value: 'electronic' },
  { label: 'Rock', value: 'rock' },
];

const LYRIC_PRESETS = [
  { label: 'Hinglish Urban', value: 'hinglish-urban' },
  { label: 'Hindi/Urdu Classical', value: 'hindi-urdu-classical' },
  { label: 'Punjabi Swagger', value: 'punjabi-swagger' },
  { label: 'Regional Fusion', value: 'regional-fusion' },
  { label: 'Custom', value: 'custom' },
];

interface Props {
  onDone: () => void;
}

export default function CreateSongPanel({ onDone }: Props) {
  const { activeProjectId, refreshTracks } = useWorkspace();
  const authFetch = useAuthFetch();

  const [source, setSource] = useState<LyricsSource>('write');
  const [existingLyrics, setExistingLyrics] = useState<LyricsGeneration[]>([]);
  const [chosenLyricsId, setChosenLyricsId] = useState<string>('');

  // Write-new state
  const [lyricPrompt, setLyricPrompt] = useState('');
  const [lyricPreset, setLyricPreset] = useState('hinglish-urban');
  const [generatingLyrics, setGeneratingLyrics] = useState(false);
  const [generatedLyrics, setGeneratedLyrics] = useState<LyricsGeneration | null>(null);

  // Music state
  const [musicStyle, setMusicStyle] = useState('hip-hop');
  const [musicPrompt, setMusicPrompt] = useState('');
  const [generatingMusic, setGeneratingMusic] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load existing lyrics for the project
  useEffect(() => {
    if (!activeProjectId) return;
    authFetch(`/api/projects/${activeProjectId}/lyrics`)
      .then(r => r.json())
      .then((list: LyricsGeneration[]) => {
        setExistingLyrics(Array.isArray(list) ? list : []);
        if (Array.isArray(list) && list.length > 0) setChosenLyricsId(list[0].id);
      })
      .catch(() => setExistingLyrics([]));
  }, [activeProjectId, authFetch]);

  // The effective lyricsId to send (null for instrumental)
  const effectiveLyricsId = (() => {
    if (source === 'instrumental') return null;
    if (source === 'existing') return chosenLyricsId || null;
    if (source === 'write') return generatedLyrics?.id || null;
    return null;
  })();

  const canGenerate = source === 'instrumental' || !!effectiveLyricsId;

  const handleGenerateLyrics = useCallback(async () => {
    if (!lyricPrompt.trim() || !activeProjectId) return;
    setGeneratingLyrics(true);
    setError(null);
    try {
      const r = await authFetch('/api/lyrics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProjectId, prompt: lyricPrompt.trim(), stylePreset: lyricPreset }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Lyrics generation failed');
      setGeneratedLyrics(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGeneratingLyrics(false);
    }
  }, [lyricPrompt, lyricPreset, activeProjectId, authFetch]);

  const handleGenerateMusic = useCallback(async () => {
    if (!canGenerate || !activeProjectId || generatingMusic) return;
    setGeneratingMusic(true);
    setError(null);
    setProgress(5);
    try {
      const prompt = [musicStyle && `[${musicStyle} style]`, musicPrompt].filter(Boolean).join(' ') || undefined;
      const r = await authFetch('/api/music/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProjectId,
          lyricsId: effectiveLyricsId || undefined,
          isInstrumental: source === 'instrumental',
          prompt,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Music generation failed');
      setJobId(data.jobId);
    } catch (e) {
      setError((e as Error).message);
      setGeneratingMusic(false);
    }
  }, [canGenerate, activeProjectId, generatingMusic, musicStyle, musicPrompt, effectiveLyricsId, source, authFetch]);

  // Poll job status
  useEffect(() => {
    if (!jobId) return;
    let fakeProg = 10;
    pollRef.current = setInterval(async () => {
      fakeProg = Math.min(90, fakeProg + 8);
      setProgress(p => Math.max(p, fakeProg));
      try {
        const r = await authFetch(`/api/jobs/${jobId}`);
        if (!r.ok) return;
        const job = await r.json();
        if (job.status === 'completed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setProgress(100);
          setGeneratingMusic(false);
          setJobId(null);
          refreshTracks();
          setTimeout(onDone, 600);
        } else if (job.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setError(job.error_message || 'Generation failed');
          setGeneratingMusic(false);
          setJobId(null);
        }
      } catch { /* keep polling */ }
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId, refreshTracks, onDone, authFetch]);

  const cardStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '12px 10px', borderRadius: '10px', cursor: 'pointer',
    border: `1px solid ${active ? C.borderActive : C.border}`,
    background: active ? `${C.red}14` : 'rgba(255,255,255,0.03)',
    textAlign: 'center', transition: 'all 150ms',
  });

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(0,0,0,0.3)', border: `1px solid ${C.border}`,
    borderRadius: '8px', padding: '10px 12px', color: C.text, fontSize: '13px',
    outline: 'none', fontFamily: "'DM Sans', sans-serif",
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* STEP 1 — Lyrics source */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', color: C.textDim, marginBottom: '8px', textTransform: 'uppercase' }}>
          1 · Lyrics
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div onClick={() => setSource('write')} style={cardStyle(source === 'write')}>
            <div style={{ fontSize: '18px', marginBottom: '2px' }}>✎</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: source === 'write' ? C.red : C.text }}>Write New</div>
          </div>
          <div onClick={() => setSource('existing')} style={cardStyle(source === 'existing')}>
            <div style={{ fontSize: '18px', marginBottom: '2px' }}>≡</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: source === 'existing' ? C.red : C.text }}>Use Existing</div>
          </div>
          <div onClick={() => setSource('instrumental')} style={cardStyle(source === 'instrumental')}>
            <div style={{ fontSize: '18px', marginBottom: '2px' }}>🎹</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: source === 'instrumental' ? C.red : C.text }}>Instrumental</div>
          </div>
        </div>
      </div>

      {/* Write new lyrics */}
      {source === 'write' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
          {generatedLyrics ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: C.red, letterSpacing: '0.5px' }}>✓ LYRICS READY</span>
                <button onClick={() => { setGeneratedLyrics(null); }} style={{ background: 'none', border: 'none', color: C.textDim, fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}>Regenerate</button>
              </div>
              <div style={{ maxHeight: '120px', overflowY: 'auto', fontSize: '12px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'pre-wrap', lineHeight: 1.5, padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
                {generatedLyrics.content?.slice(0, 400)}{(generatedLyrics.content?.length ?? 0) > 400 ? '…' : ''}
              </div>
            </div>
          ) : (
            <>
              <select value={lyricPreset} onChange={e => setLyricPreset(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {LYRIC_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <textarea
                value={lyricPrompt}
                onChange={e => setLyricPrompt(e.target.value)}
                placeholder="What's the song about? (e.g. 'late night drive through the city, chasing dreams')"
                style={{ ...inputStyle, height: '60px', resize: 'none' }}
              />
              <button
                onClick={handleGenerateLyrics}
                disabled={!lyricPrompt.trim() || generatingLyrics}
                style={{
                  padding: '9px 16px', borderRadius: '8px', border: 'none', alignSelf: 'flex-start',
                  background: (!lyricPrompt.trim() || generatingLyrics) ? 'rgba(255,255,255,0.08)' : C.red,
                  color: '#fff', fontSize: '12px', fontWeight: 600,
                  cursor: (!lyricPrompt.trim() || generatingLyrics) ? 'default' : 'pointer',
                }}
              >
                {generatingLyrics ? 'Writing lyrics…' : '✎ Generate Lyrics'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Existing lyrics picker */}
      {source === 'existing' && (
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
          {existingLyrics.length === 0 ? (
            <div style={{ color: C.textDim, fontSize: '12px', textAlign: 'center', padding: '8px' }}>
              No lyrics in this project yet. Switch to "Write New".
            </div>
          ) : (
            <select value={chosenLyricsId} onChange={e => setChosenLyricsId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              {existingLyrics.map(l => (
                <option key={l.id} value={l.id}>{l.title || `Lyrics v${l.version}`}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* STEP 2 — Music style */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', color: C.textDim, marginBottom: '8px', textTransform: 'uppercase' }}>
          2 · Music Style
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
          {MUSIC_STYLES.map(s => (
            <button key={s.value} onClick={() => setMusicStyle(s.value)} style={{
              padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${musicStyle === s.value ? C.borderActive : C.border}`,
              background: musicStyle === s.value ? `${C.red}1a` : 'rgba(255,255,255,0.03)',
              color: musicStyle === s.value ? C.red : 'rgba(255,255,255,0.6)',
            }}>{s.label}</button>
          ))}
        </div>
        <textarea
          value={musicPrompt}
          onChange={e => setMusicPrompt(e.target.value)}
          placeholder="Optional: describe the vibe (e.g. 'heavy 808s, dark melody, 140 bpm')"
          style={{ ...inputStyle, height: '50px', resize: 'none' }}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{ color: '#ff6b6b', fontSize: '12px', padding: '8px 12px', background: 'rgba(255,107,107,0.1)', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {/* Progress */}
      {generatingMusic && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: C.textDim, marginBottom: '4px' }}>
            <span>Generating music…</span><span>{progress}%</span>
          </div>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: C.red, transition: 'width 0.4s ease' }} />
          </div>
        </div>
      )}

      {/* STEP 3 — Generate */}
      <button
        onClick={handleGenerateMusic}
        disabled={!canGenerate || generatingMusic}
        data-testid="create-song-generate"
        style={{
          padding: '13px 24px', borderRadius: '10px', border: 'none',
          background: (!canGenerate || generatingMusic) ? 'rgba(255,255,255,0.08)' : `linear-gradient(135deg, ${C.red}, ${C.redDark})`,
          color: (!canGenerate || generatingMusic) ? 'rgba(255,255,255,0.4)' : '#fff',
          fontSize: '14px', fontWeight: 700, cursor: (!canGenerate || generatingMusic) ? 'default' : 'pointer',
          boxShadow: (!canGenerate || generatingMusic) ? 'none' : `0 4px 20px ${C.red}44`,
          transition: 'all 200ms',
        }}
      >
        {generatingMusic ? 'Generating…' : '⚡ Generate Song'}
      </button>
      {!canGenerate && (
        <div style={{ fontSize: '11px', color: C.textDim, textAlign: 'center', marginTop: '-8px' }}>
          {source === 'write' ? 'Generate lyrics first, or pick another source' : 'Choose lyrics to continue'}
        </div>
      )}
    </div>
  );
}
