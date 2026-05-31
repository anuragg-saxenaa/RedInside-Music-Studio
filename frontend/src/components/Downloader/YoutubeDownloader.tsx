import { useState, useEffect, useRef, useCallback } from 'react';

// Inject keyframes once at module level
let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes ytPulse{0%,100%{opacity:1}50%{opacity:.3}}
    @keyframes ytBar1{0%,100%{height:4px}50%{height:22px}}
    @keyframes ytBar2{0%,100%{height:14px}50%{height:6px}}
    @keyframes ytBar3{0%,100%{height:8px}50%{height:20px}}
    @keyframes ytBar4{0%,100%{height:18px}50%{height:5px}}
    @keyframes ytBar5{0%,100%{height:6px}50%{height:16px}}
    @keyframes ytScan{0%{left:-40%}100%{left:130%}}
    @keyframes ytFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    @keyframes ytShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-5px)}40%,80%{transform:translateX(5px)}}
    @keyframes ytGlow{0%,100%{box-shadow:0 0 14px rgba(230,57,70,.25)}50%{box-shadow:0 0 28px rgba(230,57,70,.65)}}
    @keyframes ytCaptureLine{0%{width:0;opacity:1}90%{opacity:1}100%{width:100%;opacity:0}}
  `;
  document.head.appendChild(s);
}

interface YoutubeDownloaderProps {
  projectId: string;
  onDownloaded?: (musicId: string, title: string) => void;
}

type DlState = 'idle' | 'running' | 'done' | 'error';

const BARS: [string, string][] = [
  ['ytBar1', '0.42s'],
  ['ytBar2', '0.55s'],
  ['ytBar3', '0.48s'],
  ['ytBar4', '0.61s'],
  ['ytBar5', '0.38s'],
];

const YT_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export default function YoutubeDownloader({ projectId, onDownloaded }: YoutubeDownloaderProps) {
  useEffect(() => { injectStyles(); }, []);

  const [url, setUrl] = useState('');
  const [dlState, setDlState] = useState<DlState>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [result, setResult] = useState<{ musicId: string; title: string; duration?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [stalledSec, setStalledSec] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const stalledRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // WebSocket event listener
  useEffect(() => {
    if (!downloadId) return;
    const handler = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.downloadId !== downloadId) return;
        if (data.event === 'download.progress') {
          setProgress(data.progress ?? 0);
          setMessage(data.message ?? '');
        } else if (data.event === 'download.completed') {
          if (stalledRef.current) { clearInterval(stalledRef.current); stalledRef.current = null; }
          setDlState('done');
          setResult({ musicId: data.result.musicId, title: data.result.title, duration: data.result.duration });
          onDownloaded?.(data.result.musicId, data.result.title);
        } else if (data.event === 'download.failed') {
          if (stalledRef.current) { clearInterval(stalledRef.current); stalledRef.current = null; }
          setDlState('error');
          setError(data.error || 'Download failed');
        }
      } catch { /* ignore */ }
    };
    const ws = (window as unknown as Record<string, unknown>).__studioWs as WebSocket | undefined;
    ws?.addEventListener('message', handler);

    // Polling fallback — works even when WebSocket events don't reach the client
    const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/downloader/status/${downloadId}`);
        if (!r.ok) return;
        const s = await r.json();
        if (typeof s.progress === 'number') { setProgress(s.progress); if (s.message) setMessage(s.message); }
        if (s.state === 'done' && s.result) {
          clearInterval(poll);
          if (stalledRef.current) { clearInterval(stalledRef.current); stalledRef.current = null; }
          setDlState('done');
          setResult({ musicId: s.result.musicId, title: s.result.title, duration: s.result.duration });
          onDownloaded?.(s.result.musicId, s.result.title);
        } else if (s.state === 'error') {
          clearInterval(poll);
          if (stalledRef.current) { clearInterval(stalledRef.current); stalledRef.current = null; }
          setDlState('error');
          setError(s.error || 'Download failed');
        }
      } catch { /* ignore poll errors */ }
    }, 2000);

    return () => { ws?.removeEventListener('message', handler); clearInterval(poll); };
  }, [downloadId, onDownloaded]);

  const isValidUrl = url.trim().length > 10 && (url.includes('youtube.com') || url.includes('youtu.be'));

  const handleDownload = useCallback(async () => {
    if (!isValidUrl || dlState === 'running') return;
    setDlState('running');
    setProgress(2);
    setStalledSec(0);
    setMessage('Connecting...');
    setError(null);
    setResult(null);
    if (stalledRef.current) clearInterval(stalledRef.current);
    stalledRef.current = setInterval(() => setStalledSec(s => s + 1), 1000);
    try {
      const res = await fetch('/api/downloader/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setDownloadId(data.downloadId);
    } catch (e) {
      setDlState('error');
      setError((e as Error).message);
    }
  }, [url, projectId, dlState, isValidUrl]);

  const reset = () => {
    if (stalledRef.current) { clearInterval(stalledRef.current); stalledRef.current = null; }
    setDlState('idle');
    setUrl('');
    setProgress(0);
    setStalledSec(0);
    setDownloadId(null);
    setResult(null);
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const formatDuration = (s?: number) => {
    if (!s) return '';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  const statusColor = dlState === 'running' ? '#FFB800' : dlState === 'done' ? '#00D26A' : dlState === 'error' ? '#E63946' : 'rgba(255,255,255,0.25)';
  const statusLabel = dlState === 'running' ? 'CAPTURING' : dlState === 'done' ? 'CAPTURED' : dlState === 'error' ? 'FAILED' : 'READY';

  return (
    <div style={{
      background: 'linear-gradient(145deg, rgba(7,7,26,0.97) 0%, rgba(14,7,26,0.97) 100%)',
      border: '1px solid rgba(230,57,70,0.18)',
      borderRadius: 14,
      padding: '18px 22px',
      marginBottom: 20,
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 4px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>

      {/* Corner glow */}
      <div style={{
        position: 'absolute', top: -80, right: -80, width: 240, height: 240, pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(230,57,70,0.1) 0%, transparent 65%)',
      }} />

      {/* Bottom-left accent */}
      <div style={{
        position: 'absolute', bottom: -40, left: -40, width: 120, height: 120, pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(167,139,250,0.07) 0%, transparent 70%)',
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: 'linear-gradient(135deg, #E63946 0%, #b22032 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', flexShrink: 0,
          boxShadow: '0 0 14px rgba(230,57,70,0.4)',
        }}>
          {YT_ICON}
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.14em' }}>
            IMPORT FROM YOUTUBE
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.07em', marginTop: 1 }}>
            yt-dlp · best MP3 quality · auto-saves to library
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: statusColor,
            boxShadow: `0 0 7px ${statusColor}`,
            animation: dlState === 'running' ? 'ytPulse 1s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontSize: 9, fontFamily: 'monospace', color: statusColor, letterSpacing: '0.1em' }}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* IDLE STATE */}
      {dlState === 'idle' && (
        <div style={{ animation: 'ytFadeUp 0.25s ease' }}>
          <div style={{
            display: 'flex',
            background: focused ? 'rgba(230,57,70,0.04)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${focused ? 'rgba(230,57,70,0.45)' : 'rgba(255,255,255,0.09)'}`,
            borderRadius: 10,
            overflow: 'hidden',
            transition: 'border-color 0.2s, background 0.2s',
            boxShadow: focused ? '0 0 0 3px rgba(230,57,70,0.1)' : 'none',
          }}>
            {/* yt:// prefix badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0 13px',
              background: 'rgba(230,57,70,0.07)',
              borderRight: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(230,57,70,0.65)',
              fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.04em',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}>
              {YT_ICON}
              <span>yt://</span>
            </div>

            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={e => e.key === 'Enter' && handleDownload()}
              placeholder="youtube.com/watch?v=...  or  youtu.be/..."
              autoComplete="off"
              spellCheck={false}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: '#fff', fontSize: 12, fontFamily: 'monospace',
                padding: '11px 13px', minWidth: 0,
              } as React.CSSProperties}
            />

            <button
              onClick={handleDownload}
              disabled={!isValidUrl}
              style={{
                background: isValidUrl ? 'linear-gradient(135deg, #E63946 0%, #b22032 100%)' : 'rgba(255,255,255,0.04)',
                border: 'none',
                color: isValidUrl ? '#fff' : 'rgba(255,255,255,0.25)',
                fontWeight: 700, fontSize: 10, letterSpacing: '0.1em',
                padding: '0 22px', cursor: isValidUrl ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                animation: isValidUrl ? 'ytGlow 2.5s ease-in-out infinite' : 'none',
                flexShrink: 0,
              } as React.CSSProperties}
            >
              CAPTURE ↓
            </button>
          </div>

          <div style={{ marginTop: 7, fontSize: 9, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.05em', paddingLeft: 2 }}>
            Supports youtube.com · youtu.be · YouTube Music · Press Enter to capture
          </div>
        </div>
      )}

      {/* RUNNING STATE */}
      {dlState === 'running' && (
        <div style={{ animation: 'ytFadeUp 0.25s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Animated equalizer bars */}
            <div style={{
              display: 'flex', alignItems: 'flex-end', gap: 3,
              height: 28, flexShrink: 0, paddingBottom: 2,
            }}>
              {BARS.map(([name, dur], i) => (
                <div key={i} style={{
                  width: 5, borderRadius: '2px 2px 1px 1px',
                  background: i < 2
                    ? 'linear-gradient(0deg, #E63946, #ff6b6b)'
                    : i < 4
                    ? 'linear-gradient(0deg, #E63946, #FFB800)'
                    : 'linear-gradient(0deg, #FFB800, #ffd666)',
                  animation: `${name} ${dur} ease-in-out infinite`,
                  transformOrigin: 'bottom',
                } as React.CSSProperties} />
              ))}
            </div>

            {/* Progress + message */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                <span style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.5)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  marginRight: 10, letterSpacing: '0.04em',
                }}>
                  {message || 'Processing...'}
                </span>
                <span style={{
                  fontSize: 20, fontWeight: 700, fontFamily: 'monospace',
                  color: '#E63946', flexShrink: 0, lineHeight: 1,
                  textShadow: '0 0 16px rgba(230,57,70,0.6)',
                }}>
                  {progress}%
                </span>
              </div>

              {/* Progress bar */}
              <div style={{
                height: 5, borderRadius: 3,
                background: 'rgba(255,255,255,0.06)',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #E63946 0%, #FFB800 100%)',
                  borderRadius: 3,
                  transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
                  boxShadow: '0 0 10px rgba(230,57,70,0.55)',
                }} />
                {/* Scanline sweep */}
                {progress > 5 && (
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, width: '35%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                    animation: 'ytScan 1.6s linear infinite',
                  }} />
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{
              fontSize: 9, color: 'rgba(255,255,255,0.18)',
              fontFamily: 'monospace', letterSpacing: '0.07em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            }}>
              ↳ {url}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', fontFamily: 'monospace', flexShrink: 0, marginLeft: 8 }}>
              {stalledSec > 0 ? `${stalledSec}s` : ''}
              {stalledSec > 15 && <span style={{ color: 'rgba(255,184,0,0.6)', marginLeft: 6 }}>· takes 1–3 min for long videos</span>}
            </div>
          </div>
        </div>
      )}

      {/* DONE STATE */}
      {dlState === 'done' && result && (
        <div style={{ animation: 'ytFadeUp 0.35s ease' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: 'rgba(0,210,106,0.06)',
            border: '1px solid rgba(0,210,106,0.18)',
            borderRadius: 10, padding: '13px 16px',
          }}>
            {/* Check icon */}
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'rgba(0,210,106,0.12)',
              border: '1px solid rgba(0,210,106,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, color: '#00D26A',
            }}>
              ✓
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: '#00D26A', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>
                TRACK CAPTURED · SAVED TO MUSIC LIBRARY
              </div>
              <div style={{
                fontSize: 14, color: '#fff', fontWeight: 600,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {result.title}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3, fontFamily: 'monospace' }}>
                {formatDuration(result.duration)}{result.duration ? ' · ' : ''}MP3 · best quality
              </div>
            </div>

            {/* Decorative mini waveform */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, opacity: 0.6 }}>
              {[6, 12, 8, 18, 10, 14, 7, 16, 9, 11].map((h, i) => (
                <div key={i} style={{
                  width: 3, height: h, borderRadius: 1.5,
                  background: i % 3 === 0 ? '#00D26A' : i % 3 === 1 ? 'rgba(0,210,106,0.6)' : 'rgba(0,210,106,0.3)',
                }} />
              ))}
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <button onClick={reset} style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: 'rgba(255,255,255,0.45)',
              fontSize: 11, padding: '7px 16px', cursor: 'pointer',
              letterSpacing: '0.06em', transition: 'all 0.15s',
            } as React.CSSProperties}>
              ↳ Import Another Track
            </button>
          </div>
        </div>
      )}

      {/* ERROR STATE */}
      {dlState === 'error' && (
        <div style={{ animation: 'ytShake 0.4s ease, ytFadeUp 0.25s ease' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            background: 'rgba(230,57,70,0.07)',
            border: '1px solid rgba(230,57,70,0.22)',
            borderRadius: 10, padding: '12px 16px',
          }}>
            <div style={{ fontSize: 14, color: '#E63946', flexShrink: 0, fontWeight: 700, paddingTop: 1 }}>
              ✕
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#E63946', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 5 }}>
                CAPTURE FAILED
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                {error}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button onClick={() => { setDlState('idle'); setError(null); }} style={{
              background: 'linear-gradient(135deg, #E63946, #b22032)',
              border: 'none', borderRadius: 8, color: '#fff',
              fontWeight: 700, fontSize: 10, letterSpacing: '0.1em',
              padding: '8px 18px', cursor: 'pointer',
              boxShadow: '0 0 12px rgba(230,57,70,0.3)',
            } as React.CSSProperties}>
              ↺ RETRY
            </button>
            <button onClick={reset} style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: 'rgba(255,255,255,0.35)',
              fontSize: 10, padding: '8px 16px', cursor: 'pointer',
              letterSpacing: '0.05em',
            } as React.CSSProperties}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
