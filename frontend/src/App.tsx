import { useState, useEffect } from 'react';
import Studio from './pages/Studio';

export interface Project {
  id: string;
  name: string;
  description?: string;
  workflow_mode: 'auto' | 'manual' | 'hybrid';
  current_lyrics_version: number;
  current_music_version: number;
  created_at: string;
  updated_at: string;
}

export interface LyricsGeneration {
  id: string;
  project_id: string;
  version: number;
  content: string;
  title?: string;
  style_preset?: string;
  created_at: string;
}

export interface MusicGeneration {
  id: string;
  project_id: string;
  lyrics_id?: string;
  version: number;
  model: string;
  original_file_path?: string;
  processed_file_path?: string;
  duration_seconds?: number;
  bitrate?: number;
  title?: string;
  created_at: string;
}

function App() {
  const [project, setProject] = useState<Project | null>(null);

  const createProject = async (name: string) => {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const newProject = await response.json();
    setProject(newProject);
  };

  const loadProject = async (id: string) => {
    const response = await fetch(`/api/projects/${id}`);
    const projectData = await response.json();
    setProject(projectData);
  };

  return (
    <div style={{ backgroundColor: '#0A0A0A', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' }}>
      <header style={{
        backgroundColor: '#0A0A0A',
        borderBottom: '1px solid #1A1A1A',
        padding: '20px 32px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <h1 style={{
          color: '#E63946',
          fontSize: '22px',
          fontWeight: 700,
          fontFamily: 'Outfit, sans-serif',
          letterSpacing: '-0.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="#E63946" strokeWidth="2"/>
            <path d="M10 8L20 14L10 20V8Z" fill="#E63946"/>
          </svg>
          RedInside <span style={{ color: '#FFFFFF' }}>Music Studio</span>
        </h1>
      </header>
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px' }}>
        {!project ? (
          <ProjectSelector onCreate={createProject} onLoad={loadProject} />
        ) : (
          <Studio project={project} onBack={() => setProject(null)} />
        )}
      </main>
    </div>
  );
}

function ProjectSelector({ onCreate, onLoad }: {
  onCreate: (name: string) => void;
  onLoad: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(setProjects)
      .catch(console.error);
  }, []);

  const deleteProject = async (id: string) => {
    if (!confirm('Delete this project permanently?')) return;
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    setProjects(projects.filter(p => p.id !== id));
  };

  const renameProject = async (id: string, newName: string) => {
    const response = await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    const updated = await response.json();
    setProjects(projects.map(p => p.id === id ? updated : p));
  };

  const filteredProjects = projects
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const recentProjects = filteredProjects.slice(0, 3);
  const olderProjects = filteredProjects.slice(3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
      {/* Create New Project */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Name your new track..."
            onKeyDown={(e) => e.key === 'Enter' && name && onCreate(name)}
            style={{
              flex: 1,
              backgroundColor: '#141414',
              border: '1px solid #2A2A2A',
              borderRadius: '12px',
              padding: '16px 20px',
              color: '#FFFFFF',
              fontSize: '16px',
              outline: 'none',
              transition: 'border-color 150ms ease',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#E63946'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#2A2A2A'}
          />
          <button
            onClick={() => name && onCreate(name)}
            disabled={!name.trim()}
            style={{
              backgroundColor: name.trim() ? '#E63946' : '#2A2A2A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              padding: '16px 28px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: name.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 150ms ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseOver={(e) => { if (name.trim()) (e.currentTarget as HTMLElement).style.backgroundColor = '#FF4757'; }}
            onMouseOut={(e) => { if (name.trim()) (e.currentTarget as HTMLElement).style.backgroundColor = '#E63946'; }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Create
          </button>
        </div>
      </div>

      {/* Search */}
      {projects.length > 0 && (
        <div style={{ position: 'relative' }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#666666' }}
          >
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            style={{
              width: '100%',
              backgroundColor: '#141414',
              border: '1px solid #2A2A2A',
              borderRadius: '10px',
              padding: '12px 16px 12px 48px',
              color: '#FFFFFF',
              fontSize: '14px',
              outline: 'none',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#E63946'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#2A2A2A'}
          />
        </div>
      )}

      {/* Recent Projects */}
      {recentProjects.length > 0 && (
        <div>
          <h3 style={{
            color: '#666666',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '16px',
          }}>
            Recent
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentProjects.map((p, i) => (
              <ProjectCard
                key={p.id}
                project={p}
                onClick={() => onLoad(p.id)}
                onDelete={deleteProject}
                onRename={renameProject}
                index={i}
              />
            ))}
          </div>
        </div>
      )}

      {/* Older Projects */}
      {olderProjects.length > 0 && (
        <div>
          <h3 style={{
            color: '#666666',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '16px',
          }}>
            Older Projects
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {olderProjects.map((p, i) => (
              <ProjectCard
                key={p.id}
                project={p}
                onClick={() => onLoad(p.id)}
                onDelete={deleteProject}
                onRename={renameProject}
                index={i + 3}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {projects.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#141414',
          borderRadius: '16px',
          border: '1px dashed #2A2A2A',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎵</div>
          <h3 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', marginBottom: '8px' }}>
            Start Your Music Journey
          </h3>
          <p style={{ color: '#666666', fontSize: '14px' }}>
            Create your first project above to begin generating lyrics and music
          </p>
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, onClick, onDelete, onRename, index }: {
  project: Project;
  onClick: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  index: number;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const hasLyrics = project.current_lyrics_version > 0;
  const hasMusic = project.current_music_version > 0;

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        backgroundColor: '#141414',
        border: '1px solid #2A2A2A',
        borderRadius: '12px',
        padding: '20px 24px',
        cursor: 'pointer',
        transition: 'all 200ms ease',
        animation: `fadeIn 300ms ease forwards`,
        animationDelay: `${index * 50}ms`,
        opacity: 0,
      }}
      onMouseOver={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#E63946';
        (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A';
        (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)';
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#2A2A2A';
        (e.currentTarget as HTMLElement).style.backgroundColor = '#141414';
        (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h4 style={{
            color: '#FFFFFF',
            fontSize: '16px',
            fontWeight: 600,
            fontFamily: 'Outfit, sans-serif',
            marginBottom: '8px',
          }}>
            {project.name}
          </h4>

          {/* Progress indicators */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: hasLyrics ? '#00D26A' : '#666666',
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: hasLyrics ? '#00D26A' : '#333333',
              }} />
              ✍️ Lyrics {hasLyrics ? `v${project.current_lyrics_version}` : ''}
            </span>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: hasMusic ? '#00D26A' : '#666666',
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: hasMusic ? '#00D26A' : '#333333',
              }} />
              🎵 Music {hasMusic ? `v${project.current_music_version}` : ''}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <span style={{
            fontSize: '11px',
            color: '#666666',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {formatRelativeTime(project.updated_at)}
          </span>
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              style={{
                background: 'none',
                border: 'none',
                color: '#666666',
                cursor: 'pointer',
                padding: '4px 8px',
                fontSize: '18px',
                lineHeight: 1,
              }}
            >
              ⋮
            </button>
            {showMenu && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                backgroundColor: '#1E1E1E',
                border: '1px solid #2A2A2A',
                borderRadius: '8px',
                padding: '4px',
                zIndex: 100,
                minWidth: '120px',
              }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const newName = prompt('New name:', project.name);
                    if (newName) onRename(project.id, newName);
                    setShowMenu(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    color: '#A0A0A0',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '13px',
                  }}
                  onMouseOver={(e) => (e.currentTarget as HTMLElement).style.color = '#FFFFFF'}
                  onMouseOut={(e) => (e.currentTarget as HTMLElement).style.color = '#A0A0A0'}
                >
                  Rename
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this project?')) onDelete(project.id);
                    setShowMenu(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    color: '#E63946',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '13px',
                  }}
                  onMouseOver={(e) => (e.currentTarget as HTMLElement).style.color = '#FF4757'}
                  onMouseOut={(e) => (e.currentTarget as HTMLElement).style.color = '#E63946'}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </button>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default App;