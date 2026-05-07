'use client';

import { useState, useCallback } from 'react';
import TimelineView from './TimelineView';
import GridView from './GridView';

interface Track {
  id: string;
  sourceFilePath: string;
  trimStart: number;
  trimEnd: number;
  speed: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  durationSeconds?: number;
}

interface MedleyEditorProps {
  projectId: string;
  medleyId?: string;
  initialTracks?: Track[];
  onSave?: (tracks: Track[]) => void;
}

type ViewMode = 'timeline' | 'grid';

export default function MedleyEditor({
  projectId,
  medleyId,
  initialTracks = [],
  onSave,
}: MedleyEditorProps) {
  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(
    initialTracks.length > 0 ? initialTracks[0].id : null
  );
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [isExporting, setIsExporting] = useState(false);

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId) || null;

  const handleSelectTrack = useCallback((trackId: string) => {
    setSelectedTrackId(trackId);
  }, []);

  const handleReorderTracks = useCallback((fromIndex: number, toIndex: number) => {
    setTracks((prev) => {
      const newTracks = [...prev];
      const [removed] = newTracks.splice(fromIndex, 1);
      newTracks.splice(toIndex, 0, removed);
      return newTracks;
    });
  }, []);

  const handleUpdateTrack = useCallback((trackId: string, updates: Partial<Track>) => {
    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId ? { ...track, ...updates } : track
      )
    );
  }, []);

  const handleAddTrack = useCallback(async (audioUrl: string) => {
    try {
      // Fetch audio to get duration
      const audio = new Audio(audioUrl);
      await new Promise<void>((resolve, reject) => {
        audio.addEventListener('loadedmetadata', () => resolve());
        audio.addEventListener('error', () => reject(new Error('Failed to load audio')));
      });

      const newTrack: Track = {
        id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sourceFilePath: audioUrl,
        trimStart: 0,
        trimEnd: audio.duration,
        speed: 1.0,
        volume: 1.0,
        fadeIn: 0,
        fadeOut: 0,
        durationSeconds: audio.duration,
      };

      setTracks((prev) => [...prev, newTrack]);
      setSelectedTrackId(newTrack.id);
    } catch (error) {
      console.error('Failed to add track:', error);
    }
  }, []);

  const handleRemoveTrack = useCallback((trackId: string) => {
    setTracks((prev) => {
      const newTracks = prev.filter((t) => t.id !== trackId);
      if (selectedTrackId === trackId && newTracks.length > 0) {
        setSelectedTrackId(newTracks[0].id);
      } else if (newTracks.length === 0) {
        setSelectedTrackId(null);
      }
      return newTracks;
    });
  }, [selectedTrackId]);

  const handleExport = useCallback(async () => {
    if (tracks.length === 0) {
      alert('No tracks to export');
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetch(`/api/medley${medleyId ? `/${medleyId}` : ''}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          tracks: tracks.map((t) => ({
            sourceFilePath: t.sourceFilePath,
            trimStart: t.trimStart,
            trimEnd: t.trimEnd,
            speed: t.speed,
            volume: t.volume,
            fadeIn: t.fadeIn,
            fadeOut: t.fadeOut,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const result = await response.json();
      alert(`Medley exported successfully! Duration: ${Math.floor(result.duration / 60)}:${(result.duration % 60).toFixed(0).padStart(2, '0')}`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [tracks, projectId, medleyId]);

  const handleClearAll = useCallback(() => {
    if (confirm('Are you sure you want to remove all tracks?')) {
      setTracks([]);
      setSelectedTrackId(null);
    }
  }, []);

  // Calculate total duration
  const totalDuration = tracks.reduce((sum, track) => {
    const effectiveDuration = track.durationSeconds
      ? (track.trimEnd - track.trimStart) / track.speed
      : 0;
    return sum + effectiveDuration;
  }, 0);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h2 style={styles.title}>Medley Editor</h2>
          <span style={styles.trackCount}>
            {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
          </span>
          <span style={styles.totalDuration}>
            Total: {Math.floor(totalDuration / 60)}:{(totalDuration % 60).toFixed(0).padStart(2, '0')}
          </span>
        </div>

        <div style={styles.headerRight}>
          {/* View toggle */}
          <div style={styles.viewToggle}>
            <button
              onClick={() => setViewMode('timeline')}
              style={{
                ...styles.toggleButton,
                ...(viewMode === 'timeline' ? styles.toggleButtonActive : {}),
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              Timeline
            </button>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                ...styles.toggleButton,
                ...(viewMode === 'grid' ? styles.toggleButtonActive : {}),
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
              Grid
            </button>
          </div>

          {/* Add track button */}
          <label style={styles.addButton}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Track
            <input
              type="file"
              accept="audio/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const url = URL.createObjectURL(file);
                  handleAddTrack(url);
                }
              }}
            />
          </label>
        </div>
      </div>

      {/* Main content */}
      <div style={styles.content}>
        {/* Track list */}
        <div style={styles.trackListSection}>
          {viewMode === 'timeline' ? (
            <TimelineView
              tracks={tracks}
              selectedTrackId={selectedTrackId}
              onSelectTrack={handleSelectTrack}
              onReorderTracks={handleReorderTracks}
              onUpdateTrack={handleUpdateTrack}
            />
          ) : (
            <GridView
              tracks={tracks}
              selectedTrackId={selectedTrackId}
              onSelectTrack={handleSelectTrack}
              onReorderTracks={handleReorderTracks}
              onUpdateTrack={handleUpdateTrack}
            />
          )}
        </div>

        {/* Selected track editor */}
        {selectedTrack && (
          <div style={styles.editorPanel}>
            <TrackEditorPanel
              track={selectedTrack}
              onUpdate={(updates) => handleUpdateTrack(selectedTrack.id, updates)}
              onRemove={() => handleRemoveTrack(selectedTrack.id)}
            />
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div style={styles.footer}>
        <button onClick={handleClearAll} style={styles.clearButton} disabled={tracks.length === 0}>
          Clear All
        </button>
        <button
          onClick={onSave ? () => onSave(tracks) : undefined}
          style={styles.saveButton}
          disabled={tracks.length === 0}
        >
          Save Medley
        </button>
        <button
          onClick={handleExport}
          style={styles.exportButton}
          disabled={tracks.length === 0 || isExporting}
        >
          {isExporting ? (
            <>
              <span style={styles.spinner} />
              Exporting...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export Medley
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Track Editor Panel component
interface TrackEditorPanelProps {
  track: Track;
  onUpdate: (updates: Partial<Track>) => void;
  onRemove: () => void;
}

function TrackEditorPanel({ track, onUpdate, onRemove }: TrackEditorPanelProps) {
  return (
    <div style={panelStyles.container}>
      <div style={panelStyles.header}>
        <h3 style={panelStyles.title}>Edit Track</h3>
        <button onClick={onRemove} style={panelStyles.removeButton}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>

      <div style={panelStyles.form}>
        {/* Speed */}
        <div style={panelStyles.field}>
          <label style={panelStyles.label}>Speed</label>
          <div style={panelStyles.inputGroup}>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={track.speed}
              onChange={(e) => onUpdate({ speed: parseFloat(e.target.value) })}
              style={panelStyles.slider}
            />
            <span style={panelStyles.value}>{track.speed.toFixed(1)}x</span>
          </div>
        </div>

        {/* Volume */}
        <div style={panelStyles.field}>
          <label style={panelStyles.label}>Volume</label>
          <div style={panelStyles.inputGroup}>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={track.volume}
              onChange={(e) => onUpdate({ volume: parseFloat(e.target.value) })}
              style={panelStyles.slider}
            />
            <span style={panelStyles.value}>{Math.round(track.volume * 100)}%</span>
          </div>
        </div>

        {/* Trim Start */}
        <div style={panelStyles.field}>
          <label style={panelStyles.label}>Trim Start</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={track.trimStart}
            onChange={(e) => onUpdate({ trimStart: parseFloat(e.target.value) })}
            style={panelStyles.numberInput}
          />
        </div>

        {/* Trim End */}
        <div style={panelStyles.field}>
          <label style={panelStyles.label}>Trim End</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={track.trimEnd ?? ''}
            placeholder="End"
            onChange={(e) => onUpdate({ trimEnd: e.target.value ? parseFloat(e.target.value) : undefined })}
            style={panelStyles.numberInput}
          />
        </div>

        {/* Fade In */}
        <div style={panelStyles.field}>
          <label style={panelStyles.label}>Fade In (s)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={track.fadeIn}
            onChange={(e) => onUpdate({ fadeIn: parseFloat(e.target.value) })}
            style={panelStyles.numberInput}
          />
        </div>

        {/* Fade Out */}
        <div style={panelStyles.field}>
          <label style={panelStyles.label}>Fade Out (s)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={track.fadeOut}
            onChange={(e) => onUpdate({ fadeOut: parseFloat(e.target.value) })}
            style={panelStyles.numberInput}
          />
        </div>
      </div>
    </div>
  );
}

const panelStyles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: '12px',
    border: '1px solid #2A2A2A',
    padding: '16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  title: {
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 600,
    margin: 0,
  },
  removeButton: {
    background: 'transparent',
    border: 'none',
    color: '#6B6B6B',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    color: '#6B6B6B',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  inputGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  slider: {
    flex: 1,
    accentColor: '#E63946',
  },
  value: {
    color: '#A0A0A0',
    fontSize: '12px',
    fontFamily: 'JetBrains Mono, monospace',
    minWidth: '50px',
    textAlign: 'right',
  },
  numberInput: {
    backgroundColor: '#141414',
    border: '1px solid #2A2A2A',
    borderRadius: '6px',
    padding: '8px 12px',
    color: '#FFFFFF',
    fontSize: '13px',
    fontFamily: 'JetBrains Mono, monospace',
    width: '100%',
  },
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#141414',
    borderRadius: '12px',
    border: '1px solid #2A2A2A',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    backgroundColor: '#1A1A1A',
    borderBottom: '1px solid #2A2A2A',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    color: '#FFFFFF',
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'Outfit, sans-serif',
    margin: 0,
  },
  trackCount: {
    color: '#6B6B6B',
    fontSize: '12px',
  },
  totalDuration: {
    color: '#A0A0A0',
    fontSize: '12px',
    fontFamily: 'JetBrains Mono, monospace',
    backgroundColor: '#2A2A2A',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  viewToggle: {
    display: 'flex',
    backgroundColor: '#0A0A0A',
    borderRadius: '8px',
    padding: '4px',
  },
  toggleButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'transparent',
    border: 'none',
    color: '#6B6B6B',
    fontSize: '12px',
    fontWeight: 500,
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 150ms',
  },
  toggleButtonActive: {
    backgroundColor: '#2A2A2A',
    color: '#FFFFFF',
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#E63946',
    color: '#FFFFFF',
    fontSize: '12px',
    fontWeight: 600,
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 150ms',
    border: 'none',
  },
  content: {
    display: 'flex',
    minHeight: '300px',
  },
  trackListSection: {
    flex: 1,
    minWidth: 0,
  },
  editorPanel: {
    width: '280px',
    borderLeft: '1px solid #2A2A2A',
    padding: '16px',
    backgroundColor: '#1A1A1A',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '16px 20px',
    backgroundColor: '#1A1A1A',
    borderTop: '1px solid #2A2A2A',
  },
  clearButton: {
    backgroundColor: 'transparent',
    border: '1px solid #2A2A2A',
    color: '#A0A0A0',
    fontSize: '13px',
    fontWeight: 500,
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 150ms',
  },
  saveButton: {
    backgroundColor: '#2A2A2A',
    border: 'none',
    color: '#FFFFFF',
    fontSize: '13px',
    fontWeight: 500,
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 150ms',
  },
  exportButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#E63946',
    border: 'none',
    color: '#FFFFFF',
    fontSize: '13px',
    fontWeight: 600,
    padding: '10px 24px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 150ms',
  },
  spinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#FFFFFF',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};