import { useState, useEffect } from 'react';
import type { MusicGeneration } from '../../App';

interface VideoPreviewProps {
  projectId: string;
  selectedMusic: MusicGeneration | null;
  onVideoGenerated?: (video: VideoGeneration) => void;
}

interface VideoGeneration {
  id: string;
  project_id: string;
  music_id?: string;
  version: number;
  model: string;
  prompt?: string;
  duration?: number;
  resolution?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_id?: string;
  file_path?: string;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export default function VideoPreview({ projectId, selectedMusic, onVideoGenerated }: VideoPreviewProps) {
  const [videoHistory, setVideoHistory] = useState<VideoGeneration[]>([]);
  const [generating, setGenerating] = useState(false);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState('MiniMax-Hailuo-2.3');
  const [prompt, setPrompt] = useState<string>('');
  const [duration, setDuration] = useState<5 | 6>(6);
  const [resolution, setResolution] = useState<'1080P' | '720P'>('1080P');
  const [selectedVideo, setSelectedVideo] = useState<VideoGeneration | null>(null);

  useEffect(() => {
    fetchVideos();
  }, [projectId]);

  const fetchVideos = () => {
    fetch(`/api/projects/${projectId}/video`)
      .then(res => res.json())
      .then(setVideoHistory)
      .catch(console.error);
  };

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

        if (job.status === 'completed' && job.result?.videoId) {
          const videoRes = await fetch(`/api/video/${job.result.videoId}`);
          if (!videoRes.ok) {
            console.error('Failed to fetch video:', videoRes.status);
            setPollingJobId(null);
            setGenerating(false);
            return;
          }
          const video = await videoRes.json();
          setVideoHistory(prev => [video, ...prev]);
          onVideoGenerated?.(video);
          setPollingJobId(null);
          setGenerating(false);
        } else if (job.status === 'failed') {
          setError(job.error_message || 'Video generation failed');
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

  const generateVideo = async () => {
    if (!selectedMusic) {
      setError('Please select music first');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const payload = {
        projectId,
        musicId: selectedMusic.id,
        model,
        prompt: prompt || undefined,
        duration,
        resolution,
      };

      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate video');
      }

      const result = await response.json();
      if (result.jobId) {
        setPollingJobId(result.jobId);
      } else {
        setGenerating(false);
      }
    } catch (err: any) {
      setError(err.message);
      setGenerating(false);
    }
  };

  const isProcessing = generating || !!pollingJobId;

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Generate Section */}
      <div>
        <h3 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', marginBottom: '16px' }}>
          Generate Video
        </h3>

        {selectedMusic && (
          <div style={{ backgroundColor: '#1E1E1E', padding: '16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #2A2A2A' }}>
            <div style={{ color: '#A0A0A0', fontSize: '12px', marginBottom: '4px' }}>Using music:</div>
            <div style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 500 }}>
              {selectedMusic.title || `Version ${selectedMusic.version}`}
            </div>
            <div style={{ color: '#666666', fontSize: '12px', marginTop: '4px' }}>
              {selectedMusic.duration_seconds ? `${Math.round(selectedMusic.duration_seconds / 1000)}s` : ''} • {selectedMusic.model}
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
              {['MiniMax-Hailuo-2.3', 'MiniMax-Hailuo-02'].map(m => (
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
            <div style={{ color: '#666666', fontSize: '11px', marginTop: '6px' }}>
              Hailuo-2.3: Text-to-Video • Hailuo-02: First-and-Last-Frame
            </div>
          </div>

          {/* Duration */}
          <div>
            <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', marginBottom: '8px', fontWeight: 500 }}>
              Duration
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {([5, 6] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: duration === d ? '#E63946' : '#2A2A2A',
                    backgroundColor: duration === d ? '#E63946' : '#1E1E1E',
                    color: duration === d ? '#FFFFFF' : '#A0A0A0',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div>
            <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', marginBottom: '8px', fontWeight: 500 }}>
              Resolution
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['1080P', '720P'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setResolution(r)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: resolution === r ? '#E63946' : '#2A2A2A',
                    backgroundColor: resolution === r ? '#E63946' : '#1E1E1E',
                    color: resolution === r ? '#FFFFFF' : '#A0A0A0',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div>
            <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', marginBottom: '8px', fontWeight: 500 }}>
              Video Prompt (optional)
            </label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="urban street scene, night city, energetic..."
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

          {error && (
            <div style={{ color: '#E63946', fontSize: '13px', padding: '8px 12px', backgroundColor: 'rgba(230, 57, 70, 0.1)', borderRadius: '6px' }}>
              {error}
            </div>
          )}

          {pollingJobId && (
            <div style={{ color: '#A0A0A0', fontSize: '13px', padding: '12px 16px', backgroundColor: 'rgba(230, 57, 70, 0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '16px', height: '16px', border: '2px solid #E63946', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span>Generating video... (job: {pollingJobId.slice(0, 8)}...)</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          <button
            onClick={generateVideo}
            disabled={isProcessing || !selectedMusic}
            style={{
              backgroundColor: isProcessing || !selectedMusic ? '#666666' : '#E63946',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '14px 24px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isProcessing || !selectedMusic ? 'not-allowed' : 'pointer',
              transition: 'all 150ms ease',
              alignSelf: 'flex-start',
            }}
            onMouseOver={(e) => { if (!isProcessing && selectedMusic) e.currentTarget.style.backgroundColor = '#FF4757'; }}
            onMouseOut={(e) => { if (!isProcessing && selectedMusic) e.currentTarget.style.backgroundColor = '#E63946'; }}
          >
            {pollingJobId ? '⏳ Generating...' : generating ? '🚀 Starting...' : '🎬 Generate Video'}
          </button>
        </div>
      </div>

      {/* Video History */}
      {videoHistory.length > 0 && (
        <div>
          <h4 style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 600, marginBottom: '12px', fontFamily: 'Outfit, sans-serif' }}>
            Video Versions
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {videoHistory.map(video => (
              <div
                key={video.id}
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
                      Version {video.version}
                    </span>
                    <span style={{
                      color: video.status === 'completed' ? '#00D26A' :
                             video.status === 'failed' ? '#E63946' : '#FFB800',
                      fontSize: '12px',
                      padding: '2px 8px',
                      backgroundColor: video.status === 'completed' ? 'rgba(0, 210, 106, 0.1)' :
                                       video.status === 'failed' ? 'rgba(230, 57, 70, 0.1)' : 'rgba(255, 184, 0, 0.1)',
                      borderRadius: '4px',
                    }}>
                      {video.status}
                    </span>
                  </div>
                  <span style={{ color: '#666666', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>
                    {video.model}
                  </span>
                </div>

                <div style={{ color: '#A0A0A0', fontSize: '12px', marginBottom: '8px' }}>
                  {video.duration}s • {video.resolution}
                  {video.prompt && ` • "${video.prompt.substring(0, 50)}${video.prompt.length > 50 ? '...' : ''}"`}
                </div>

                {/* Video Player */}
                {video.status === 'completed' && video.file_path && (
                  <div style={{ marginTop: '12px' }}>
                    <video
                      controls
                      src={`/api/video/${video.id}/file`}
                      style={{
                        width: '100%',
                        maxHeight: '300px',
                        borderRadius: '8px',
                        backgroundColor: '#000',
                      }}
                    />
                  </div>
                )}

                {/* Error Message */}
                {video.status === 'failed' && video.error_message && (
                  <div style={{ color: '#E63946', fontSize: '12px', marginTop: '8px', padding: '8px', backgroundColor: 'rgba(230, 57, 70, 0.1)', borderRadius: '6px' }}>
                    Error: {video.error_message}
                  </div>
                )}

                {/* Actions */}
                {video.status === 'completed' && (
                  <div style={{ marginTop: '12px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setSelectedVideo(video)}
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
                      Preview
                    </button>

                    {/* Download button */}
                    <a
                      href={`/api/video/${video.id}/file`}
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
                      Download MP4
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video Modal */}
      {selectedVideo && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
          onClick={() => setSelectedVideo(null)}
        >
          <div
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              backgroundColor: '#141414',
              borderRadius: '12px',
              padding: '24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 600 }}>
                Video v{selectedVideo.version}
              </h3>
              <button
                onClick={() => setSelectedVideo(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#A0A0A0',
                  cursor: 'pointer',
                  fontSize: '24px',
                  padding: '4px 8px',
                }}
              >
                ×
              </button>
            </div>
            <video
              controls
              autoPlay
              src={`/api/video/${selectedVideo.id}/file`}
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                borderRadius: '8px',
                backgroundColor: '#000',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}