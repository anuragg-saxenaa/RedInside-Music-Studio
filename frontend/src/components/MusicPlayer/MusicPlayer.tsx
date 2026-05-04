import { useState, useEffect } from 'react';
import type { LyricsGeneration, MusicGeneration } from '../../App';

interface MusicPlayerProps {
  projectId: string;
  selectedLyrics: LyricsGeneration | null;
  onMusicGenerated: (music: MusicGeneration) => void;
}

export default function MusicPlayer({ projectId, selectedLyrics, onMusicGenerated }: MusicPlayerProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [musicHistory, setMusicHistory] = useState<MusicGeneration[]>([]);
  const [model, setModel] = useState('music-2.6');

  useEffect(() => {
    fetch(`/api/projects/${projectId}/music`)
      .then(res => res.json())
      .then(setMusicHistory)
      .catch(console.error);
  }, [projectId]);

  const generateMusic = async () => {
    if (!selectedLyrics) {
      setError('Please select lyrics first');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/music/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          lyricsId: selectedLyrics.id,
          model,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate music');
      }

      const music = await response.json();
      setMusicHistory(prev => [music, ...prev]);
      onMusicGenerated(music);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Generate Music</h3>

        {selectedLyrics && (
          <div className="bg-gray-900 p-4 rounded mb-4">
            <div className="text-sm text-gray-400">Using lyrics:</div>
            <div className="font-medium">{selectedLyrics.title || `Version ${selectedLyrics.version}`}</div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Model</label>
            <div className="flex gap-2">
              {['music-2.6', 'music-cover'].map(m => (
                <button
                  key={m}
                  onClick={() => setModel(m)}
                  className={`px-3 py-1 rounded text-sm ${
                    model === m ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="text-red-400 text-sm">{error}</div>}

          <button
            onClick={generateMusic}
            disabled={generating || !selectedLyrics}
            className="bg-blue-600 px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Music'}
          </button>
        </div>
      </div>

      {musicHistory.length > 0 && (
        <div>
          <h4 className="text-md font-medium mb-2">Music Versions</h4>
          <div className="space-y-2">
            {musicHistory.map(music => (
              <div
                key={music.id}
                className="bg-gray-900 p-3 rounded border border-gray-700"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">Version {music.version}</span>
                    <span className="text-gray-400 text-sm ml-2">
                      {music.duration_seconds ? `${Math.round(music.duration_seconds)}s` : 'Processing...'}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">{music.model}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}