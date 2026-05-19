import { useState } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import type { Project } from '../../../types';

const MAX_PROJECTS_COLLAPSED = 5;

const NAV_ITEMS = [
  { label: 'Sounds',   href: '#',          icon: '♪' },
  { label: 'History',  href: '#/history',  icon: '⏱' },
  { label: 'Settings', href: '#/settings', icon: '⚙' },
];

const SMART_PLAYLISTS = [
  { id: '__all_mastered',  name: 'All Mastered',   icon: '✦' },
  { id: '__instrumentals', name: 'Instrumentals',  icon: '🎹' },
  { id: '__unmastered',    name: 'Unmastered',     icon: '◌' },
];

export default function LeftSidebar() {
  const { projects, activeProjectId, setActiveProjectId, refreshProjects, playlists, refreshPlaylists } = useWorkspace();
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(false);
  const [playlistsOpen, setPlaylistsOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);

  const sortedProjects = [...projects].sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  const visibleProjects = projectsExpanded ? sortedProjects : sortedProjects.slice(0, MAX_PROJECTS_COLLAPSED);

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim() }),
      });
      const p: Project = await res.json();
      refreshProjects();
      setActiveProjectId(p.id);
      setNewProjectName('');
      setShowNewProjectInput(false);
    } finally {
      setCreatingProject(false);
    }
  };

  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    setCreatingPlaylist(true);
    try {
      await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPlaylistName.trim() }),
      });
      refreshPlaylists();
      setNewPlaylistName('');
    } finally {
      setCreatingPlaylist(false);
    }
  };

  const deletePlaylist = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/playlists/${id}`, { method: 'DELETE' });
    refreshPlaylists();
    if (activePlaylistId === id) setActivePlaylistId(null);
  };

  const sectionLabel: React.CSSProperties = {
    color: C.textDim,
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '1.4px',
    padding: '20px 20px 6px',
    opacity: 0.55,
  };

  const navItem = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '9px 20px',
    cursor: 'pointer',
    color: active ? C.text : 'rgba(255,255,255,0.55)',
    fontWeight: active ? 700 : 500,
    fontSize: '14px',
    transition: 'color 100ms',
    userSelect: 'none',
    textDecoration: 'none',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Brand — always visible */}
      <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke={C.red} strokeWidth="2"/>
            <path d="M10 8L20 14L10 20V8Z" fill={C.red}/>
          </svg>
          <span style={{ color: C.red, fontWeight: 800, fontSize: '15px', letterSpacing: '-0.3px' }}>
            RedInside<span style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 400 }}> Studio</span>
          </span>
        </div>
      </div>

      {/* Nav — always visible */}
      <nav style={{ flexShrink: 0, borderBottom: `1px solid ${C.border}`, paddingBottom: '8px' }}>
        <div style={sectionLabel}>Workspace</div>
        {NAV_ITEMS.map(({ label, href, icon }) => (
          <a
            key={href}
            href={href}
            style={navItem(false)}
            onMouseOver={e => (e.currentTarget.style.color = C.text)}
            onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
          >
            <span style={{ fontSize: '13px', width: '16px', textAlign: 'center', flexShrink: 0, opacity: 0.7 }}>{icon}</span>
            {label}
          </a>
        ))}
      </nav>

      {/* Scrollable list area — projects + playlists scroll, brand+nav stay pinned */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: '16px' }}>

      {/* Projects */}
      <div style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 6px' }}>
          <span style={{ ...sectionLabel, padding: 0 }}>Projects</span>
          <button
            onClick={() => setShowNewProjectInput(v => !v)}
            title="New project"
            data-testid="new-project-toggle"
            style={{
              background: showNewProjectInput ? C.glassActive : 'none',
              border: `1px solid ${showNewProjectInput ? C.borderActive : 'transparent'}`,
              borderRadius: '5px',
              color: showNewProjectInput ? C.red : 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              fontSize: '18px',
              lineHeight: 1,
              padding: '1px 6px',
              transition: 'all 150ms',
            }}
          >+</button>
        </div>

        {showNewProjectInput && (
          <div style={{ display: 'flex', gap: '6px', padding: '0 16px 8px' }}>
            <input
              autoFocus
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createProject(); if (e.key === 'Escape') { setShowNewProjectInput(false); setNewProjectName(''); } }}
              placeholder="Project name…"
              data-testid="new-project-input"
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.07)',
                border: `1px solid ${C.border}`,
                borderRadius: '7px',
                padding: '7px 10px',
                color: C.text,
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <button
              onClick={createProject}
              disabled={creatingProject || !newProjectName.trim()}
              data-testid="create-project-btn"
              style={{
                background: C.red,
                border: 'none',
                borderRadius: '7px',
                color: '#fff',
                padding: '7px 12px',
                fontSize: '15px',
                cursor: 'pointer',
                lineHeight: 1,
                opacity: (!newProjectName.trim() || creatingProject) ? 0.4 : 1,
              }}
            >↵</button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {visibleProjects.map((p: Project) => {
            const active = activeProjectId === p.id;
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveProjectId(p.id)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setActiveProjectId(p.id)}
                data-testid={`project-item-${p.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 20px',
                  cursor: 'pointer',
                  background: active ? 'rgba(230,57,70,0.12)' : 'transparent',
                  borderLeft: `3px solid ${active ? C.red : 'transparent'}`,
                  transition: 'all 120ms',
                }}
                onMouseOver={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseOut={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '6px',
                  background: active ? `linear-gradient(135deg, ${C.redDark}, #0a0102)` : 'rgba(255,255,255,0.07)',
                  border: `1px solid ${active ? C.borderActive : C.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '11px',
                  color: active ? C.red : 'rgba(255,255,255,0.3)',
                  fontWeight: 700,
                }}>
                  {p.name.slice(0, 2).toUpperCase()}
                </div>
                <span style={{
                  color: active ? C.text : 'rgba(255,255,255,0.6)',
                  fontSize: '13px',
                  fontWeight: active ? 600 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}>
                  {p.name}
                </span>
              </div>
            );
          })}

          {projects.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', padding: '8px 20px' }}>
              No projects yet
            </div>
          )}

          {sortedProjects.length > MAX_PROJECTS_COLLAPSED && (
            <button
              onClick={() => setProjectsExpanded(v => !v)}
              style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)',
                fontSize: '12px', cursor: 'pointer', padding: '6px 20px', textAlign: 'left',
                transition: 'color 120ms',
              }}
              onMouseOver={e => (e.currentTarget.style.color = C.text)}
              onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
            >
              {projectsExpanded ? '↑ Show less' : `+ ${sortedProjects.length - MAX_PROJECTS_COLLAPSED} more`}
            </button>
          )}
        </div>
      </div>

      {/* Playlists */}
      <div>
        <button
          onClick={() => setPlaylistsOpen(v => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            background: 'none',
            border: 'none',
            padding: '20px 20px 6px',
            cursor: 'pointer',
          }}
        >
          <span style={{ ...sectionLabel, padding: 0 }}>Playlists</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', transition: 'transform 200ms', display: 'inline-block', transform: playlistsOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
        </button>

        {playlistsOpen && (
          <div data-testid="playlist-section">
            {/* Smart playlists */}
            {SMART_PLAYLISTS.map(sp => (
              <div
                key={sp.id}
                role="button"
                tabIndex={0}
                onClick={() => setActivePlaylistId(activePlaylistId === sp.id ? null : sp.id)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setActivePlaylistId(activePlaylistId === sp.id ? null : sp.id)}
                data-testid={`smart-playlist-${sp.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '7px 20px', cursor: 'pointer',
                  color: activePlaylistId === sp.id ? C.text : 'rgba(255,255,255,0.5)',
                  fontSize: '13px',
                  background: activePlaylistId === sp.id ? 'rgba(230,57,70,0.08)' : 'transparent',
                }}
                onMouseOver={e => { if (activePlaylistId !== sp.id) (e.currentTarget as HTMLDivElement).style.color = 'rgba(255,255,255,0.8)'; }}
                onMouseOut={e => { if (activePlaylistId !== sp.id) (e.currentTarget as HTMLDivElement).style.color = 'rgba(255,255,255,0.5)'; }}
              >
                <span style={{ fontSize: '12px', width: '16px', textAlign: 'center' }}>{sp.icon}</span>
                {sp.name}
              </div>
            ))}

            {/* User playlists */}
            {playlists.map(pl => (
              <div
                key={pl.id}
                role="button"
                tabIndex={0}
                onClick={() => setActivePlaylistId(activePlaylistId === pl.id ? null : pl.id)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setActivePlaylistId(activePlaylistId === pl.id ? null : pl.id)}
                data-testid={`playlist-item-${pl.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '7px 20px', cursor: 'pointer',
                  color: activePlaylistId === pl.id ? C.text : 'rgba(255,255,255,0.5)',
                  fontSize: '13px',
                  background: activePlaylistId === pl.id ? 'rgba(230,57,70,0.08)' : 'transparent',
                }}
                onMouseOver={e => { if (activePlaylistId !== pl.id) (e.currentTarget as HTMLDivElement).style.color = 'rgba(255,255,255,0.8)'; }}
                onMouseOut={e => { if (activePlaylistId !== pl.id) (e.currentTarget as HTMLDivElement).style.color = 'rgba(255,255,255,0.5)'; }}
              >
                <span style={{ fontSize: '11px', width: '16px', textAlign: 'center', color: 'rgba(255,255,255,0.2)' }}>♫</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pl.name}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px' }}>{pl.track_count ?? 0}</span>
                <button
                  onClick={e => deletePlaylist(pl.id, e)}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: '14px', padding: '0 2px', lineHeight: 1 }}
                  onMouseOver={e => (e.currentTarget.style.color = '#fff')}
                  onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
                >×</button>
              </div>
            ))}

            {/* Create playlist */}
            <div style={{ padding: '6px 16px 8px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  value={newPlaylistName}
                  onChange={e => setNewPlaylistName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createPlaylist()}
                  placeholder="New playlist…"
                  data-testid="new-playlist-input"
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
                    borderRadius: '7px', padding: '6px 10px', color: C.text, fontSize: '12px', outline: 'none',
                  }}
                />
                <button
                  onClick={createPlaylist}
                  disabled={creatingPlaylist || !newPlaylistName.trim()}
                  data-testid="create-playlist-btn"
                  style={{
                    background: C.red, border: 'none', borderRadius: '7px',
                    color: '#fff', padding: '6px 10px', fontSize: '14px', cursor: 'pointer',
                    opacity: (!newPlaylistName.trim() || creatingPlaylist) ? 0.4 : 1,
                  }}
                >+</button>
              </div>
            </div>
          </div>
        )}
      </div>

      </div>{/* end scrollable area */}
    </div>
  );
}
