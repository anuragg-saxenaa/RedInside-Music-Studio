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
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <h1 className="text-2xl font-bold text-purple-500">RedInside Music Studio</h1>
      </header>
      <main className="container mx-auto p-4">
        {!project ? (
          <div className="max-w-md mx-auto mt-8">
            <h2 className="text-xl mb-4">Create or Load Project</h2>
            <ProjectSelector onCreate={createProject} onLoad={loadProject} />
          </div>
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
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="New project name"
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2"
        />
        <button
          onClick={() => name && onCreate(name)}
          className="bg-purple-600 px-4 py-2 rounded hover:bg-purple-700"
        >
          Create
        </button>
      </div>
      {projects.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg mb-2">Existing Projects</h3>
          <div className="space-y-2">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => onLoad(p.id)}
                className="w-full text-left bg-gray-800 p-3 rounded border border-gray-700 hover:border-purple-500"
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-gray-400">
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