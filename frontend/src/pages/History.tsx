import { useState, useEffect } from 'react';
import SpotifyWaveformPlayer from '../components/MusicPlayer/SpotifyWaveformPlayer';
import type { Project, LyricsGeneration, MusicGeneration, HistoryData, CompareResult, ReplayData } from '../types';

export default function History() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'lyrics' | 'music'>('lyrics');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [replayData, setReplayData] = useState<ReplayData | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  };

  const loadProjectHistory = async (project: Project) => {
    setLoading(true);
    setSelectedProject(project);
    setHistory(null);
    setCompareMode(false);
    setSelectedVersions([]);
    setCompareResult(null);
    setReplayData(null);

    try {
      const res = await fetch(`/api/history/${project.id}`);
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVersionSelect = (id: string) => {
    if (selectedVersions.includes(id)) {
      setSelectedVersions(selectedVersions.filter(v => v !== id));
    } else if (selectedVersions.length < 2) {
      setSelectedVersions([...selectedVersions, id]);
    } else {
      setSelectedVersions([selectedVersions[1], id]);
    }
  };

  const handleCompare = async () => {
    if (selectedVersions.length !== 2) return;

    try {
      const res = await fetch('/api/history/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id1: selectedVersions[0],
          id2: selectedVersions[1],
          type: activeTab,
        }),
      });
      const result = await res.json();
      setCompareResult(result);
      setCompareMode(false);
    } catch (err) {
      console.error('Failed to compare:', err);
    }
  };

  const handleReplay = async (id: string) => {
    try {
      const res = await fetch(`/api/history/replay/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeTab }),
      });
      const data = await res.json();
      setReplayData(data);
    } catch (err) {
      console.error('Failed to replay:', err);
    }
  };

  const handleExportHistory = () => {
    if (!history || !selectedProject) return;

    const exportData = {
      project: {
        id: selectedProject.id,
        name: selectedProject.name,
        exportedAt: new Date().toISOString(),
      },
      lyrics: history.lyrics.map(l => ({
        id: l.id,
        version: l.version,
        title: l.title,
        content: l.content,
        style_preset: l.style_preset,
        created_at: l.created_at,
      })),
      music: history.music.map(m => ({
        id: m.id,
        version: m.version,
        model: m.model,
        duration_seconds: m.duration_seconds,
        bitrate: m.bitrate,
        created_at: m.created_at,
      })),
      chains: history.chains.map(c => ({
        id: c.id,
        lyrics_id: c.lyrics_id,
        music_id: c.music_id,
        video_id: c.video_id,
        created_at: c.created_at,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedProject.name.replace(/\s+/g, '_')}_history_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ color: '#FFFFFF', fontSize: '28px', fontWeight: 700, fontFamily: 'Outfit, sans-serif', marginBottom: '8px' }}>
              History Browser
            </h1>
            <p style={{ color: '#A0A0A0', fontSize: '14px' }}>
              Browse versions, compare changes, and replay past generations
            </p>
          </div>
          {history && selectedProject && (
            <button
              onClick={handleExportHistory}
              style={{
                backgroundColor: '#1E1E1E',
                color: '#FFFFFF',
                border: '1px solid #2A2A2A',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#E63946'; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#2A2A2A'; }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2V10M5 7L8 10L11 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Export JSON
            </button>
          )}
        </div>

        {/* Project Selector */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', color: '#A0A0A0', fontSize: '12px', marginBottom: '8px', fontWeight: 500 }}>
            Select Project
          </label>
          <select
            value={selectedProject?.id || ''}
            onChange={(e) => {
              const project = projects.find(p => p.id === e.target.value);
              if (project) loadProjectHistory(project);
            }}
            style={{
              width: '100%',
              maxWidth: '400px',
              backgroundColor: '#141414',
              border: '1px solid #2A2A2A',
              borderRadius: '8px',
              padding: '12px 16px',
              color: '#FFFFFF',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            <option value="">Choose a project...</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px', color: '#A0A0A0' }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: '3px solid #2A2A2A',
              borderTopColor: '#E63946',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }} />
            Loading history...
          </div>
        )}

        {!loading && history && selectedProject && (
          <>
            {/* Tab Switcher */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #2A2A2A', paddingBottom: '16px' }}>
              <button
                onClick={() => { setActiveTab('lyrics'); setCompareMode(false); setSelectedVersions([]); setCompareResult(null); }}
                style={{
                  backgroundColor: activeTab === 'lyrics' ? '#E63946' : 'transparent',
                  color: activeTab === 'lyrics' ? '#FFFFFF' : '#A0A0A0',
                  border: activeTab === 'lyrics' ? 'none' : '1px solid #2A2A2A',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                ✍️ Lyrics ({history.lyrics.length})
              </button>
              <button
                onClick={() => { setActiveTab('music'); setCompareMode(false); setSelectedVersions([]); setCompareResult(null); }}
                style={{
                  backgroundColor: activeTab === 'music' ? '#E63946' : 'transparent',
                  color: activeTab === 'music' ? '#FFFFFF' : '#A0A0A0',
                  border: activeTab === 'music' ? 'none' : '1px solid #2A2A2A',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                🎵 Music ({history.music.length})
              </button>

              {selectedVersions.length === 2 && !compareResult && (
                <button
                  onClick={handleCompare}
                  style={{
                    backgroundColor: '#00D26A',
                    color: '#000000',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginLeft: 'auto',
                  }}
                >
                  Compare Selected
                </button>
              )}

              {selectedVersions.length > 0 && !compareResult && (
                <button
                  onClick={() => { setCompareMode(!compareMode); setSelectedVersions([]); }}
                  style={{
                    backgroundColor: 'transparent',
                    color: '#E63946',
                    border: '1px solid #E63946',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    marginLeft: 'auto',
                  }}
                >
                  Cancel Selection
                </button>
              )}
            </div>

            {/* Compare Result */}
            {compareResult && (
              <CompareView
                compareResult={compareResult}
                lyricsData={activeTab === 'lyrics' ? history.lyrics : []}
                musicData={activeTab === 'music' ? history.music : []}
                onBack={() => { setCompareResult(null); setSelectedVersions([]); }}
                onReplay={(id) => handleReplay(id)}
              />
            )}

            {/* Replay Panel */}
            {replayData && (
              <ReplayPanel
                replayData={replayData}
                onClose={() => setReplayData(null)}
                projectId={selectedProject.id}
              />
            )}

            {/* Timeline View */}
            {!compareResult && !replayData && (
              <div>
                {activeTab === 'lyrics' && (
                  <LyricsTimeline
                    lyrics={history.lyrics}
                    compareMode={compareMode}
                    selectedVersions={selectedVersions}
                    onSelect={handleVersionSelect}
                    onReplay={handleReplay}
                    formatDate={formatDate}
                  />
                )}
                {activeTab === 'music' && (
                  <MusicTimeline
                    music={history.music}
                    compareMode={compareMode}
                    selectedVersions={selectedVersions}
                    onSelect={handleVersionSelect}
                    onReplay={handleReplay}
                    formatDate={formatDate}
                    formatDuration={formatDuration}
                  />
                )}
              </div>
            )}
          </>
        )}

        {!loading && !selectedProject && (
          <div style={{
            textAlign: 'center',
            padding: '80px 20px',
            backgroundColor: '#141414',
            borderRadius: '16px',
            border: '1px dashed #2A2A2A',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📜</div>
            <h3 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              Select a Project
            </h3>
            <p style={{ color: '#666666', fontSize: '14px' }}>
              Choose a project above to view its generation history
            </p>
          </div>
        )}

        {selectedProject && !loading && history && history.lyrics.length === 0 && history.music.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: '#141414',
            borderRadius: '16px',
            border: '1px dashed #2A2A2A',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <h3 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              No History Yet
            </h3>
            <p style={{ color: '#666666', fontSize: '14px' }}>
              Generate lyrics and music to start building your history
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

interface LyricsTimelineProps {
  lyrics: LyricsGeneration[];
  compareMode: boolean;
  selectedVersions: string[];
  onSelect: (id: string) => void;
  onReplay: (id: string) => void;
  formatDate: (date: string) => string;
}

function LyricsTimeline({ lyrics, compareMode, selectedVersions, onSelect, onReplay, formatDate }: LyricsTimelineProps) {
  if (lyrics.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#666666' }}>
        No lyrics versions yet
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {compareMode && (
        <div style={{
          backgroundColor: '#1E1E1E',
          border: '1px solid #E63946',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '8px',
        }}>
          <p style={{ color: '#FFFFFF', fontSize: '13px' }}>
            Click two versions to compare them side-by-side
          </p>
        </div>
      )}

      {lyrics.map((lyric, index) => {
        const isSelected = selectedVersions.includes(lyric.id);
        const isFirst = index === 0;

        return (
          <div
            key={lyric.id}
            onClick={() => compareMode && onSelect(lyric.id)}
            style={{
              backgroundColor: isSelected ? '#1E1E1E' : '#141414',
              border: `1px solid ${isSelected ? '#E63946' : '#2A2A2A'}`,
              borderRadius: '12px',
              padding: '20px 24px',
              cursor: compareMode ? 'pointer' : 'default',
              transition: 'all 150ms ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                {/* Version indicator */}
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: isFirst ? '#E63946' : '#2A2A2A',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 700 }}>v{lyric.version}</span>
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 600, margin: 0 }}>
                      {lyric.title || `Lyrics v${lyric.version}`}
                    </h3>
                    {isFirst && (
                      <span style={{
                        backgroundColor: '#E63946',
                        color: '#FFFFFF',
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}>
                        CURRENT
                      </span>
                    )}
                    {lyric.style_preset && (
                      <span style={{
                        backgroundColor: '#2A2A2A',
                        color: '#A0A0A0',
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}>
                        {lyric.style_preset}
                      </span>
                    )}
                  </div>

                  {/* Content preview */}
                  <p style={{
                    color: '#A0A0A0',
                    fontSize: '13px',
                    lineHeight: 1.5,
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {lyric.content}
                  </p>

                  <p style={{ color: '#666666', fontSize: '11px', marginTop: '8px', fontFamily: 'JetBrains Mono, monospace' }}>
                    {formatDate(lyric.created_at)}
                  </p>
                </div>
              </div>

              {/* Actions */}
              {!compareMode && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => onReplay(lyric.id)}
                    style={{
                      backgroundColor: '#2A2A2A',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                    onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#3A3A3A'; }}
                    onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A2A2A'; }}
                  >
                    🔄 Replay
                  </button>
                </div>
              )}

              {/* Selection indicator */}
              {compareMode && isSelected && (
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: '#E63946',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 700 }}>
                    {selectedVersions.indexOf(lyric.id) + 1}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface MusicTimelineProps {
  music: MusicGeneration[];
  compareMode: boolean;
  selectedVersions: string[];
  onSelect: (id: string) => void;
  onReplay: (id: string) => void;
  formatDate: (date: string) => string;
  formatDuration: (seconds?: number) => string;
}

function MusicTimeline({ music, compareMode, selectedVersions, onSelect, onReplay, formatDate, formatDuration }: MusicTimelineProps) {
  if (music.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#666666' }}>
        No music versions yet
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {compareMode && (
        <div style={{
          backgroundColor: '#1E1E1E',
          border: '1px solid #E63946',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '8px',
        }}>
          <p style={{ color: '#FFFFFF', fontSize: '13px' }}>
            Click two versions to compare them side-by-side
          </p>
        </div>
      )}

      {music.map((track, index) => {
        const isSelected = selectedVersions.includes(track.id);
        const isFirst = index === 0;

        return (
          <div
            key={track.id}
            onClick={() => compareMode && onSelect(track.id)}
            style={{
              backgroundColor: isSelected ? '#1E1E1E' : '#141414',
              border: `1px solid ${isSelected ? '#E63946' : '#2A2A2A'}`,
              borderRadius: '12px',
              padding: '20px 24px',
              cursor: compareMode ? 'pointer' : 'default',
              transition: 'all 150ms ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                {/* Version indicator */}
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: isFirst ? '#E63946' : '#2A2A2A',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 700 }}>v{track.version}</span>
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 600, margin: 0 }}>
                      {track.title || `Music v${track.version}`}
                    </h3>
                    {isFirst && (
                      <span style={{
                        backgroundColor: '#E63946',
                        color: '#FFFFFF',
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}>
                        CURRENT
                      </span>
                    )}
                    <span style={{
                      backgroundColor: '#2A2A2A',
                      color: '#A0A0A0',
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}>
                      {track.model}
                    </span>
                  </div>

                  {/* Track metadata */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                    {track.duration_seconds && (
                      <span style={{ color: '#A0A0A0', fontSize: '13px' }}>
                        ⏱ {formatDuration(track.duration_seconds)}
                      </span>
                    )}
                    {track.bitrate && (
                      <span style={{ color: '#FFB800', fontSize: '13px', fontWeight: 500 }}>
                        {Math.round(track.bitrate / 1000)} kbps
                      </span>
                    )}
                    {track.processed_file_path && (
                      <span style={{ color: '#00D26A', fontSize: '13px' }}>
                        ✓ 320kbps MP3
                      </span>
                    )}
                  </div>

                  <p style={{ color: '#666666', fontSize: '11px', marginTop: '8px', fontFamily: 'JetBrains Mono, monospace' }}>
                    {formatDate(track.created_at)}
                  </p>
                </div>
              </div>

              {/* Actions */}
              {!compareMode && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => onReplay(track.id)}
                    style={{
                      backgroundColor: '#2A2A2A',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                    onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#3A3A3A'; }}
                    onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2A2A2A'; }}
                  >
                    🔄 Replay
                  </button>
                </div>
              )}

              {/* Selection indicator */}
              {compareMode && isSelected && (
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: '#E63946',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 700 }}>
                    {selectedVersions.indexOf(track.id) + 1}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface CompareViewProps {
  compareResult: CompareResult;
  lyricsData: LyricsGeneration[];
  musicData: MusicGeneration[];
  onBack: () => void;
  onReplay: (id: string) => void;
}

function CompareView({ compareResult, lyricsData, musicData, onBack, onReplay }: CompareViewProps) {
  const { v1, v2 } = compareResult.versions;
  const contentType = compareResult.type;

  let content1: string = '';
  let content2: string = '';
  let audioUrl1: string = '';
  let audioUrl2: string = '';
  let track1: MusicGeneration | undefined;
  let track2: MusicGeneration | undefined;

  if (contentType === 'lyrics') {
    const lyric1 = lyricsData.find(l => l.id === v1.id);
    const lyric2 = lyricsData.find(l => l.id === v2.id);
    content1 = lyric1?.content || '';
    content2 = lyric2?.content || '';
  } else if (contentType === 'music') {
    track1 = musicData.find(m => m.id === v1.id);
    track2 = musicData.find(m => m.id === v2.id);
    audioUrl1 = track1 ? `/api/music/${track1.id}/file` : '';
    audioUrl2 = track2 ? `/api/music/${track2.id}/file` : '';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: 600, margin: 0 }}>
            Version Comparison
          </h2>
          <span style={{
            backgroundColor: '#2A2A2A',
            color: '#A0A0A0',
            fontSize: '12px',
            padding: '4px 12px',
            borderRadius: '6px',
          }}>
            v{v1.version} vs v{v2.version}
          </span>
        </div>
        <button
          onClick={onBack}
          style={{
            backgroundColor: '#2A2A2A',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
      </div>

      {/* Differences summary */}
      <div style={{
        backgroundColor: '#141414',
        border: '1px solid #2A2A2A',
        borderRadius: '8px',
        padding: '16px',
      }}>
        <h3 style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
          Changes Detected
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {Object.entries(compareResult.differences).map(([key, changed]) => (
            <span
              key={key}
              style={{
                backgroundColor: changed ? 'rgba(230, 57, 70, 0.2)' : 'rgba(0, 210, 106, 0.2)',
                color: changed ? '#E63946' : '#00D26A',
fontSize: '12px',
                padding: '4px 10px',
                borderRadius: '4px',
                fontWeight: 500,
              }}
            >
              {key}: {changed ? 'CHANGED' : 'SAME'}
            </span>
          ))}
        </div>
      </div>

      {/* Side-by-side content */}
      {contentType === 'lyrics' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Version 1 */}
          <div style={{ backgroundColor: '#141414', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 600, margin: 0 }}>
                Version {v1.version}
              </h3>
              <button
                onClick={() => onReplay(v1.id)}
                style={{
                  backgroundColor: '#2A2A2A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                🔄 Replay
              </button>
            </div>
            <pre style={{
              color: '#A0A0A0',
              fontSize: '13px',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              fontFamily: 'DM Sans, sans-serif',
              margin: 0,
              maxHeight: '400px',
              overflow: 'auto',
            }}>
              {content1}
            </pre>
          </div>

          {/* Version 2 */}
          <div style={{ backgroundColor: '#141414', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 600, margin: 0 }}>
                Version {v2.version}
              </h3>
              <button
                onClick={() => onReplay(v2.id)}
                style={{
                  backgroundColor: '#2A2A2A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                🔄 Replay
              </button>
            </div>
            <pre style={{
              color: '#A0A0A0',
              fontSize: '13px',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              fontFamily: 'DM Sans, sans-serif',
              margin: 0,
              maxHeight: '400px',
              overflow: 'auto',
            }}>
              {content2}
            </pre>
          </div>
        </div>
      ) : contentType === 'music' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Version 1 */}
          <div style={{ backgroundColor: '#141414', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 600, margin: 0 }}>
                Version {v1.version}
              </h3>
              <button
                onClick={() => onReplay(v1.id)}
                style={{
                  backgroundColor: '#2A2A2A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                🔄 Replay
              </button>
            </div>
            {audioUrl1 && (
              <SpotifyWaveformPlayer
                musicId={v1.id}
                version={v1.version}
                durationMs={(track1?.duration_seconds ?? 30) * 1000}
                audioUrl={audioUrl1}
              />
            )}
          </div>

          {/* Version 2 */}
          <div style={{ backgroundColor: '#141414', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 600, margin: 0 }}>
                Version {v2.version}
              </h3>
              <button
                onClick={() => onReplay(v2.id)}
                style={{
                  backgroundColor: '#2A2A2A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                🔄 Replay
              </button>
            </div>
            {audioUrl2 && (
              <SpotifyWaveformPlayer
                musicId={v2.id}
                version={v2.version}
                durationMs={(track2?.duration_seconds ?? 30) * 1000}
                audioUrl={audioUrl2}
              />
            )}
          </div>
        </div>
      ) : null}

      {/* Text diff if available */}
      {compareResult.contentDiff && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ backgroundColor: '#141414', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '16px' }}>
            <h4 style={{ color: '#00D26A', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
              Added Lines ({compareResult.contentDiff.added.length})
            </h4>
            <div style={{ maxHeight: '200px', overflow: 'auto' }}>
              {compareResult.contentDiff.added.length > 0 ? (
                compareResult.contentDiff.added.map((line, i) => (
                  <div key={i} style={{ color: '#00D26A', fontSize: '12px', padding: '4px 0', borderBottom: '1px solid #1E1E1E' }}>
                    + {line}
                  </div>
                ))
              ) : (
                <p style={{ color: '#666666', fontSize: '12px' }}>No new lines</p>
              )}
            </div>
          </div>

          <div style={{ backgroundColor: '#141414', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '16px' }}>
            <h4 style={{ color: '#E63946', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
              Removed Lines ({compareResult.contentDiff.removed.length})
            </h4>
            <div style={{ maxHeight: '200px', overflow: 'auto' }}>
              {compareResult.contentDiff.removed.length > 0 ? (
                compareResult.contentDiff.removed.map((line, i) => (
                  <div key={i} style={{ color: '#E63946', fontSize: '12px', padding: '4px 0', borderBottom: '1px solid #1E1E1E' }}>
                    - {line}
                  </div>
                ))
              ) : (
                <p style={{ color: '#666666', fontSize: '12px' }}>No removed lines</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ReplayPanelProps {
  replayData: ReplayData;
  onClose: () => void;
  projectId: string;
}

function ReplayPanel({ replayData, onClose, projectId }: ReplayPanelProps) {
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const endpoint = replayData.type === 'lyrics'
        ? '/api/lyrics/generate'
        : replayData.type === 'music'
        ? '/api/music/generate'
        : null;

      if (!endpoint) {
        alert('Unknown generation type');
        return;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          ...replayData.regenerationParams,
        }),
      });

      if (!response.ok) {
        throw new Error('Generation failed');
      }

      alert(`New ${replayData.type} generation started as v${replayData.nextVersion}`);
      onClose();
    } catch (err) {
      console.error('Regeneration failed:', err);
      alert('Failed to start regeneration');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div style={{
      backgroundColor: '#141414',
      border: '1px solid #E63946',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '24px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h3 style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
            🔄 Replay Version {replayData.generation.version}
          </h3>
          <p style={{ color: '#A0A0A0', fontSize: '13px' }}>
            Regenerate with the same settings. This will create version {replayData.nextVersion}.
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            backgroundColor: 'transparent',
            color: '#666666',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Settings that will be used */}
      <div style={{
        backgroundColor: '#0A0A0A',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '20px',
      }}>
        <h4 style={{ color: '#A0A0A0', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
          Settings to Replay
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {Object.entries(replayData.regenerationParams).map(([key, value]) => (
            <div key={key} style={{
              backgroundColor: '#1E1E1E',
              borderRadius: '6px',
              padding: '6px 12px',
            }}>
              <span style={{ color: '#666666', fontSize: '11px' }}>{key}:</span>
              <span style={{ color: '#FFFFFF', fontSize: '12px', marginLeft: '6px' }}>
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{
            backgroundColor: '#2A2A2A',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 20px',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          style={{
            backgroundColor: regenerating ? '#666666' : '#E63946',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: regenerating ? 'not-allowed' : 'pointer',
          }}
        >
          {regenerating ? 'Starting...' : `Generate v${replayData.nextVersion}`}
        </button>
      </div>
    </div>
  );
}