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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Generate Section */}
      <div>
        <h3 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', marginBottom: '16px' }}>
          Generate Lyrics
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Style Preset */}
          <div>
            <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', marginBottom: '8px', fontWeight: 500 }}>
              Style Preset
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {Object.values(presets).map(preset => (
                <button
                  key={preset.key}
                  onClick={() => setStylePreset(preset.key)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: stylePreset === preset.key ? '#E63946' : '#2A2A2A',
                    backgroundColor: stylePreset === preset.key ? '#E63946' : '#1E1E1E',
                    color: stylePreset === preset.key ? '#FFFFFF' : '#A0A0A0',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                  onMouseOver={(e) => {
                    if (stylePreset !== preset.key) {
                      e.currentTarget.style.borderColor = '#E63946';
                      e.currentTarget.style.color = '#FFFFFF';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (stylePreset !== preset.key) {
                      e.currentTarget.style.borderColor = '#2A2A2A';
                      e.currentTarget.style.color = '#A0A0A0';
                    }
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div>
            <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', marginBottom: '8px', fontWeight: 500 }}>
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Write a viral desi rap about..."
              style={{
                width: '100%',
                backgroundColor: '#0A0A0A',
                border: '1px solid #2A2A2A',
                borderRadius: '8px',
                padding: '12px 16px',
                color: '#FFFFFF',
                fontSize: '14px',
                fontFamily: 'DM Sans, sans-serif',
                resize: 'none',
                height: '80px',
                outline: 'none',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#E63946'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#2A2A2A'}
            />
          </div>

          {error && (
            <div style={{ color: '#E63946', fontSize: '13px', padding: '8px 12px', backgroundColor: 'rgba(230, 57, 70, 0.1)', borderRadius: '6px' }}>
              {error}
            </div>
          )}

          <button
            onClick={generateLyrics}
            disabled={generating}
            style={{
              backgroundColor: generating ? '#666666' : '#E63946',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '14px 24px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: generating ? 'not-allowed' : 'pointer',
              transition: 'all 150ms ease',
              alignSelf: 'flex-start',
            }}
            onMouseOver={(e) => { if (!generating) e.currentTarget.style.backgroundColor = '#FF4757'; }}
            onMouseOut={(e) => { if (!generating) e.currentTarget.style.backgroundColor = '#E63946'; }}
          >
            {generating ? '✍️ Generating...' : '✍️ Generate Lyrics'}
          </button>
        </div>
      </div>

      {/* History Section */}
      {lyricsHistory.length > 0 && (
        <div>
          <h4 style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 600, marginBottom: '12px', fontFamily: 'Outfit, sans-serif' }}>
            Previous Versions
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {lyricsHistory.map(lyrics => (
              <div
                key={lyrics.id}
                style={{
                  backgroundColor: '#1E1E1E',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid #2A2A2A',
                  transition: 'all 150ms ease',
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = '#E63946'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = '#2A2A2A'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 500 }}>
                      {lyrics.title || `Version ${lyrics.version}`}
                    </span>
                    <span style={{
                      backgroundColor: '#2A2A2A',
                      color: '#A0A0A0',
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontFamily: 'JetBrains Mono, monospace'
                    }}>
                      {lyrics.style_preset}
                    </span>
                  </div>
                  <button
                    onClick={() => onLyricsGenerated(lyrics)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#E63946',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      padding: '4px 8px',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.color = '#FF4757'}
                    onMouseOut={(e) => e.currentTarget.style.color = '#E63946'}
                  >
                    Use This →
                  </button>
                </div>
                <p style={{ color: '#666666', fontSize: '13px', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {lyrics.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}