import { useState, useEffect } from 'react';
import type { Project, LyricsGeneration, MusicGeneration } from '../App';
import LyricsEditor from '../components/LyricsEditor/LyricsEditor';
import MusicPlayer from '../components/MusicPlayer/MusicPlayer';
import WorkflowStepper from '../components/WorkflowControl/WorkflowStepper';

interface StudioProps {
  project: Project;
  onBack: () => void;
}

type WorkflowStep = 'lyrics' | 'music' | 'ffmpeg';

export default function Studio({ project, onBack }: StudioProps) {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('lyrics');
  const [selectedLyrics, setSelectedLyrics] = useState<LyricsGeneration | null>(null);
  const [selectedMusic, setSelectedMusic] = useState<MusicGeneration | null>(null);

  useEffect(() => {
    if (currentStep === 'ffmpeg' && !selectedMusic && project.current_music_version > 0) {
      fetch(`/api/projects/${project.id}/music`)
        .then(res => res.json())
        .then(musicList => {
          if (musicList.length > 0) {
            setSelectedMusic(musicList[0]);
          }
        })
        .catch(console.error);
    }
  }, [currentStep, project.id, selectedMusic, project.current_music_version]);

  const handleLyricsGenerated = (lyrics: LyricsGeneration) => {
    setSelectedLyrics(lyrics);
    setCurrentStep('music');
  };

  const handleMusicGenerated = (music: MusicGeneration) => {
    setSelectedMusic(music);
    setCurrentStep('ffmpeg');
  };

  return (
    <div style={{ backgroundColor: '#0A0A0A', minHeight: '100vh', padding: '24px', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: '#A0A0A0', cursor: 'pointer', fontSize: '14px', padding: '8px 12px', borderRadius: '8px' }}
            onMouseOver={(e) => e.currentTarget.style.color = '#FFFFFF'}
            onMouseOut={(e) => e.currentTarget.style.color = '#A0A0A0'}
          >
            ← Back to Projects
          </button>
          <h2 style={{ color: '#FFFFFF', fontSize: '24px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>{project.name}</h2>
        </div>

        <WorkflowStepper
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          hasLyrics={project.current_lyrics_version > 0}
          hasMusic={project.current_music_version > 0}
        />

        <div style={{ backgroundColor: '#141414', borderRadius: '12px', padding: '24px', marginTop: '24px', border: '1px solid #2A2A2A' }}>
          {currentStep === 'lyrics' && (
            <LyricsEditor
              projectId={project.id}
              onLyricsGenerated={handleLyricsGenerated}
            />
          )}
          {currentStep === 'music' && (
            <MusicPlayer
              projectId={project.id}
              selectedLyrics={selectedLyrics}
              onMusicGenerated={handleMusicGenerated}
            />
          )}
          {currentStep === 'ffmpeg' && (
            <FFmpegPanel
              projectId={project.id}
              selectedMusic={selectedMusic}
              onMusicSelect={setSelectedMusic}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface FFmpegPanelProps {
  projectId: string;
  selectedMusic: MusicGeneration | null;
  onMusicSelect: (music: MusicGeneration) => void;
}

function FFmpegPanel({ projectId, selectedMusic, onMusicSelect }: FFmpegPanelProps) {
  const [allMusic, setAllMusic] = useState<MusicGeneration[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processingVersion, setProcessingVersion] = useState<number | null>(null);
  const [results, setResults] = useState<Record<string, { durationSeconds: number; bitrate: number }>>({});

  useEffect(() => {
    fetch(`/api/projects/${projectId}/music`)
      .then(res => res.json())
      .then(setAllMusic)
      .catch(console.error);
  }, [projectId]);

  const processAudio = async (music: MusicGeneration) => {
    setProcessing(true);
    setProcessingVersion(music.version);
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
          setResults(prev => ({
            ...prev,
            [music.id]: updatedJob.result
          }));
          setProcessing(false);
          setProcessingVersion(null);
        } else if (updatedJob.status === 'failed') {
          setProcessing(false);
          setProcessingVersion(null);
          alert('Processing failed: ' + updatedJob.error_message);
        } else {
          setTimeout(poll, 1000);
        }
      };
      poll();
    } catch (error) {
      setProcessing(false);
      setProcessingVersion(null);
      alert('Failed to start processing');
    }
  };

  const isProcessed = (music: MusicGeneration) => {
    return music.processed_file_path || results[music.id];
  };

  const getBitrate = (music: MusicGeneration) => {
    if (results[music.id]) {
      return Math.round(results[music.id].bitrate / 1000);
    }
    return music.bitrate ? Math.round(music.bitrate / 1000) : null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h3 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 600, marginBottom: '8px', fontFamily: 'Outfit, sans-serif' }}>Export Audio</h3>
        <p style={{ color: '#A0A0A0', fontSize: '14px' }}>Upgrade your tracks to premium 320kbps MP3</p>
      </div>

      {/* Music Version Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <label style={{ color: '#A0A0A0', fontSize: '12px', fontWeight: 500 }}>Select track to export:</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {allMusic.map(music => {
            const processed = isProcessed(music);
            const bitrate = getBitrate(music);
            const currentBitrate = music.bitrate ? Math.round(music.bitrate / 1000) : null;
            const isSelected = selectedMusic?.id === music.id;
            const isCurrentlyProcessing = processingVersion === music.version;

            return (
              <div
                key={music.id}
                onClick={() => !processing && onMusicSelect(music)}
                style={{
                  backgroundColor: isSelected ? '#1E1E1E' : '#141414',
                  border: `1px solid ${isSelected ? '#E63946' : '#2A2A2A'}`,
                  borderRadius: '12px',
                  padding: '16px 20px',
                  cursor: processing ? 'not-allowed' : 'pointer',
                  transition: 'all 150ms ease',
                  opacity: processing && !isCurrentlyProcessing ? 0.6 : 1,
                }}
                onMouseOver={(e) => {
                  if (!processing) {
                    (e.currentTarget as HTMLElement).style.borderColor = '#E63946';
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#1E1E1E';
                  }
                }}
                onMouseOut={(e) => {
                  if (!processing) {
                    (e.currentTarget as HTMLElement).style.borderColor = isSelected ? '#E63946' : '#2A2A2A';
                    (e.currentTarget as HTMLElement).style.backgroundColor = isSelected ? '#1E1E1E' : '#141414';
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* Radio indicator */}
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: `2px solid ${isSelected ? '#E63946' : '#666666'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {isSelected && (
                        <div style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: '#E63946',
                        }} />
                      )}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <span style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                          Version {music.version}
                        </span>
                        <span style={{
                          backgroundColor: '#2A2A2A',
                          color: '#A0A0A0',
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}>
                          {music.model}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Current bitrate */}
                        <span style={{
                          fontSize: '12px',
                          color: currentBitrate ? '#FFB800' : '#666666',
                        }}>
                          {currentBitrate ? `${currentBitrate}kbps` : 'Unknown'}
                        </span>

                        {currentBitrate && (
                          <span style={{ color: '#666666', fontSize: '12px' }}>→</span>
                        )}

                        {/* Target bitrate */}
                        <span style={{
                          fontSize: '12px',
                          color: processed ? '#00D26A' : '#E63946',
                          fontWeight: processed ? 600 : 400,
                        }}>
                          {processed ? '320kbps ✓' : '320kbps'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action button */}
                  {processed ? (
                    <span style={{
                      color: '#00D26A',
                      fontSize: '13px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Ready
                    </span>
                  ) : isCurrentlyProcessing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #E63946',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                      }} />
                      <span style={{ color: '#E63946', fontSize: '13px' }}>Processing...</span>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        processAudio(music);
                      }}
                      disabled={processing}
                      style={{
                        backgroundColor: '#E63946',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 20px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: processing ? 'not-allowed' : 'pointer',
                        opacity: processing ? 0.5 : 1,
                      }}
                      onMouseOver={(e) => { if (!processing) (e.currentTarget as HTMLElement).style.backgroundColor = '#FF4757'; }}
                      onMouseOut={(e) => { if (!processing) (e.currentTarget as HTMLElement).style.backgroundColor = '#E63946'; }}
                    >
                      Convert
                    </button>
                  )}
                </div>

                {/* Processing progress bar */}
                {isCurrentlyProcessing && (
                  <div style={{
                    marginTop: '12px',
                    height: '3px',
                    backgroundColor: '#2A2A2A',
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: '60%',
                      backgroundColor: '#E63946',
                      borderRadius: '2px',
                      animation: 'processing 2s ease-in-out infinite',
                    }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Instructions */}
      <div style={{
        backgroundColor: '#0A0A0A',
        borderRadius: '10px',
        padding: '16px 20px',
        border: '1px solid #2A2A2A',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: '#E63946', flexShrink: 0, marginTop: '2px' }}>
            <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10 6V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="10" cy="13.5" r="0.75" fill="currentColor"/>
          </svg>
          <div>
            <p style={{ color: '#FFFFFF', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
              Why 320kbps?
            </p>
            <p style={{ color: '#666666', fontSize: '12px', lineHeight: 1.5 }}>
              320kbps is the highest MP3 bitrate. It preserves audio quality for streaming and sharing. Select a track above to convert it.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes processing {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}