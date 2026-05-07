import { useState, useEffect } from 'react';
import type { LyricsGeneration, MusicGeneration } from '../../App';
import SpotifyWaveformPlayer from './SpotifyWaveformPlayer';
import AudioUpload from '../AudioEditor/AudioUpload';
import ErrorDisplay from '../ErrorDisplay/ErrorDisplay';
import { parseApiError } from '../../utils/errors';

interface MusicPlayerProps {
  projectId: string;
  selectedLyrics: LyricsGeneration | null;
  onMusicGenerated: (music: MusicGeneration) => void;
  onSelectForPlayer?: (music: MusicGeneration) => void;
  allMusic?: MusicGeneration[];
  onConversionComplete?: () => void;
}

export default function MusicPlayer({ projectId, selectedLyrics, onMusicGenerated, onSelectForPlayer,  onConversionComplete }: MusicPlayerProps) {
  const [generating, setGenerating] = useState(false);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [musicHistory, setMusicHistory] = useState<MusicGeneration[]>([]);
  const [model, setModel] = useState('music-2.6');
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [mode, setMode] = useState<'generate' | 'cover'>('generate');
  const [coverAudioUrl, setCoverAudioUrl] = useState<string>('');
  const [coverPrompt, setCoverPrompt] = useState<string>('');
  const [seed, setSeed] = useState<number>(Math.floor(Math.random() * 1000000));
  const [genre, setGenre] = useState<string>('');
  const [mood, setMood] = useState<string>('');
  const [vocalStyle, setVocalStyle] = useState<string>('');
  const [instruments, setInstruments] = useState<string>('');
  const [bpm, setBpm] = useState<number | undefined>();
  const [key, setKey] = useState<string>('');
  const [voice, setVoice] = useState<string>('');
  const [language, setLanguage] = useState<string>('english');
  const [customPrompt, setCustomPrompt] = useState<string>('');

  const inputStyle = {
    width: '100%',
    backgroundColor: '#141414',
    border: '1px solid #2A2A2A',
    borderRadius: '6px',
    padding: '8px 12px',
    color: '#FFFFFF',
    fontSize: '13px',
    outline: 'none',
  };

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
        if (!res.ok) {
          console.error('Poll failed:', res.status);
          setTimeout(poll, 3000);
          return;
        }
        const job = await res.json();

        if (job.status === 'completed' && job.result?.musicId) {
          const musicRes = await fetch(`/api/music/${job.result.musicId}`);
          if (!musicRes.ok) {
            console.error('Failed to fetch music:', musicRes.status);
            setPollingJobId(null);
            setGenerating(false);
            return;
          }
          const music = await musicRes.json();
          setMusicHistory(prev => [music, ...prev]);
          onMusicGenerated(music);
          setPollingJobId(null);
          setGenerating(false);
        } else if (job.status === 'failed') {
          setError(Object.assign(new Error(job.error_message || 'Music generation failed'), parseApiError(job)));
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
    if (mode === 'cover' && !coverAudioUrl) {
      setError('Please provide reference audio URL for cover mode');
      return;
    }

    if (!selectedLyrics && mode === 'generate') {
      setError('Please select lyrics first');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const payload = mode === 'cover' ? {
        projectId,
        audioUrl: coverAudioUrl,
        prompt: coverPrompt,
        model: 'music-cover',
        seed,
        ...(genre && { genre }),
        ...(mood && { mood }),
        ...(vocalStyle && { vocalStyle }),
        ...(instruments && { instruments }),
        ...(bpm && { bpm }),
        ...(key && { key }),
      } : {
        projectId,
        lyricsId: selectedLyrics?.id,
        model,
        prompt: customPrompt || undefined,
        voice,
        language,
        ...(genre && { genre }),
        ...(mood && { mood }),
        ...(vocalStyle && { vocalStyle }),
        ...(instruments && { instruments }),
        ...(bpm && { bpm }),
        ...(key && { key }),
      };

      const response = await fetch('/api/music/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw Object.assign(new Error(err.error || 'Failed to generate music'), parseApiError(err));
      }

      const music = await response.json();
      if (music.jobId) {
        setPollingJobId(music.jobId);
      } else {
        setMusicHistory(prev => [music, ...prev]);
        onMusicGenerated(music);
        setGenerating(false);
      }
    } catch (err) {
      setError(err);
      setGenerating(false);
    }
  };

  const convertTo320 = async (music: MusicGeneration) => {
    setConvertingId(music.id);
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: music.project_id,
          type: 'ffmpeg-process',
          inputParams: { musicId: music.id },
        }),
      });
      const job = await response.json();
      const poll = async () => {
        const res = await fetch(`/api/jobs/${job.id}`);
        const updatedJob = await res.json();
        if (updatedJob.status === 'completed') {
          // Refresh music to get updated processed_file_path
          const musicRes = await fetch(`/api/music/${music.id}`);
          const updatedMusic = await musicRes.json();
          setMusicHistory(prev => prev.map(m => m.id === music.id ? updatedMusic : m));
          setConvertingId(null);
          onConversionComplete?.();
        } else if (updatedJob.status === 'failed') {
          setConvertingId(null);
          alert('Conversion failed');
        } else {
          setTimeout(poll, 1000);
        }
      };
      poll();
    } catch (error) {
      setConvertingId(null);
      alert('Failed to start conversion');
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

          {/* Custom Prompt */}
          <div>
            <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', marginBottom: '8px', fontWeight: 500 }}>
              Custom Prompt
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Slow lo-fi trance track, minimal and clean studio mix. Soft ambient pads, light acoustic guitar texture, very subtle beat, no heavy drums. Focus on atmosphere and space..."
              maxLength={1500}
              style={{
                width: '100%',
                height: '80px',
                backgroundColor: '#141414',
                border: '1px solid #2A2A2A',
                borderRadius: '8px',
                padding: '12px 16px',
                color: '#FFFFFF',
                fontSize: '13px',
                fontFamily: 'DM Sans, sans-serif',
                resize: 'vertical',
                outline: 'none',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#E63946'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#2A2A2A'}
            />
            <div style={{ color: '#666666', fontSize: '11px', marginTop: '4px', textAlign: 'right' }}>
              {customPrompt.length}/1500
            </div>
          </div>

          {/* Mode Toggle */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              onClick={() => setMode('generate')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: mode === 'generate' ? '#E63946' : '#2A2A2A',
                backgroundColor: mode === 'generate' ? '#E63946' : '#1E1E1E',
                color: mode === 'generate' ? '#FFFFFF' : '#A0A0A0',
                cursor: 'pointer',
              }}
            >
              Generate New
            </button>
            <button
              onClick={() => setMode('cover')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: mode === 'cover' ? '#E63946' : '#2A2A2A',
                backgroundColor: mode === 'cover' ? '#E63946' : '#1E1E1E',
                color: mode === 'cover' ? '#FFFFFF' : '#A0A0A0',
                cursor: 'pointer',
              }}
            >
              Cover Mode
            </button>
          </div>

          {/* Cover Mode Inputs */}
          {mode === 'cover' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <div>
                <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', marginBottom: '8px', fontWeight: 500 }}>
                  Reference Audio
                </label>
                <AudioUpload
                  projectId={projectId}
                  onUploaded={(track) => setCoverAudioUrl(`/api/upload/${track.id}/file`)}
                  acceptTypes={['.mp3', '.wav', '.flac', '.ogg', '.m4a']}
                  maxSizeMB={50}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', marginBottom: '8px', fontWeight: 500 }}>
                  Style Prompt
                </label>
                <input
                  type="text"
                  value={coverPrompt}
                  onChange={(e) => setCoverPrompt(e.target.value)}
                  placeholder="acoustic cover, intimate, soft vocals"
                  style={{
                    width: '100%',
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
              </div>
              <div>
                <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', marginBottom: '8px', fontWeight: 500 }}>
                  Seed (for reproducible results): {seed}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1000000"
                  value={seed}
                  onChange={(e) => setSeed(parseInt(e.target.value))}
                  style={{ width: '200px', accentColor: '#E63946' }}
                />
                <button
                  onClick={() => setSeed(Math.floor(Math.random() * 1000000))}
                  style={{
                    marginLeft: '12px',
                    padding: '4px 12px',
                    backgroundColor: '#2A2A2A',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#A0A0A0',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Random
                </button>
              </div>
            </div>
          )}

          {error && (
            <ErrorDisplay
              error={error}
              onDismiss={() => setError(null)}
              onRetry={generateMusic}
            />
          )}

          <details style={{ marginTop: '16px', marginBottom: '16px' }}>
            <summary style={{ color: '#A0A0A0', cursor: 'pointer', fontSize: '13px', listStyle: 'none' }}>
              ⚙️ Advanced Options ▼
            </summary>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
              <div>
                <label style={{ display: 'block', color: '#A0A0A0', fontSize: '11px', marginBottom: '6px' }}>Genre</label>
                <input
                  type="text"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="hip-hop, electronic, rock..."
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#E63946'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#2A2A2A'}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#A0A0A0', fontSize: '11px', marginBottom: '6px' }}>Mood</label>
                <input
                  type="text"
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  placeholder="energetic, melancholic..."
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#E63946'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#2A2A2A'}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#A0A0A0', fontSize: '11px', marginBottom: '6px' }}>Vocal Style</label>
                <input
                  type="text"
                  value={vocalStyle}
                  onChange={(e) => setVocalStyle(e.target.value)}
                  placeholder="aggressive, soft, auto-tune..."
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#E63946'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#2A2A2A'}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#A0A0A0', fontSize: '11px', marginBottom: '6px' }}>Instruments</label>
                <input
                  type="text"
                  value={instruments}
                  onChange={(e) => setInstruments(e.target.value)}
                  placeholder="drums, bass, piano..."
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#E63946'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#2A2A2A'}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#A0A0A0', fontSize: '11px', marginBottom: '6px' }}>BPM</label>
                <input
                  type="number"
                  value={bpm || ''}
                  onChange={(e) => setBpm(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="120"
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#E63946'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#2A2A2A'}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#A0A0A0', fontSize: '11px', marginBottom: '6px' }}>Key</label>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="C major, A minor..."
                  style={inputStyle}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#E63946'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#2A2A2A'}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#A0A0A0', fontSize: '11px', marginBottom: '6px' }}>Voice</label>
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="">Auto-detect</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: '#A0A0A0', fontSize: '11px', marginBottom: '6px' }}>Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="english">English</option>
                  <option value="chinese">Chinese</option>
                  <option value="japanese">Japanese</option>
                  <option value="korean">Korean</option>
                  <option value="spanish">Spanish</option>
                  <option value="french">French</option>
                  <option value="hindi">Hindi</option>
                </select>
              </div>
            </div>
          </details>

          {pollingJobId && (
            <div style={{ color: '#A0A0A0', fontSize: '13px', padding: '12px 16px', backgroundColor: 'rgba(230, 57, 70, 0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '16px', height: '16px', border: '2px solid #E63946', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span>Generating... (job: {pollingJobId.slice(0, 8)}...)</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          <button
            onClick={generateMusic}
            disabled={isProcessing || (mode === 'generate' && !selectedLyrics) || (mode === 'cover' && !coverAudioUrl)}
            style={{
              backgroundColor: isProcessing || (mode === 'generate' && !selectedLyrics) || (mode === 'cover' && !coverAudioUrl) ? '#666666' : '#E63946',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '14px 24px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isProcessing || (mode === 'generate' && !selectedLyrics) || (mode === 'cover' && !coverAudioUrl) ? 'not-allowed' : 'pointer',
              transition: 'all 150ms ease',
              alignSelf: 'flex-start',
            }}
            onMouseOver={(e) => { if (!isProcessing && ((mode === 'generate' && selectedLyrics) || (mode === 'cover' && coverAudioUrl))) e.currentTarget.style.backgroundColor = '#FF4757'; }}
            onMouseOut={(e) => { if (!isProcessing && ((mode === 'generate' && selectedLyrics) || (mode === 'cover' && coverAudioUrl))) e.currentTarget.style.backgroundColor = '#E63946'; }}
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
                    artworkUrl={`/api/projects/${music.project_id}/artwork`}
                  />
                )}

                {/* Quick Export Actions */}
                <div style={{ marginTop: '12px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Play in persistent bar */}
                  <button
                    onClick={() => onSelectForPlayer?.(music)}
                    style={{
                      color: '#E63946',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 500,
                      backgroundColor: 'rgba(230, 57, 70, 0.1)',
                      border: '1px solid rgba(230, 57, 70, 0.3)',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                    onMouseOver={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(230, 57, 70, 0.2)';
                      (e.currentTarget as HTMLElement).style.borderColor = '#E63946';
                    }}
                    onMouseOut={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(230, 57, 70, 0.1)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(230, 57, 70, 0.3)';
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 2V10L10 6L3 2Z" fill="currentColor"/>
                    </svg>
                    Play in Bar
                  </button>

                  {/* Download button */}
                  <a
                    href={`/api/music/${music.id}/file`}
                    download
                    style={{
                      color: '#FFFFFF',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 500,
                      backgroundColor: '#2A2A2A',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                    onMouseOver={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = '#3A3A3A'}
                    onMouseOut={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = '#2A2A2A'}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M6 1V7.5M3 5L6 8.5L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M1.5 10H10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    Download
                  </a>

                  {/* 320kbps quick action */}
                  {music.processed_file_path ? (
                    <a
                      href={`/api/music/${music.id}/file`}
                      download
                      style={{
                        color: '#000000',
                        textDecoration: 'none',
                        fontSize: '13px',
                        fontWeight: 600,
                        backgroundColor: '#00D26A',
                        padding: '8px 14px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                      onMouseOver={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = '#00E676'}
                      onMouseOut={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = '#00D26A'}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M10 6L4.5 10.5V1.5L10 6Z" fill="currentColor"/>
                      </svg>
                      320kbps MP3
                    </a>
                  ) : convertingId === music.id ? (
                    <span style={{
                      color: '#E63946',
                      fontSize: '13px',
                      fontWeight: 500,
                      padding: '8px 14px',
                      backgroundColor: 'rgba(230, 57, 70, 0.1)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}>
                      <div style={{ width: '12px', height: '12px', border: '2px solid #E63946', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      Converting...
                    </span>
                  ) : (
                    <button
                      onClick={() => convertTo320(music)}
                      style={{
                        color: '#FFB800',
                        fontSize: '13px',
                        fontWeight: 500,
                        backgroundColor: 'rgba(255, 184, 0, 0.1)',
                        border: '1px solid rgba(255, 184, 0, 0.3)',
                        padding: '8px 14px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                      onMouseOver={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 184, 0, 0.2)';
                        (e.currentTarget as HTMLElement).style.borderColor = '#FFB800';
                      }}
                      onMouseOut={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 184, 0, 0.1)';
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255, 184, 0, 0.3)';
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M10 6L4.5 10.5V1.5L10 6Z" fill="currentColor"/>
                      </svg>
                      Get 320kbps
                    </button>
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