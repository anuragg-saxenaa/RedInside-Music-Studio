import { useState, useEffect, useRef } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';

interface GlobalSearchProps { onClose: () => void; }

export default function GlobalSearch({ onClose }: GlobalSearchProps) {
  const { tracks, playlists, projects, setSelectedTrack, playTrack, setActiveProjectId } = useWorkspace();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const q = query.toLowerCase().trim();

  const trackResults = q ? tracks.filter(t => (t.title || `Track v${t.version}`).toLowerCase().includes(q)).slice(0, 6) : tracks.slice(0, 6);
  const playlistResults = q ? playlists.filter(p => p.name.toLowerCase().includes(q)).slice(0, 3) : playlists.slice(0, 3);
  const projectResults = q ? projects.filter(p => p.name.toLowerCase().includes(q)).slice(0, 3) : projects.slice(0, 3);

  useEffect(() => { setCursor(0); }, [query]);

  const sectionHeader: React.CSSProperties = {
    fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px',
    color: 'rgba(230,57,70,0.5)', padding: '10px 20px 4px',
  };
  const rowBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 20px',
    cursor: 'pointer', fontSize: '13px', color: C.text, transition: 'background 80ms',
  };

  let flatIndex = 0;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '80px' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '520px', background: '#0d0205', border: '1px solid rgba(230,57,70,0.30)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.85)', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 20px', borderBottom: '1px solid rgba(230,57,70,0.16)', flexShrink: 0 }}>
          <span style={{ fontSize: '14px', opacity: 0.5 }}>🔍</span>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => c + 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
          }} placeholder="Search tracks, playlists, projects…" data-testid="global-search-input" style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: '15px', outline: 'none', fontFamily: "'Outfit', 'DM Sans', sans-serif" }} />
          <kbd style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '2px 5px', fontFamily: "'JetBrains Mono', monospace" }}>⌘K</kbd>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {trackResults.length === 0 && playlistResults.length === 0 && projectResults.length === 0 && (
            <div style={{ padding: '24px 20px', color: 'rgba(255,255,255,0.3)', fontSize: '13px', textAlign: 'center' }}>No results</div>
          )}
          {trackResults.length > 0 && (<><div style={sectionHeader}>Tracks</div>
            {trackResults.map(t => { const idx = flatIndex++; return (
              <div key={t.id} data-testid={`search-track-${t.id}`} onClick={() => { playTrack(t); setSelectedTrack(t); onClose(); }} onMouseEnter={() => setCursor(idx)} style={{ ...rowBase, background: cursor === idx ? 'rgba(230,57,70,0.10)' : 'transparent' }}>
                <span style={{ fontSize: '11px', color: 'rgba(230,57,70,0.5)', flexShrink: 0 }}>♪</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title || `Track v${t.version}`}</span>
                {t.artist && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{t.artist}</span>}
              </div>
            ); })}
          </>)}
          {playlistResults.length > 0 && (<><div style={sectionHeader}>Playlists</div>
            {playlistResults.map(p => { const idx = flatIndex++; return (
              <div key={p.id} data-testid={`search-playlist-${p.id}`} onClick={() => onClose()} onMouseEnter={() => setCursor(idx)} style={{ ...rowBase, background: cursor === idx ? 'rgba(230,57,70,0.10)' : 'transparent' }}>
                <span style={{ fontSize: '11px', color: 'rgba(230,57,70,0.5)', flexShrink: 0 }}>♫</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{p.track_count} tracks</span>
              </div>
            ); })}
          </>)}
          {projectResults.length > 0 && (<><div style={sectionHeader}>Projects</div>
            {projectResults.map(p => { const idx = flatIndex++; return (
              <div key={p.id} data-testid={`search-project-${p.id}`} onClick={() => { setActiveProjectId(p.id); onClose(); }} onMouseEnter={() => setCursor(idx)} style={{ ...rowBase, background: cursor === idx ? 'rgba(230,57,70,0.10)' : 'transparent' }}>
                <span style={{ fontSize: '11px', color: 'rgba(230,57,70,0.5)', flexShrink: 0 }}>◈</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              </div>
            ); })}
          </>)}
        </div>
        <div style={{ borderTop: '1px solid rgba(230,57,70,0.10)', padding: '8px 20px', display: 'flex', gap: '16px', flexShrink: 0 }}>
          {[['↑↓', 'navigate'], ['↵', 'select'], ['esc', 'close']].map(([key, label]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
              <kbd style={{ fontSize: '10px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', padding: '1px 4px', fontFamily: "'JetBrains Mono', monospace" }}>{key}</kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}