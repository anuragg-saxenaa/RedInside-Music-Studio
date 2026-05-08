import { useState, useEffect } from 'react';
import type { Project, LyricsGeneration, MusicGeneration } from '../types';
import LyricsEditor from '../components/LyricsEditor/LyricsEditor';
import MusicPlayer from '../components/MusicPlayer/MusicPlayer';
import ArtworkGenerator from '../components/ArtworkGenerator/ArtworkGenerator';
import VoiceDesign from '../components/VoiceDesign/VoiceDesign';
import WorkflowStepper from '../components/WorkflowControl/WorkflowStepper';
import CompactPlayer from '../components/MusicPlayer/CompactPlayer';
import AudioEditorPanel from '../components/AudioEditor/AudioEditorPanel';

interface StudioProps {
  project: Project;
  onBack: () => void;
}

type WorkflowStep = 'lyrics' | 'music' | 'artwork' | 'voice' | 'export' | 'edit';

export default function Studio({ project, onBack }: StudioProps) {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('lyrics');
  const [selectedLyrics, setSelectedLyrics] = useState<LyricsGeneration | null>(null);
  const [selectedMusic, setSelectedMusic] = useState<MusicGeneration | null>(null);
  const [activePlayerMusic, setActivePlayerMusic] = useState<MusicGeneration | null>(null);
  const [allMusicList, setAllMusicList] = useState<MusicGeneration[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [editingMusic, setEditingMusic] = useState<MusicGeneration | null>(null);

  useEffect(() => {
    if (project.current_music_version > 0) {
      fetchMusicList();
    }
    // Load existing artwork if available
    fetch(`/api/projects/${project.id}/artwork`)
      .then(res => res.ok ? res.blob() : null)
      .then(blob => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setArtworkUrl(url);
        }
      })
      .catch(() => {});
  }, [project.id, project.current_music_version, refreshKey]);

  const fetchMusicList = () => {
    fetch(`/api/projects/${project.id}/music`)
      .then(res => res.json())
      .then(musicList => {
        setAllMusicList(musicList);
        if (currentStep === 'export' && !selectedMusic && musicList.length > 0) {
          setSelectedMusic(musicList[0]);
        }
      })
      .catch(console.error);
  };

  const handleLyricsGenerated = (lyrics: LyricsGeneration) => {
    setSelectedLyrics(lyrics);
    setCurrentStep('music');
  };

  const handleMusicGenerated = (music: MusicGeneration) => {
    setSelectedMusic(music);
    setActivePlayerMusic(music);
    setCurrentStep('artwork');
    // Reset artwork when new music is generated - artwork step will load per-music artwork
    setArtworkUrl(null);
  };

  // Fetch per-music artwork when entering artwork step
  useEffect(() => {
    if (currentStep === 'artwork' && selectedMusic) {
      fetch(`/api/projects/${project.id}/artwork/${selectedMusic.id}`)
        .then(res => res.ok ? res.blob() : null)
        .then(blob => {
          if (blob) {
            setArtworkUrl(URL.createObjectURL(blob));
          }
        })
        .catch(() => {});
    }
  }, [currentStep, selectedMusic?.id]);

  const handleSelectForPlayer = (music: MusicGeneration) => {
    setActivePlayerMusic(music);
  };

  const handleConversionComplete = () => {
    setRefreshKey(k => k + 1);
  };

  return (
    <div style={{ backgroundColor: '#0A0A0A', minHeight: '100vh', padding: '24px', fontFamily: 'DM Sans, sans-serif', paddingBottom: activePlayerMusic ? '140px' : '80px' }}>
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

        <div style={{ backgroundColor: '#141414', borderRadius: '12px', padding: '24px', marginTop: '24px', border: '1px solid #2A2A2A', minHeight: '400px' }}>
          <div style={{ display: currentStep === 'lyrics' ? 'block' : 'none' }}>
            <LyricsEditor
              projectId={project.id}
              onLyricsGenerated={handleLyricsGenerated}
            />
          </div>
          <div style={{ display: currentStep === 'music' ? 'block' : 'none' }}>
            <MusicPlayer
              projectId={project.id}
              selectedLyrics={selectedLyrics}
              onMusicGenerated={handleMusicGenerated}
              onSelectForPlayer={handleSelectForPlayer}
              allMusic={allMusicList}
              onConversionComplete={handleConversionComplete}
            />
          </div>
          <div style={{ display: currentStep === 'artwork' ? 'block' : 'none' }}>
            <ArtworkGenerator
              projectId={project.id}
              musicId={selectedMusic?.id}
              onSelectArtwork={setArtworkUrl}
            />
          </div>
          <div style={{ display: currentStep === 'voice' ? 'block' : 'none' }}>
            <VoiceDesign />
          </div>
          <div style={{ display: currentStep === 'export' ? 'block' : 'none' }}>
            <FFmpegPanel
              projectId={project.id}
              selectedMusic={selectedMusic}
              onMusicSelect={setSelectedMusic}
              allMusic={allMusicList}
              onConversionComplete={handleConversionComplete}
              onEditMusic={(music) => {
                setEditingMusic(music);
                setCurrentStep('edit');
              }}
            />
          </div>
          <div style={{ display: currentStep === 'edit' ? 'block' : 'none' }}>
            {editingMusic ? (
              <AudioEditorPanel
                projectId={project.id}
                audioUrl={`/api/music/${editingMusic.id}/file`}
                trackId={editingMusic.id}
                onExport={(result) => {
                  console.log('Exported:', result);
                  setEditingMusic(null);
                  setCurrentStep('export');
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666666' }}>
                Select a music version to edit from the Export section
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Persistent Player Bar */}
      {activePlayerMusic && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#141414',
          borderTop: '1px solid #2A2A2A',
          padding: '12px 24px',
          zIndex: 1000,
        }}>
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <CompactPlayer
              musicId={activePlayerMusic.id}
              version={activePlayerMusic.version}
              durationMs={(activePlayerMusic.duration_seconds || 0) * 1000}
              audioUrl={`/api/music/${activePlayerMusic.id}/file`}
              title={activePlayerMusic.title || `Version ${activePlayerMusic.version}`}
              model={activePlayerMusic.model}
              artworkUrl={artworkUrl || undefined}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface FFmpegPanelProps {
  projectId: string;
  selectedMusic: MusicGeneration | null;
  onMusicSelect: (music: MusicGeneration) => void;
  allMusic: MusicGeneration[];
  onConversionComplete?: () => void;
  onEditMusic: (music: MusicGeneration) => void;
}

function FFmpegPanel({ selectedMusic, onMusicSelect, allMusic, onConversionComplete, onEditMusic }: FFmpegPanelProps) {
  const [processing, setProcessing] = useState(false);
  const [processingVersion, setProcessingVersion] = useState<number | null>(null);
  const [downloadReady, setDownloadReady] = useState<Record<string, { durationSeconds: number; bitrate: number }>>({});
  const [exportFormat, setExportFormat] = useState<'mp3' | 'wav' | 'pcm'>('mp3');
  const [exportBitrate, setExportBitrate] = useState<number>(320000);
  const [exportChannels, setExportChannels] = useState<1 | 2>(2);
  const [exportSampleRate, setExportSampleRate] = useState<number>(44100);

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
          inputParams: {
            musicId: music.id,
            format: exportFormat,
            bitrate: exportBitrate,
            channels: exportChannels,
            sampleRate: exportSampleRate,
          },
        }),
      });
      const job = await response.json();
      const poll = async () => {
        const res = await fetch(`/api/jobs/${job.id}`);
        const updatedJob = await res.json();
        if (updatedJob.status === 'completed') {
          setDownloadReady(prev => ({
            ...prev,
            [music.id]: updatedJob.result
          }));
          setProcessing(false);
          setProcessingVersion(null);
          onConversionComplete?.();
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
    return music.processed_file_path || downloadReady[music.id];
  };

  const getProcessedBitrate = (music: MusicGeneration) => {
    if (downloadReady[music.id]) {
      return Math.round((downloadReady[music.id].bitrate || 320000) / 1000);
    }
    // If music has processed_file_path from API, assume 320kbps
    if (music.processed_file_path) {
      return 320;
    }
    return null;
  };

  const sortedMusic = [...allMusic].sort((a, b) => b.version - a.version);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h3 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 600, marginBottom: '8px', fontFamily: 'Outfit, sans-serif' }}>Export for Release</h3>
        <p style={{ color: '#A0A0A0', fontSize: '14px' }}>Download your track as a premium 320kbps MP3</p>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {/* Format */}
        <div>
          <label style={{ display: 'block', color: '#A0A0A0', fontSize: '11px', marginBottom: '6px' }}>Format</label>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'mp3' | 'wav' | 'pcm')}
            style={{
              backgroundColor: '#1E1E1E',
              border: '1px solid #2A2A2A',
              borderRadius: '6px',
              padding: '8px 12px',
              color: '#FFFFFF',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <option value="mp3">MP3</option>
            <option value="wav">WAV</option>
            <option value="pcm">PCM</option>
          </select>
        </div>

        {/* Bitrate - only show for MP3 */}
        {exportFormat === 'mp3' && (
          <div>
            <label style={{ display: 'block', color: '#A0A0A0', fontSize: '11px', marginBottom: '6px' }}>Bitrate</label>
            <select
              value={exportBitrate}
              onChange={(e) => setExportBitrate(parseInt(e.target.value))}
              style={{
                backgroundColor: '#1E1E1E',
                border: '1px solid #2A2A2A',
                borderRadius: '6px',
                padding: '8px 12px',
                color: '#FFFFFF',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <option value="128000">128 kbps</option>
              <option value="192000">192 kbps</option>
              <option value="256000">256 kbps</option>
              <option value="320000">320 kbps</option>
            </select>
          </div>
        )}

        {/* Channels */}
        <div>
          <label style={{ display: 'block', color: '#A0A0A0', fontSize: '11px', marginBottom: '6px' }}>Channels</label>
          <select
            value={exportChannels}
            onChange={(e) => setExportChannels(parseInt(e.target.value) as 1 | 2)}
            style={{
              backgroundColor: '#1E1E1E',
              border: '1px solid #2A2A2A',
              borderRadius: '6px',
              padding: '8px 12px',
              color: '#FFFFFF',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <option value="2">Stereo</option>
            <option value="1">Mono</option>
          </select>
        </div>

        {/* Sample Rate */}
        <div>
          <label style={{ display: 'block', color: '#A0A0A0', fontSize: '11px', marginBottom: '6px' }}>Sample Rate</label>
          <select
            value={exportSampleRate}
            onChange={(e) => setExportSampleRate(parseInt(e.target.value))}
            style={{
              backgroundColor: '#1E1E1E',
              border: '1px solid #2A2A2A',
              borderRadius: '6px',
              padding: '8px 12px',
              color: '#FFFFFF',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <option value="22050">22.05 kHz</option>
            <option value="44100">44.1 kHz</option>
            <option value="48000">48 kHz</option>
            <option value="96000">96 kHz</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <label style={{ color: '#A0A0A0', fontSize: '12px', fontWeight: 500 }}>Choose a version to export:</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sortedMusic.map(music => {
            const processed = isProcessed(music);
            const processedBitrate = getProcessedBitrate(music);
            const isSelected = selectedMusic?.id === music.id;
            const isCurrentlyProcessing = processingVersion === music.version;
            const currentBitrate = music.bitrate ? Math.round(music.bitrate / 1000) : null;

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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                            {music.title || `Version ${music.version}`}
                          </span>
                          <span style={{
                            backgroundColor: '#2A2A2A',
                            color: '#A0A0A0',
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontFamily: 'JetBrains Mono, monospace',
                          }}>
                            v{music.version}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditMusic(music);
                          }}
                          style={{
                            backgroundColor: '#2A2A2A',
                            color: '#A0A0A0',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                          onMouseOver={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = '#3A3A3A';
                            (e.currentTarget as HTMLElement).style.color = '#FFFFFF';
                          }}
                          onMouseOut={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = '#2A2A2A';
                            (e.currentTarget as HTMLElement).style.color = '#A0A0A0';
                          }}
                        >
                          ✂️ Edit Audio
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {currentBitrate ? (
                          <>
                            <span style={{ color: '#FFB800', fontSize: '12px', fontWeight: 600 }}>
                              {currentBitrate}kbps
                            </span>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: '#666666' }}>
                              <path d="M2 7H12M8 3L12 7L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span style={{ color: '#00D26A', fontSize: '12px', fontWeight: 600 }}>
                              {processed ? `${processedBitrate || 320}kbps MP3 ✓` : '320kbps MP3'}
                            </span>
                          </>
                        ) : (
                          <span style={{ color: '#666666', fontSize: '12px' }}>
                            {processed ? `320kbps MP3 ✓` : 'Pending conversion...'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {processed ? (
                    <a
                      href={`/api/music/${music.id}/file`}
                      download
                      style={{
                        backgroundColor: '#00D26A',
                        color: '#000000',
                        textDecoration: 'none',
                        borderRadius: '8px',
                        padding: '10px 20px',
                        fontSize: '13px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 2V9M4 6L7 9L10 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M2 11H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      Download
                    </a>
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
                      Export 320kbps
                    </button>
                  )}
                </div>

                {isCurrentlyProcessing && (
                  <div style={{
                    marginTop: '16px',
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
                      animation: 'processing 1.5s ease-in-out infinite',
                    }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{
        backgroundColor: '#0A0A0A',
        borderRadius: '10px',
        padding: '16px 20px',
        border: '1px solid #2A2A2A',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
      }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: '#E63946', flexShrink: 0, marginTop: '2px' }}>
          <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M10 6V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="10" cy="13.5" r="0.75" fill="currentColor"/>
        </svg>
        <div>
          <p style={{ color: '#FFFFFF', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
            What is 320kbps MP3?
          </p>
          <p style={{ color: '#666666', fontSize: '12px', lineHeight: 1.5 }}>
            320kbps is the maximum MP3 quality. Use this file for streaming platforms, sharing, or distribution. Higher quality than Spotify (256kbps) or YouTube (128kbps).
          </p>
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