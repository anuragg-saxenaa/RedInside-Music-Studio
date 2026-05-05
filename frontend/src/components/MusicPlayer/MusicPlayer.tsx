import { useState, useEffect } from 'react';
import type { LyricsGeneration, MusicGeneration } from '../../App';
import SpotifyWaveformPlayer from './SpotifyWaveformPlayer';

interface MusicPlayerProps {
  projectId: string;
  selectedLyrics: LyricsGeneration | null;
  onMusicGenerated: (music: MusicGeneration) => void;
}

export default function MusicPlayer({ projectId, selectedLyrics, onMusicGenerated }: MusicPlayerProps) {
  const [generating, setGenerating] = useState(false);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [musicHistory, setMusicHistory] = useState<MusicGeneration[]>([]);
  const [model, setModel] = useState('music-2.6');

  useEffect(() => {
    fetch(`/api/projects/${projectId}/music`)
      .then(res => res.json())
      .then(setMusicHistory)
      .catch(console.error);
  }, [projectId]);

  useEffect(() => {
    if (!pollingJobId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${pollingJobId}`);
        const job = await res.json();

        if (job.status === 'completed' && job.result?.musicId) {
          const musicRes = await fetch(`/api/music/${job.result.musicId}`);
          const music = await musicRes.json();
          setMusicHistory(prev => [music, ...prev]);
          onMusicGenerated(music);
          setPollingJobId(null);
          setGenerating(false);
        } else if (job.status === 'failed') {
          setError(job.error_message || 'Music generation failed');
          setPollingJobId(null);
          setGenerating(false);
        } else {
          setTimeout(poll, 3000);
        }
      } catch (err) {
        console.error('Poll error:', err);
        setTimeout(poll, 3000);
      }
    };

    poll();
  }, [pollingJobId]);

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
      if (music.jobId) {
        setPollingJobId(music.jobId);
      } else {
        setMusicHistory(prev => [music, ...prev]);
        onMusicGenerated(music);
        setGenerating(false);
      }
    } catch (err: any) {
      setError(err.message);
      setGenerating(false);
    }
  };

  const isProcessing = generating || !!pollingJobId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Generate Section */}
      <div>
        <h3 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', marginBottom: '16px' }}>
          Generate Music
        </h3>

        {selectedLyrics && (
          <div style={{ backgroundColor: '#1E1E1E', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #2A2A2A' }}>
            <div style={{ color: '#A0A0A0', fontSize: '12px', marginBottom: '4px' }}>Using lyrics:</div>
            <div style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 500 }}>
              {selectedLyrics.title || `Version ${selectedLyrics.version}`}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Model Selection */}
          <div>
            <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', marginBottom: '8px', fontWeight: 500 }}>
              Model
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['music-2.6', 'music-cover'].map(m => (
                <button
                  key={m}
                  onClick={() => setModel(m)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: model === m ? '#E63946' : '#2A2A2A',
                    backgroundColor: model === m ? '#E63946' : '#1E1E1E',
                    color: model === m ? '#FFFFFF' : '#A0A0A0',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                  onMouseOver={(e) => {
                    if (model !== m) {
                      e.currentTarget.style.borderColor = '#E63946';
                      e.currentTarget.style.color = '#FFFFFF';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (model !== m) {
                      e.currentTarget.style.borderColor = '#2A2A2A';
                      e.currentTarget.style.color = '#A0A0A0';
                    }
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ color: '#E63946', fontSize: '13px', padding: '8px 12px', backgroundColor: 'rgba(230, 57, 70, 0.1)', borderRadius: '6px' }}>
              {error}
            </div>
          )}

          {pollingJobId && (
            <div style={{ color: '#A0A0A0', fontSize: '13px', padding: '12px 16px', backgroundColor: 'rgba(230, 57, 70, 0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '16px', height: '16px', border: '2px solid #E63946', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span>Generating... (job: {pollingJobId.slice(0, 8)}...)</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          <button
            onClick={generateMusic}
            disabled={isProcessing || !selectedLyrics}
            style={{
              backgroundColor: isProcessing || !selectedLyrics ? '#666666' : '#E63946',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '14px 24px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isProcessing || !selectedLyrics ? 'not-allowed' : 'pointer',
              transition: 'all 150ms ease',
              alignSelf: 'flex-start',
            }}
            onMouseOver={(e) => { if (!isProcessing && selectedLyrics) e.currentTarget.style.backgroundColor = '#FF4757'; }}
            onMouseOut={(e) => { if (!isProcessing && selectedLyrics) e.currentTarget.style.backgroundColor = '#E63946'; }}
          >
            {pollingJobId ? '⏳ Generating...' : generating ? '🚀 Starting...' : '🎵 Generate Music'}
          </button>
        </div>
      </div>

      {/* Music History */}
      {musicHistory.length > 0 && (
        <div>
          <h4 style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 600, marginBottom: '12px', fontFamily: 'Outfit, sans-serif' }}>
            Music Versions
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {musicHistory.map(music => (
              <div
                key={music.id}
                style={{
                  backgroundColor: '#1E1E1E',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid #2A2A2A',
                  transition: 'all 150ms ease',
                }}
                onMouseOver={(e) => (e.currentTarget as HTMLElement).style.borderColor = '#E63946'}
                onMouseOut={(e) => (e.currentTarget as HTMLElement).style.borderColor = '#2A2A2A'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 500 }}>
                      Version {music.version}
                    </span>
                    <span style={{ color: '#A0A0A0', fontSize: '12px' }}>
                      {music.duration_seconds ? `${Math.round(music.duration_seconds / 1000)}s` : 'Processing...'}
                    </span>
                  </div>
                  <span style={{ color: '#666666', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>
                    {music.model}
                  </span>
                </div>
                {music.original_file_path && (
                  <SpotifyWaveformPlayer
                    musicId={music.id}
                    version={music.version}
                    durationMs={(music.duration_seconds || 0) * 1000}
                    audioUrl={`/api/music/${music.id}/file`}
                    model={music.model}
                  />
                )}
                <div style={{ marginTop: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <a
                    href={`/api/music/${music.id}/file`}
                    download
                    style={{ color: '#E63946', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}
                    onMouseOver={(e) => (e.currentTarget as HTMLElement).style.color = '#FF4757'}
                    onMouseOut={(e) => (e.currentTarget as HTMLElement).style.color = '#E63946'}
                  >
                    ⬇ Download MP3
                  </a>
                  {music.version > 1 && (
                    <span style={{ color: '#00D26A', fontSize: '11px' }}>
                      ✓ 320kbps available
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}