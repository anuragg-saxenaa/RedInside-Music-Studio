import { useState, useEffect } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import type { Project, MusicGeneration } from '../../../types';

const MAX_PROJECTS_COLLAPSED = 5;
const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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

interface LeftSidebarProps {
  onOpenSearch?: () => void;
}

export default function LeftSidebar({ onOpenSearch }: LeftSidebarProps) {
  const { projects, activeProjectId, setActiveProjectId, refreshProjects, playlists, refreshPlaylists, tracks, playTrack, setSelectedTrack, playerTrack, playerIsPlaying } = useWorkspace();
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectMenu, setProjectMenu] = useState<string | null>(null); // project id with open menu
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [playlistsOpen, setPlaylistsOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Record<string, MusicGeneration[]>>({});

  const sortedProjects = [...projects]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .filter(p => !projectSearch.trim() || p.name.toLowerCase().includes(projectSearch.toLowerCase()));
  const visibleProjects = (projectsExpanded || projectSearch.trim()) ? sortedProjects : sortedProjects.slice(0, MAX_PROJECTS_COLLAPSED);

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

  const deleteProject = async (id: string) => {
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    refreshProjects();
    setProjectMenu(null);
  };

  const renameProject = async (id: string) => {
    if (!renameDraft.trim()) { setRenamingId(null); return; }
    await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameDraft.trim() }),
    });
    refreshProjects();
    setRenamingId(null);
    setProjectMenu(null);
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
    setPlaylistTracks(prev => { const n = { ...prev }; delete n[id]; return n; });
    if (activePlaylistId === id) setActivePlaylistId(null);
  };

  // Re-fetch tracks for the currently-expanded playlist whenever playlists or tracks refresh
  // tracks dependency catches renames: refreshTracks() updates tracks but not playlists
  useEffect(() => {
    if (activePlaylistId && playlistTracks[activePlaylistId] !== undefined) {
      fetch(`/api/playlists/${activePlaylistId}/tracks`)
        .then(r => r.json())
        .then((ts: MusicGeneration[]) =>
          setPlaylistTracks(prev => ({ ...prev, [activePlaylistId]: ts }))
        )
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlists, tracks]);

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

        {onOpenSearch && (
          <div style={{ padding: '12px 16px 0' }}>
            <button onClick={onOpenSearch} data-testid="open-global-search" style={{
              display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
              background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
              borderRadius: '8px', padding: '8px 12px', color: C.textDim,
              fontSize: '12px', cursor: 'pointer', fontFamily: "'Outfit', 'DM Sans', sans-serif",
            }}>
              <span>🔍</span>
              <span style={{ flex: 1, textAlign: 'left' }}>Search…</span>
              <kbd style={{ fontSize: '10px', color: C.textDim, opacity: 0.6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '3px', padding: '1px 5px', fontFamily: "'JetBrains Mono', monospace" }}>⌘K</kbd>
            </button>
          </div>
        )}

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

        {/* Search */}
        <div style={{ padding: '0 16px 8px' }}>
          <input
            value={projectSearch}
            onChange={e => setProjectSearch(e.target.value)}
            placeholder="Search projects…"
            data-testid="project-search"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${C.border}`,
              borderRadius: '7px',
              padding: '6px 10px',
              color: C.text,
              fontSize: '12px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
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
          {(() => {
            const now = Date.now();
            const recent = visibleProjects.filter(p => now - new Date(p.updated_at).getTime() < SEVEN_DAYS_MS);
            const older = visibleProjects.filter(p => now - new Date(p.updated_at).getTime() >= SEVEN_DAYS_MS);
            const showGroupLabels = recent.length > 0 && older.length > 0;
            const groups: Array<{ label: string; items: Project[] }> = [];
            if (recent.length > 0) groups.push({ label: 'Recent', items: recent });
            if (older.length > 0) groups.push({ label: 'Earlier', items: older });

            return groups.flatMap(({ label, items }) => [
              showGroupLabels && (
                <div key={`grp-${label}`} style={{ ...sectionLabel, padding: '10px 20px 3px', fontSize: '9px', opacity: 0.4 }}>{label}</div>
              ),
              ...items.map((p: Project) => {
            const active = activeProjectId === p.id;
            const menuOpen = projectMenu === p.id;
            const renaming = renamingId === p.id;
            return (
              <div
                key={p.id}
                data-testid={`project-item-${p.id}`}
                style={{ position: 'relative' }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => { if (!renaming) { setActiveProjectId(p.id); setProjectMenu(null); } }}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setActiveProjectId(p.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 8px 8px 20px',
                    cursor: 'pointer',
                    background: active ? 'rgba(230,57,70,0.12)' : 'transparent',
                    borderLeft: `3px solid ${active ? C.red : 'transparent'}`,
                    transition: 'all 120ms',
                  }}
                  onMouseOver={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseOut={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                >
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '6px', flexShrink: 0,
                    background: active ? `linear-gradient(135deg, ${C.redDark}, #0a0102)` : 'rgba(255,255,255,0.07)',
                    border: `1px solid ${active ? C.borderActive : C.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', color: active ? C.red : 'rgba(255,255,255,0.3)', fontWeight: 700,
                  }}>
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>

                  {renaming ? (
                    <input
                      autoFocus
                      value={renameDraft}
                      onChange={e => setRenameDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') renameProject(p.id); if (e.key === 'Escape') { setRenamingId(null); setProjectMenu(null); } }}
                      onBlur={() => renameProject(p.id)}
                      onClick={e => e.stopPropagation()}
                      style={{
                        flex: 1, background: 'rgba(255,255,255,0.1)', border: `1px solid ${C.borderActive}`,
                        borderRadius: '5px', padding: '3px 7px', color: C.text, fontSize: '13px', outline: 'none',
                      }}
                    />
                  ) : (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        color: active ? C.text : 'rgba(255,255,255,0.6)',
                        fontSize: '13px', fontWeight: active ? 600 : 400,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.name}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', marginTop: '1px' }}>
                        {formatRelativeTime(p.created_at)}
                      </div>
                    </div>
                  )}

                  {/* ⋯ menu button */}
                  <button
                    onClick={e => { e.stopPropagation(); setProjectMenu(menuOpen ? null : p.id); }}
                    style={{
                      background: 'none', border: 'none', color: menuOpen ? C.text : 'rgba(255,255,255,0.25)',
                      cursor: 'pointer', fontSize: '16px', padding: '2px 6px', lineHeight: 1, flexShrink: 0,
                      borderRadius: '4px',
                    }}
                    onMouseOver={e => (e.currentTarget.style.color = C.text)}
                    onMouseOut={e => { if (!menuOpen) e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; }}
                  >⋯</button>
                </div>

                {/* Dropdown menu */}
                {menuOpen && (
                  <div style={{
                    position: 'absolute', right: '8px', top: '100%', zIndex: 300,
                    background: '#1a1a1a', border: `1px solid ${C.border}`, borderRadius: '8px',
                    padding: '4px', minWidth: '120px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  }}>
                    <button
                      onClick={e => { e.stopPropagation(); setRenameDraft(p.name); setRenamingId(p.id); setProjectMenu(null); }}
                      style={{
                        display: 'block', width: '100%', background: 'none', border: 'none',
                        color: 'rgba(255,255,255,0.7)', padding: '8px 12px', cursor: 'pointer',
                        textAlign: 'left', fontSize: '13px', borderRadius: '5px',
                      }}
                      onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                      onMouseOut={e => (e.currentTarget.style.background = 'none')}
                    >✏ Rename</button>
                    <button
                      onClick={e => { e.stopPropagation(); if (confirm(`Delete "${p.name}"?`)) deleteProject(p.id); }}
                      style={{
                        display: 'block', width: '100%', background: 'none', border: 'none',
                        color: C.red, padding: '8px 12px', cursor: 'pointer',
                        textAlign: 'left', fontSize: '13px', borderRadius: '5px',
                      }}
                      onMouseOver={e => (e.currentTarget.style.background = 'rgba(230,57,70,0.12)')}
                      onMouseOut={e => (e.currentTarget.style.background = 'none')}
                    >✕ Delete</button>
                  </div>
                )}
              </div>
            );
          })
            ]);
          })()}

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
            {playlists.map(pl => {
              const expanded = activePlaylistId === pl.id;
              const tracks = playlistTracks[pl.id];
              return (
                <div key={pl.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      const next = expanded ? null : pl.id;
                      setActivePlaylistId(next);
                      if (next && !playlistTracks[pl.id]) {
                        fetch(`/api/playlists/${pl.id}/tracks`)
                          .then(r => r.json())
                          .then((ts: MusicGeneration[]) =>
                            setPlaylistTracks(prev => ({ ...prev, [pl.id]: ts }))
                          )
                          .catch(() => {});
                      }
                    }}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setActivePlaylistId(expanded ? null : pl.id)}
                    data-testid={`playlist-item-${pl.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '7px 20px', cursor: 'pointer',
                      color: expanded ? C.text : 'rgba(255,255,255,0.5)',
                      fontSize: '13px',
                      background: expanded ? 'rgba(230,57,70,0.08)' : 'transparent',
                    }}
                    onMouseOver={e => { if (!expanded) (e.currentTarget as HTMLDivElement).style.color = 'rgba(255,255,255,0.8)'; }}
                    onMouseOut={e => { if (!expanded) (e.currentTarget as HTMLDivElement).style.color = 'rgba(255,255,255,0.5)'; }}
                  >
                    <span style={{ fontSize: '10px', color: expanded ? C.red : 'rgba(255,255,255,0.2)', transition: 'transform 150ms', display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'none' }}>▶</span>
                    <span style={{ fontSize: '11px', width: '14px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>♫</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pl.name}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', flexShrink: 0 }}>{pl.track_count ?? 0}</span>
                    <button
                      onClick={e => deletePlaylist(pl.id, e)}
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: '14px', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}
                      onMouseOver={e => (e.currentTarget.style.color = '#fff')}
                      onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
                    >×</button>
                  </div>

                  {expanded && (
                    <div style={{ paddingLeft: '36px', paddingBottom: '4px' }}>
                      {!tracks && (
                        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', padding: '4px 0' }}>Loading…</div>
                      )}
                      {tracks && tracks.length === 0 && (
                        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', padding: '4px 0' }}>No tracks yet</div>
                      )}
                      {tracks && tracks.map(t => {
                        const isTrackPlaying = playerTrack?.id === t.id && playerIsPlaying;
                        return (
                          <div
                            key={t.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => { setSelectedTrack(t); playTrack(t); }}
                            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (setSelectedTrack(t), playTrack(t))}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '6px',
                              fontSize: '12px', color: isTrackPlaying ? C.red : 'rgba(255,255,255,0.5)',
                              padding: '4px 8px', borderRadius: '5px',
                              overflow: 'hidden', cursor: 'pointer',
                              background: isTrackPlaying ? 'rgba(230,57,70,0.08)' : 'transparent',
                            }}
                            onMouseOver={e => { if (!isTrackPlaying) (e.currentTarget as HTMLDivElement).style.color = 'rgba(255,255,255,0.85)'; (e.currentTarget as HTMLDivElement).style.background = isTrackPlaying ? 'rgba(230,57,70,0.12)' : 'rgba(255,255,255,0.05)'; }}
                            onMouseOut={e => { if (!isTrackPlaying) (e.currentTarget as HTMLDivElement).style.color = 'rgba(255,255,255,0.5)'; (e.currentTarget as HTMLDivElement).style.background = isTrackPlaying ? 'rgba(230,57,70,0.08)' : 'transparent'; }}
                          >
                            <span style={{
                              width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                              background: isTrackPlaying ? '#E63946' : 'rgba(255,255,255,0.15)',
                              animation: isTrackPlaying ? 'rds-pulse 1.1s ease-in-out infinite' : 'none',
                              display: 'inline-block',
                            }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.title || `Track v${t.version}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

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
