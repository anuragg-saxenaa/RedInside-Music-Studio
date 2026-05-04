import { useState, useEffect } from 'react';
import type { LyricsGeneration } from '../../App';

interface StylePreset {
  key: string;
  name: string;
  description: string;
}

const DEFAULT_PRESETS: StylePreset[] = [
  { key: 'hinglish-urban', name: 'Hinglish Urban', description: 'Hindi-English mix, trap/drill' },
  { key: 'hindi-urdu-classical', name: 'Hindi-Urdu Classical', description: 'Ghazal-inspired, poetic' },
  { key: 'punjabi-swagger', name: 'Punjabi Swagger', description: 'Bhangra, Sidhu Moose Wala style' },
  { key: 'regional-fusion', name: 'Regional Fusion', description: 'Multi-language fusion' },
  { key: 'custom', name: 'Custom', description: 'User-defined prompt' },
];

interface LyricsEditorProps {
  projectId: string;
  onLyricsGenerated: (lyrics: LyricsGeneration) => void;
}

export default function LyricsEditor({ projectId, onLyricsGenerated }: LyricsEditorProps) {
  const [prompt, setPrompt] = useState('');
  const [stylePreset, setStylePreset] = useState('hinglish-urban');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lyricsHistory, setLyricsHistory] = useState<LyricsGeneration[]>([]);
  const [presets, setPresets] = useState<Record<string, StylePreset>>({});

  useEffect(() => {
    // Load presets
    fetch('/api/lyrics/presets')
      .then(res => res.json())
      .then(data => {
        const presetMap: Record<string, StylePreset> = {};
        Object.entries(data).forEach(([key, val]: [string, any]) => {
          presetMap[key] = { key, name: val.name, description: val.description };
        });
        setPresets(presetMap);
      })
      .catch(console.error);

    // Load existing lyrics
    fetch(`/api/projects/${projectId}/lyrics`)
      .then(res => res.json())
      .then(setLyricsHistory)
      .catch(console.error);
  }, [projectId]);

  const generateLyrics = async () => {
    if (!prompt.trim()) {
      setError('Prompt is required');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/lyrics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          prompt,
          stylePreset,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate lyrics');
      }

      const lyrics = await response.json();
      setLyricsHistory(prev => [lyrics, ...prev]);
      onLyricsGenerated(lyrics);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Generate Lyrics</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Style Preset</label>
            <div className="flex gap-2 flex-wrap">
              {Object.values(presets).map(preset => (
                <button
                  key={preset.key}
                  onClick={() => setStylePreset(preset.key)}
                  className={`px-3 py-1 rounded text-sm ${
                    stylePreset === preset.key
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Prompt</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Write a viral desi rap about..."
              className="w-full bg-gray-900 border border-gray-700 rounded p-3 h-24 resize-none"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm">{error}</div>
          )}

          <button
            onClick={generateLyrics}
            disabled={generating}
            className="bg-purple-600 px-6 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Lyrics'}
          </button>
        </div>
      </div>

      {lyricsHistory.length > 0 && (
        <div>
          <h4 className="text-md font-medium mb-2">Previous Versions</h4>
          <div className="space-y-2">
            {lyricsHistory.map(lyrics => (
              <div
                key={lyrics.id}
                className="bg-gray-900 p-3 rounded border border-gray-700"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium">{lyrics.title || `Version ${lyrics.version}`}</span>
                    <span className="text-sm text-gray-400 ml-2">{lyrics.style_preset}</span>
                  </div>
                  <button
                    onClick={() => onLyricsGenerated(lyrics)}
                    className="text-purple-400 text-sm hover:text-purple-300"
                  >
                    Use This
                  </button>
                </div>
                <p className="text-gray-400 text-sm mt-1 line-clamp-2">{lyrics.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}