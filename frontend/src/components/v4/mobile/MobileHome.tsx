import { useState, useMemo } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { tapLight } from '../../../lib/haptics';
import type { MusicGeneration } from '../../../types';

interface Props { onOpenSounds: () => void }

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const artFor = (t: MusicGeneration) => t.artwork_url ? (t.artwork_url.startsWith('http') ? t.artwork_url : `${API_BASE}/api/projects/${t.project_id}/artwork/${t.id}`) : null;

export default function MobileHome({ onOpenSounds }: Props) {
  const { projects, setActiveProjectId, playlists, recentTracks, tracks, playTrack, setSelectedTrack, setMobilePlaylistId } = useWorkspace();
  const [q, setQ] = useState('');

  const label: React.CSSProperties = { fontSize: 19, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em', margin: '4px 0 12px' };

  const openProject = (id: string) => { tapLight(); setActiveProjectId(id); onOpenSounds(); };

  const query = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!query) return null;
    const trackPool = [...recentTracks, ...tracks].filter((t, i, a) => a.findIndex(x => x.id === t.id) === i);
    return {
      tracks: trackPool.filter(t => (t.title || '').toLowerCase().includes(query) || (t.artist || '').toLowerCase().includes(query)).slice(0, 20),
      playlists: playlists.filter(p => p.name.toLowerCase().includes(query)),
      projects: projects.filter(p => p.name.toLowerCase().includes(query)),
    };
  }, [query, recentTracks, tracks, playlists, projects]);

  return (
    <div style={{ padding: 'calc(env(safe-area-inset-top, 8px) + 6px) 0 20px' }}>
      {/* Greeting */}
      <div style={{ padding: '6px 20px 10px' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{greeting()}</div>
        <div style={{ fontSize: 27, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>RedInside</div>
      </div>

      {/* Search */}
      <div style={{ padding: '0 20px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '11px 14px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" strokeLinecap="round"/></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Songs, playlists, projects"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 15, fontFamily: 'inherit' }} />
          {q && <button onClick={() => setQ('')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 18, padding: 0 }}>✕</button>}
        </div>
      </div>

      {/* Search results (replace home content while searching) */}
      {results && (
        <div style={{ padding: '0 0 8px' }}>
          {results.tracks.length === 0 && results.playlists.length === 0 && results.projects.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '30px', fontSize: 14 }}>No matches for “{q}”.</div>
          )}
          {results.tracks.length > 0 && <div style={{ ...label, padding: '0 20px', fontSize: 14, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1 }}>Songs</div>}
          {results.tracks.map(t => {
            const art = artFor(t);
            return (
              <button key={t.id} onClick={() => { tapLight(); setSelectedTrack(t); playTrack(t); }} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '7px 20px' }}>
                <div style={{ width: 44, height: 44, borderRadius: 7, flexShrink: 0, overflow: 'hidden', background: `linear-gradient(135deg, ${C.redDark}, #080108)` }}>{art && <img src={art} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontSize: 14, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title || `Track v${t.version}`}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{t.artist || 'RedInside Studio'}</div>
                </div>
              </button>
            );
          })}
          {results.playlists.length > 0 && <div style={{ ...label, padding: '14px 20px 8px', fontSize: 14, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1 }}>Playlists</div>}
          {results.playlists.map(p => (
            <button key={p.id} onClick={() => { tapLight(); setMobilePlaylistId(p.id); }} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '7px 20px' }}>
              <div style={{ width: 44, height: 44, borderRadius: 7, flexShrink: 0, background: p.name === 'Liked Songs' ? 'linear-gradient(135deg,#e0399a,#7a1040)' : `linear-gradient(135deg, ${C.red}, #3a0810)` }} />
              <span style={{ flex: 1, textAlign: 'left', fontSize: 14, color: '#fff' }}>{p.name}</span>
            </button>
          ))}
          {results.projects.length > 0 && <div style={{ ...label, padding: '14px 20px 8px', fontSize: 14, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1 }}>Projects</div>}
          {results.projects.map(p => (
            <button key={p.id} onClick={() => openProject(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '7px 20px' }}>
              <div style={{ width: 44, height: 44, borderRadius: 7, flexShrink: 0, background: `linear-gradient(135deg, ${C.redDark}, #0a0102)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: C.red }}>{p.name.slice(0, 2).toUpperCase()}</div>
              <span style={{ flex: 1, textAlign: 'left', fontSize: 14, color: '#fff' }}>{p.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Home content (hidden while searching) */}
      {!results && (<>


      {/* Playlists — quick 2-col grid */}
      {playlists.length > 0 && (
        <div style={{ padding: '0 16px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {playlists.slice(0, 6).map(p => (
            <button key={p.id} onClick={() => { tapLight(); setMobilePlaylistId(p.id); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 8, cursor: 'pointer', overflow: 'hidden' }}>
              <div style={{ width: 42, height: 42, borderRadius: 6, flexShrink: 0, background: p.name === 'Liked Songs' ? 'linear-gradient(135deg,#e0399a,#7a1040)' : `linear-gradient(135deg, ${C.red}, #3a0810)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" opacity="0.9">{p.name === 'Liked Songs' ? <path d="M12 21l-1.4-1.3C5.4 15 2 11.9 2 8.2 2 5.4 4.2 3.2 7 3.2c1.6 0 3.1.7 4 1.9 .9-1.2 2.4-1.9 4-1.9 2.8 0 5 2.2 5 5 0 3.7-3.4 6.8-8.6 11.5L12 21z"/> : <circle cx="12" cy="12" r="7" stroke="#fff" strokeWidth="1.6" fill="none"/>}</svg>
              </div>
              <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Recently played */}
      {recentTracks.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ ...label, padding: '0 20px' }}>Recently played</div>
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '0 20px 4px', scrollbarWidth: 'none' }}>
            {recentTracks.map(t => {
              const art = artFor(t);
              return (
                <button key={t.id} onClick={() => { tapLight(); setSelectedTrack(t); playTrack(t); }}
                  style={{ width: 132, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                  <div style={{ width: 132, height: 132, borderRadius: 12, overflow: 'hidden', background: `linear-gradient(135deg, ${C.redDark}, #080108)`, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {art ? <img src={art} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={C.red} strokeWidth="1.5" opacity="0.6"/></svg>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginTop: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title || `Track v${t.version}`}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.artist || 'RedInside Studio'}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Projects */}
      <div style={{ marginTop: 18 }}>
        <div style={{ ...label, padding: '0 20px' }}>Your Projects</div>
        {projects.map(p => (
          <button key={p.id} onClick={() => openProject(p.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 20px' }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, flexShrink: 0, background: `linear-gradient(135deg, ${C.redDark}, #0a0102)`, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: C.red }}>
              {p.name.slice(0, 2).toUpperCase()}
            </div>
            <span style={{ flex: 1, textAlign: 'left', fontSize: 15, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6"/></svg>
          </button>
        ))}
        {projects.length === 0 && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '8px 20px' }}>No projects yet.</div>}
      </div>
      </>)}
    </div>
  );
}
