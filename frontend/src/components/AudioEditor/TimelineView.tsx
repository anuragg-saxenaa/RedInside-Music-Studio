'use client';

import { useState, useRef, useEffect } from 'react';

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

interface TimelineViewProps {
  tracks: Track[];
  selectedTrackId: string | null;
  onSelectTrack: (trackId: string) => void;
  onReorderTracks: (fromIndex: number, toIndex: number) => void;
  onUpdateTrack: (trackId: string, updates: Partial<Track>) => void;
}

export default function TimelineView({
  tracks,
  selectedTrackId,
  onSelectTrack,
  onReorderTracks,
  onUpdateTrack,
}: TimelineViewProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [waveforms, setWaveforms] = useState<Record<string, number[]>>({});
  const [editingTrim, setEditingTrim] = useState<{ trackId: string; field: 'trimStart' | 'trimEnd' } | null>(null);
  const [trimInputValue, setTrimInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate waveform data for a track (simplified visualization)
  useEffect(() => {
    const generateWaveform = (trackId: string) => {
      const points = [];
      for (let i = 0; i < 100; i++) {
        // Simulate waveform with pseudo-random values based on track ID
        const seed = trackId.charCodeAt(0) + i;
        points.push(Math.abs(Math.sin(seed * 0.1) * Math.cos(seed * 0.05)));
      }
      return points;
    };

    const newWaveforms: Record<string, number[]> = {};
    tracks.forEach((track) => {
      if (!waveforms[track.id]) {
        newWaveforms[track.id] = generateWaveform(track.id);
      } else {
        newWaveforms[track.id] = waveforms[track.id];
      }
    });

    tracks.forEach((track) => {
      if (!newWaveforms[track.id]) {
        newWaveforms[track.id] = generateWaveform(track.id);
      }
    });

    if (Object.keys(newWaveforms).length > 0) {
      setWaveforms((prev) => ({ ...prev, ...newWaveforms }));
    }
  }, [tracks]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      onReorderTracks(draggedIndex, dragOverIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const parseTimeInput = (value: string): number => {
    const parts = value.split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10) || 0;
      const secs = parseFloat(parts[1]) || 0;
      return mins * 60 + secs;
    }
    return parseFloat(value) || 0;
  };

  const formatTimeInput = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${parseFloat(secs) < 10 ? '0' : ''}${secs}`;
  };

  const handleTrimEditStart = (trackId: string, field: 'trimStart' | 'trimEnd', currentValue: number) => {
    setEditingTrim({ trackId, field });
    setTrimInputValue(formatTimeInput(currentValue));
  };

  const handleTrimEditChange = (value: string) => {
    setTrimInputValue(value);
  };

  const handleTrimEditEnd = () => {
    if (editingTrim) {
      const newValue = parseTimeInput(trimInputValue);
      onUpdateTrack(editingTrim.trackId, { [editingTrim.field]: newValue });
      setEditingTrim(null);
      setTrimInputValue('');
    }
  };

  const handleWaveformClick = (e: React.MouseEvent, track: Track) => {
    if (!track.durationSeconds) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const clickTime = clickPosition * track.durationSeconds;

    if (e.altKey) {
      onUpdateTrack(track.id, { trimEnd: clickTime });
    } else {
      onUpdateTrack(track.id, { trimStart: clickTime });
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.dragHandleColumn}>
          <span style={styles.headerLabel}>#</span>
        </div>
        <div style={styles.trackInfoColumn}>
          <span style={styles.headerLabel}>Track</span>
        </div>
        <div style={styles.waveformColumn}>
          <span style={styles.headerLabel}>Waveform</span>
        </div>
        <div style={styles.timeColumn}>
          <span style={styles.headerLabel}>Duration</span>
        </div>
      </div>

      <div ref={containerRef} style={styles.trackList}>
        {tracks.map((track, index) => (
          <div
            key={track.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            onDragLeave={handleDragLeave}
            onClick={() => onSelectTrack(track.id)}
            style={{
              ...styles.trackRow,
              ...(selectedTrackId === track.id ? styles.selectedTrack : {}),
              ...(dragOverIndex === index ? styles.dragOverTrack : {}),
              ...(draggedIndex === index ? styles.draggingTrack : {}),
            }}
          >
            {/* Drag handle and index */}
            <div style={styles.dragHandleColumn}>
              <div style={styles.dragHandle}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="8" cy="6" r="2" />
                  <circle cx="16" cy="6" r="2" />
                  <circle cx="8" cy="12" r="2" />
                  <circle cx="16" cy="12" r="2" />
                  <circle cx="8" cy="18" r="2" />
                  <circle cx="16" cy="18" r="2" />
                </svg>
              </div>
              <span style={styles.trackIndex}>{index + 1}</span>
            </div>

            {/* Track info */}
            <div style={styles.trackInfoColumn}>
              <span style={styles.trackName}>
                {track.sourceFilePath.split('/').pop() || `Track ${index + 1}`}
              </span>
              <div style={styles.trackMeta}>
                {track.trimStart > 0 && (
                  <span style={styles.metaChip}>
                    Trim: {formatTime(track.trimStart)} - {track.trimEnd ? formatTime(track.trimEnd) : 'End'}
                  </span>
                )}
                {track.speed !== 1.0 && (
                  <span style={styles.metaChip}>{track.speed.toFixed(1)}x</span>
                )}
                {track.volume !== 1.0 && (
                  <span style={styles.metaChip}>Vol: {Math.round(track.volume * 100)}%</span>
                )}
              </div>
              {/* Inline trim controls when selected */}
              {selectedTrackId === track.id && (
                <div style={styles.inlineTrimControls} onClick={(e) => e.stopPropagation()}>
                  <div style={styles.trimInputGroup}>
                    <label style={styles.trimLabel}>Start</label>
                    {editingTrim?.trackId === track.id && editingTrim.field === 'trimStart' ? (
                      <input
                        style={styles.trimInput}
                        value={trimInputValue}
                        onChange={(e) => handleTrimEditChange(e.target.value)}
                        onBlur={handleTrimEditEnd}
                        onKeyDown={(e) => e.key === 'Enter' && handleTrimEditEnd()}
                        autoFocus
                      />
                    ) : (
                      <span
                        style={styles.trimValue}
                        onClick={() => handleTrimEditStart(track.id, 'trimStart', track.trimStart)}
                      >
                        {formatTimeInput(track.trimStart)}
                      </span>
                    )}
                  </div>
                  <div style={styles.trimInputGroup}>
                    <label style={styles.trimLabel}>End</label>
                    {editingTrim?.trackId === track.id && editingTrim.field === 'trimEnd' ? (
                      <input
                        style={styles.trimInput}
                        value={trimInputValue}
                        onChange={(e) => handleTrimEditChange(e.target.value)}
                        onBlur={handleTrimEditEnd}
                        onKeyDown={(e) => e.key === 'Enter' && handleTrimEditEnd()}
                        autoFocus
                      />
                    ) : (
                      <span
                        style={styles.trimValue}
                        onClick={() => handleTrimEditStart(track.id, 'trimEnd', track.trimEnd || track.durationSeconds || 0)}
                      >
                        {formatTimeInput(track.trimEnd || track.durationSeconds || 0)}
                      </span>
                    )}
                  </div>
                  <span style={styles.trimHint}>Click waveform: blue (Start) / Alt+click (End)</span>
                </div>
              )}
            </div>

            {/* Waveform visualization */}
            <div style={styles.waveformColumn}>
              <div
                style={styles.waveformContainer}
                onClick={(e) => handleWaveformClick(e, track)}
                title="Click to set trim start, Alt+Click to set trim end"
              >
                {/* Trim start marker */}
                {track.trimStart > 0 && (
                  <div
                    style={{
                      ...styles.trimMarker,
                      left: `${(track.trimStart / (track.durationSeconds || 60)) * 100}%`,
                    }}
                  />
                )}
                {/* Waveform bars */}
                <div style={styles.waveformBars}>
                  {(waveforms[track.id] || Array(100).fill(0)).map((height, i) => (
                    <div
                      key={i}
                      style={{
                        ...styles.waveformBar,
                        height: `${Math.max(10, height * 100)}%`,
                      }}
                    />
                  ))}
                </div>
                {/* Trim end marker */}
                {track.trimEnd && (
                  <div
                    style={{
                      ...styles.trimMarker,
                      ...styles.trimEndMarker,
                      left: `${(track.trimEnd / (track.durationSeconds || 60)) * 100}%`,
                    }}
                  />
                )}
              </div>
            </div>

            {/* Duration */}
            <div style={styles.timeColumn}>
              <span style={styles.durationText}>
                {track.durationSeconds ? formatTime(track.durationSeconds) : '--:--'}
              </span>
            </div>
          </div>
        ))}

        {tracks.length === 0 && (
          <div style={styles.emptyState}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <span>No tracks yet. Add tracks to start building your medley.</span>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: '12px',
    border: '1px solid #2A2A2A',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    padding: '12px 16px',
    backgroundColor: '#141414',
    borderBottom: '1px solid #2A2A2A',
    gap: '12px',
  },
  headerLabel: {
    color: '#6B6B6B',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  trackList: {
    maxHeight: '400px',
    overflowY: 'auto',
  },
  trackRow: {
    display: 'flex',
    padding: '16px',
    gap: '12px',
    borderBottom: '1px solid #2A2A2A',
    cursor: 'pointer',
    transition: 'background-color 150ms',
    alignItems: 'center',
  },
  selectedTrack: {
    backgroundColor: 'rgba(230, 57, 70, 0.1)',
    borderLeft: '3px solid #E63946',
  },
  dragOverTrack: {
    backgroundColor: 'rgba(230, 57, 70, 0.15)',
    borderTop: '2px solid #E63946',
  },
  draggingTrack: {
    opacity: 0.5,
  },
  dragHandleColumn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '60px',
  },
  dragHandle: {
    cursor: 'grab',
    color: '#4A4A4A',
    display: 'flex',
    alignItems: 'center',
  },
  trackIndex: {
    color: '#6B6B6B',
    fontSize: '12px',
    fontFamily: 'JetBrains Mono, monospace',
  },
  trackInfoColumn: {
    flex: 1,
    minWidth: 0,
  },
  trackName: {
    color: '#FFFFFF',
    fontSize: '13px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: '4px',
  },
  trackMeta: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  metaChip: {
    backgroundColor: '#2A2A2A',
    color: '#A0A0A0',
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '4px',
    fontFamily: 'JetBrains Mono, monospace',
  },
  waveformColumn: {
    width: '200px',
    flexShrink: 0,
  },
  waveformContainer: {
    position: 'relative',
    height: '40px',
    backgroundColor: '#0A0A0A',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  waveformBars: {
    display: 'flex',
    alignItems: 'center',
    height: '100%',
    gap: '1px',
    padding: '0 4px',
  },
  waveformBar: {
    width: '2px',
    backgroundColor: '#E63946',
    borderRadius: '1px',
    minHeight: '4px',
  },
  trimMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '2px',
    backgroundColor: '#FFE066',
  },
  trimEndMarker: {
    backgroundColor: '#FFE066',
  },
  timeColumn: {
    width: '60px',
    textAlign: 'right',
  },
  durationText: {
    color: '#A0A0A0',
    fontSize: '12px',
    fontFamily: 'JetBrains Mono, monospace',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    color: '#6B6B6B',
    gap: '12px',
    textAlign: 'center',
    fontSize: '13px',
  },
  inlineTrimControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginTop: '8px',
    padding: '8px 12px',
    backgroundColor: '#141414',
    borderRadius: '6px',
    border: '1px solid #2A2A2A',
  },
  trimInputGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  trimLabel: {
    color: '#6B6B6B',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  trimInput: {
    backgroundColor: '#0A0A0A',
    border: '1px solid #3A3A3A',
    borderRadius: '4px',
    color: '#FFFFFF',
    fontSize: '12px',
    fontFamily: 'JetBrains Mono, monospace',
    padding: '4px 8px',
    width: '70px',
    outline: 'none',
  },
  trimValue: {
    color: '#FFE066',
    fontSize: '12px',
    fontFamily: 'JetBrains Mono, monospace',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: 'rgba(255, 224, 102, 0.1)',
  },
  trimHint: {
    color: '#4A4A4A',
    fontSize: '10px',
    fontStyle: 'italic',
  },
};