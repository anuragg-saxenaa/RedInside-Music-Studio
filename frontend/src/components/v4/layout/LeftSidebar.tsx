import { useState } from 'react';
import { C } from '../shared/colors';
import GlassPanel from '../shared/GlassPanel';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import type { Project } from '../../../types';
import PlaylistSection from '../playlist/PlaylistSection';

export default function LeftSidebar() {
  const { projects, activeProjectId, setActiveProjectId, refreshProjects } = useWorkspace();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const createProject = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const p: Project = await res.json();
      refreshProjects();
      setActiveProjectId(p.id);
      setNewName('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
      {/* Projects */}
      <GlassPanel style={{ padding: '12px' }}>
        <div style={{ color: C.textLabel, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '8px' }}>
          Projects
        </div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createProject()}
            placeholder="New project…"
            data-testid="new-project-input"
            style={{
              flex: 1, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
              borderRadius: '6px', padding: '6px 8px', color: C.text, fontSize: '12px', outline: 'none',
            }}
          />
          <button
            onClick={createProject}
            disabled={creating || !newName.trim()}
            data-testid="create-project-btn"
            style={{
              background: C.red, border: 'none', borderRadius: '6px', color: '#fff',
              padding: '6px 10px', fontSize: '14px', cursor: 'pointer', lineHeight: 1,
            }}
          >+</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {projects.slice().sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).map((p: Project) => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => setActiveProjectId(p.id)}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setActiveProjectId(p.id)}
              data-testid={`project-item-${p.id}`}
              style={{
                padding: '8px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                background: activeProjectId === p.id ? C.glassActive : 'transparent',
                border: `1px solid ${activeProjectId === p.id ? C.borderActive : 'transparent'}`,
                borderLeft: `3px solid ${activeProjectId === p.id ? C.red : 'transparent'}`,
                color: activeProjectId === p.id ? C.text : C.textDim,
                fontSize: '12px',
                transition: 'all 120ms',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {p.name}
            </div>
          ))}
          {projects.length === 0 && (
            <div style={{ color: C.textDim, fontSize: '11px', padding: '8px 0' }}>No projects yet</div>
          )}
        </div>
      </GlassPanel>

      {/* Playlists */}
      <PlaylistSection />

      {/* More */}
      <GlassPanel style={{ padding: '12px' }}>
        <div style={{ color: C.textLabel, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '8px' }}>
          More
        </div>
        {[
          { label: 'History', href: '#/history' },
          { label: 'Viral Toolkit', href: '#/viral' },
          { label: 'Settings', href: '#/settings' },
        ].map(({ label, href }) => (
          <a key={href} href={href} style={{ display: 'block', color: C.textDim, fontSize: '12px', padding: '6px 0', textDecoration: 'none' }}
            onMouseOver={e => (e.currentTarget as HTMLAnchorElement).style.color = C.text}
            onMouseOut={e => (e.currentTarget as HTMLAnchorElement).style.color = C.textDim}
          >{label}</a>
        ))}
      </GlassPanel>
    </div>
  );
}
