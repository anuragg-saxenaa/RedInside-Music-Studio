import { useState, useEffect } from 'react';
import UploadZone from './UploadZone';
import VUMeter from './VUMeter';

interface FileInfo {
  id: string;
  filename: string;
  status: 'uploading' | 'idle' | 'processing' | 'mastering' | 'complete' | 'error';
  progress: number;
  duration?: number;
  bitrate?: string;
  error?: string;
  filePath?: string;
  selected?: boolean;
  musicId?: string;
  saved?: boolean;   // already saved to Music library (prevents duplicate saves)
  model?: string;    // source model — 'mastering' outputs are hidden from the list
}

interface AudioMasteringPanelProps {
  projectId: string;
  allMusic: any[];
  onSaved?: () => void;
}

export default function AudioMasteringPanel({ projectId, allMusic, onSaved }: AudioMasteringPanelProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [vuLevel, setVuLevel] = useState(0);
  const [query, setQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  // Load previously uploaded mastering files on mount
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/mastering/files/${projectId}`)
      .then(r => r.ok ? r.json() : { files: [] })
      .then(data => {
        if (!data.files?.length) return;
        setFiles(prev => {
          const existingIds = new Set(prev.map(f => f.id));
          const restored: FileInfo[] = data.files
            .filter((f: any) => !existingIds.has(f.id))
            .map((f: any) => ({
              id: f.id,
              filename: f.filename,
              status: (f.status === 'mastered' ? 'complete' : 'idle') as FileInfo['status'],
              progress: f.status === 'mastered' ? 100 : 0,
              duration: f.duration,
              filePath: f.originalPath,
            }));
          return [...prev, ...restored];
        });
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    if (!allMusic || allMusic.length === 0) return;
    setFiles(prev => {
      const existingMusicIds = new Set(prev.filter(f => f.musicId).map(f => f.musicId));
      const newTracks: FileInfo[] = allMusic
        .filter((m: any) => !existingMusicIds.has(m.id))
        .map((m: any) => ({
          id: m.id,
          filename: m.title || `Version ${m.version}`,
          status: 'idle' as const,
          progress: 0,
          duration: m.duration_seconds,
          musicId: m.id,
          model: m.model,
        }));
      const uploadedFiles = prev.filter(f => !f.musicId);
      return [...newTracks, ...uploadedFiles];
    });
  }, [allMusic]);

  const handleUploadComplete = (uploadedFiles: Array<{ id: string; filename: string; originalPath?: string }>) => {
    setFiles(prev => [...prev, ...uploadedFiles.map(f => ({ id: f.id, filename: f.filename, status: 'idle' as const, progress: 0, filePath: f.originalPath }))]);
  };

  const masterFile = async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'processing', progress: 5 } : f));

    const vuInterval = setInterval(() => {
      setVuLevel(prev => Math.min(85, prev + Math.random() * 20));
    }, 150);

    try {
      const body = file.musicId
        ? { musicId: file.musicId, projectId, preset: 'spotify' }
        : { fileId, projectId, preset: 'spotify', saveToProject: true };

      // Process returns a jobId immediately (async — avoids 60s Railway timeout).
      const response = await fetch('/api/mastering/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Processing failed');

      const jobId = data.jobId;
      if (!jobId) {
        // Legacy sync response (local dev without job system)
        clearInterval(vuInterval); setVuLevel(100);
        setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'complete', progress: 100, saved: true } : f));
        return;
      }

      // Poll until done
      let elapsed = 0;
      const poll = setInterval(async () => {
        elapsed += 2;
        try {
          const sr = await fetch(`/api/mastering/status/${jobId}`);
          const sj = await sr.json();
          const progress = sj.progress ?? Math.min(90, 5 + elapsed * 4);
          setFiles(prev => prev.map(f => f.id === fileId ? { ...f, progress } : f));
          if (sj.status === 'done') {
            clearInterval(poll); clearInterval(vuInterval); setVuLevel(100);
            // Atomically save THIS exact track to Music — no sticky-selection ambiguity.
            try {
              const saveRes = await fetch('/api/mastering/save-to-music', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, fileIds: [fileId] }),
              });
              if (saveRes.ok) onSaved?.();
            } catch { /* user can retry via Save button */ }
            setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'complete', progress: 100, saved: true } : f));
          } else if (sj.status === 'failed') {
            clearInterval(poll); clearInterval(vuInterval); setVuLevel(0);
            setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'error', error: sj.error || 'Mastering failed', progress: 0 } : f));
          }
        } catch { /* ignore poll errors */ }
      }, 2000);
    } catch (err: any) {
      clearInterval(vuInterval); setVuLevel(0);
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'error', error: err.message } : f));
    }
  };

  // Master every track that isn't already mastered/processing.
  const masterAll = async () => {
    const todo = files.filter(f => f.model !== 'mastering' && (f.status === 'idle' || f.status === 'error') && !f.saved);
    for (const file of todo) await masterFile(file.id);
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Titles that already have a saved mastered version (from a prior session) —
  // used to block duplicate mastering. A master is stored as "<title> (Mastered)".
  const alreadyMasteredTitles = new Set(
    (allMusic || [])
      .filter((m: any) => m.model === 'mastering' && typeof m.title === 'string')
      .map((m: any) => m.title.replace(/\s*\(Mastered\)\s*$/i, '').trim().toLowerCase())
  );
  const isAlreadyMastered = (f: FileInfo) =>
    f.saved || f.status === 'complete' || alreadyMasteredTitles.has((f.filename || '').replace(/\s*\(Mastered\)\s*$/i, '').trim().toLowerCase());

  // Masterable rows: hide mastered outputs (can't master a master) + apply search.
  const q = query.trim().toLowerCase();
  const masterableFiles = files
    .filter(f => f.model !== 'mastering')
    .filter(f => !q || (f.filename || '').toLowerCase().includes(q));
  const masteredCount = files.filter(f => isAlreadyMastered(f) && f.model !== 'mastering').length;
  const anyUnmastered = files.some(f => f.model !== 'mastering' && !isAlreadyMastered(f) && f.status !== 'processing');

  const formatDuration = (seconds: number) => {
    const m = Math.floor((seconds || 0) / 60);
    const s = Math.floor((seconds || 0) % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <style>{`
        @keyframes ms-spin { to { transform: rotate(360deg); } }
        @keyframes ms-rise { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
        .ms-row { animation: ms-rise 320ms cubic-bezier(0.22,1,0.36,1) backwards; }
        .ms-master-btn:not(:disabled):active { transform: scale(0.94); }
        .ms-list::-webkit-scrollbar { width: 7px; }
        .ms-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
        .ms-list::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      <div style={{
        background: 'linear-gradient(165deg, rgba(30,10,16,0.6), rgba(12,5,9,0.6))',
        border: '1px solid rgba(230,57,70,0.16)',
        borderRadius: 18,
        overflow: 'hidden',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        fontFamily: "'Outfit','DM Sans',sans-serif",
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#E63946,#9e1b27)', boxShadow: '0 4px 16px rgba(230,57,70,0.35)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>Mastering</div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}>Spotify-loudness master · one tap per track</div>
          </div>
          <VUMeter level={vuLevel} isActive={files.some(f => f.status === 'processing')} />
        </div>

        {/* Search + Master all */}
        <div style={{ padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 11, padding: '0 12px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" /></svg>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tracks…"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 13.5, padding: '10px 0', fontFamily: 'inherit' }} />
            {query && <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 15 }}>✕</button>}
          </div>
          {anyUnmastered && (
            <button onClick={masterAll} style={{ flexShrink: 0, background: 'rgba(230,57,70,0.14)', border: '1px solid rgba(230,57,70,0.35)', color: '#ff6b76', borderRadius: 11, fontSize: 12.5, fontWeight: 700, padding: '10px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Master all
            </button>
          )}
        </div>

        {/* Track list */}
        <div className="ms-list" style={{ maxHeight: 'min(56vh, 460px)', overflowY: 'auto', padding: '10px 12px' }}>
          {masterableFiles.length === 0 && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '36px 0' }}>
              {files.length === 0 ? 'No tracks yet. Generate or upload audio to master.' : 'No tracks match your search.'}
            </div>
          )}
          {masterableFiles.map((file, i) => {
            const processing = file.status === 'processing';
            const errored = file.status === 'error';
            const mastered = isAlreadyMastered(file);
            const isUpload = !file.musicId;
            return (
              <div className="ms-row" key={file.id} data-testid="file-item" style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', marginBottom: 7,
                background: mastered ? 'rgba(0,210,106,0.06)' : 'rgba(255,255,255,0.035)',
                border: `1px solid ${mastered ? 'rgba(0,210,106,0.18)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 13, animationDelay: `${Math.min(i, 10) * 22}ms`,
                transition: 'background 200ms, border-color 200ms',
              }}>
                {/* Icon */}
                <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: mastered ? 'rgba(0,210,106,0.14)' : 'rgba(255,255,255,0.06)' }}>
                  {mastered
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00d26a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2"><path d="M9 18V5l11-2v13" strokeLinecap="round" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></svg>}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.filename}</div>
                  <div style={{ fontSize: 11, color: errored ? '#ff7a85' : 'rgba(255,255,255,0.4)', marginTop: 1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {errored ? (file.error || 'Mastering failed — tap Retry') : `${formatDuration(file.duration || 0)}${mastered ? ' · Mastered' : ' · −14 LUFS · 24-bit'}`}
                  </div>
                  {processing && (
                    <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.1)', marginTop: 7, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${file.progress || 5}%`, background: 'linear-gradient(90deg,#E63946,#ff8a3c)', borderRadius: 2, transition: 'width 400ms ease' }} />
                    </div>
                  )}
                </div>
                {/* Action */}
                <button
                  className="ms-master-btn"
                  data-testid="master-btn"
                  onClick={() => { if (!processing && !mastered) masterFile(file.id); }}
                  disabled={processing || mastered}
                  style={{
                    flexShrink: 0, minWidth: 92, height: 38, borderRadius: 11, cursor: (processing || mastered) ? 'default' : 'pointer',
                    fontSize: 12.5, fontWeight: 700, letterSpacing: '0.01em', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'transform 120ms, background 200ms',
                    background: mastered ? 'rgba(0,210,106,0.14)' : errored ? 'rgba(230,57,70,0.18)' : 'linear-gradient(135deg,#E63946,#b8232e)',
                    color: mastered ? '#00d26a' : '#fff',
                    boxShadow: (processing || mastered || errored) ? 'none' : '0 4px 16px rgba(230,57,70,0.3)',
                  }}
                >
                  {processing
                    ? <><span style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', display: 'inline-block', animation: 'ms-spin 0.7s linear infinite' }} />{file.progress || 0}%</>
                    : mastered ? 'Mastered ✓'
                    : errored ? 'Retry'
                    : 'Master'}
                </button>
                {/* Remove (uploaded files only) */}
                {isUpload && !processing && (
                  <button onClick={() => removeFile(file.id)} title="Remove" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✕</button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer: upload toggle + stats */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setShowUpload(v => !v)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            Upload audio
          </button>
          <div style={{ flex: 1 }} />
          {masteredCount > 0 && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}><strong style={{ color: '#00d26a' }}>{masteredCount}</strong> mastered</span>}
        </div>
        {showUpload && (
          <div style={{ padding: '0 16px 16px' }}>
            <UploadZone projectId={projectId} onUploadComplete={handleUploadComplete} multiple={true} dataTestId="upload-zone" />
          </div>
        )}
      </div>
    </>
  );
}
