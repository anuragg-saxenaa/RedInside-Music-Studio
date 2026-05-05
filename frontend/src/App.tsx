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
      <header style={{ backgroundColor: '#141414', borderBottom: '1px solid #2A2A2A', padding: '16px 24px' }}>
        <h1 style={{ color: '#E63946', fontSize: '24px', fontWeight: 700, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.5px' }}>
          RedInside <span style={{ color: '#FFFFFF' }}>Music Studio</span>
        </h1>
      </header>
      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 16px' }}>
        {!project ? (
          <ProjectSelector onCreate={createProject} onLoad={loadProject} />
        ) : (
          <Studio project={project} onBack={() => setProject(null)} />
        )}
      </main>
    </div>
  );
}

function ProjectSelector({ onCreate, onLoad }: { onCreate: (name: string) => void; onLoad: (id: string) => void }) {
  const [name, setName] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(setProjects)
      .catch(console.error);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="New project name"
          style={{
            flex: 1,
            backgroundColor: '#141414',
            border: '1px solid #2A2A2A',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#FFFFFF',
            fontSize: '14px',
            outline: 'none',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#E63946'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#2A2A2A'}
        />
        <button
          onClick={() => name && onCreate(name)}
          style={{
            backgroundColor: '#E63946',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#FF4757'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#E63946'}
        >
          Create
        </button>
      </div>
      {projects.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ color: '#A0A0A0', fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
            Existing Projects
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => onLoad(p.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  backgroundColor: '#141414',
                  border: '1px solid #2A2A2A',
                  borderRadius: '8px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#E63946';
                  e.currentTarget.style.backgroundColor = '#1E1E1E';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#2A2A2A';
                  e.currentTarget.style.backgroundColor = '#141414';
                }}
              >
                <div style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 500, marginBottom: '4px' }}>{p.name}</div>
                <div style={{ color: '#666666', fontSize: '13px' }}>
                  {p.current_lyrics_version} lyrics, {p.current_music_version} music versions
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;