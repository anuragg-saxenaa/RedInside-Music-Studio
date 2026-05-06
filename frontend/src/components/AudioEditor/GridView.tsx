'use client';

import { useState } from 'react';

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

interface GridViewProps {
  tracks: Track[];
  selectedTrackId: string | null;
  onSelectTrack: (trackId: string) => void;
  onReorderTracks: (fromIndex: number, toIndex: number) => void;
}

export default function GridView({
  tracks,
  selectedTrackId,
  onSelectTrack,
  onReorderTracks,
}: GridViewProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Generate a simple waveform thumbnail SVG
  const generateWaveformThumbnail = (trackId: string): string => {
    const bars = [];
    const seed = trackId.charCodeAt(0) || 1;
    for (let i = 0; i < 20; i++) {
      const height = Math.abs(Math.sin((seed + i) * 0.2) * 60 + 20);
      bars.push(`<rect x="${i * 5}" y="${(80 - height) / 2}" width="3" height="${height}" fill="#E63946" rx="1"/>`);
    }
    return `<svg width="100" height="80" xmlns="http://www.w3.org/2000/svg">${bars.join('')}</svg>`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.grid}>
        {tracks.map((track, index) => (
          <div
            key={track.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => onSelectTrack(track.id)}
            style={{
              ...styles.card,
              ...(selectedTrackId === track.id ? styles.selectedCard : {}),
              ...(dragOverIndex === index ? styles.dragOverCard : {}),
              ...(draggedIndex === index ? styles.draggingCard : {}),
            }}
          >
            {/* Card header with drag handle */}
            <div style={styles.cardHeader}>
              <div style={styles.dragHandle}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="8" cy="6" r="2" />
                  <circle cx="16" cy="6" r="2" />
                  <circle cx="8" cy="12" r="2" />
                  <circle cx="16" cy="12" r="2" />
                  <circle cx="8" cy="18" r="2" />
                  <circle cx="16" cy="18" r="2" />
                </svg>
              </div>
              <span style={styles.trackNumber}>#{index + 1}</span>
              {selectedTrackId === track.id && (
                <span style={styles.selectedBadge}>Selected</span>
              )}
            </div>

            {/* Waveform thumbnail */}
            <div
              style={styles.waveformThumbnail}
              dangerouslySetInnerHTML={{ __html: generateWaveformThumbnail(track.id) }}
            />

            {/* Track info */}
            <div style={styles.cardInfo}>
              <span style={styles.trackName}>
                {track.sourceFilePath.split('/').pop() || `Track ${index + 1}`}
              </span>

              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>Duration</span>
                  <span style={styles.infoValue}>
                    {track.durationSeconds ? formatTime(track.durationSeconds) : '--:--'}
                  </span>
                </div>

                {track.trimStart > 0 || track.trimEnd ? (
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>Trim</span>
                    <span style={styles.infoValue}>
                      {formatTime(track.trimStart)} - {track.trimEnd ? formatTime(track.trimEnd) : 'End'}
                    </span>
                  </div>
                ) : null}

                {track.speed !== 1.0 && (
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>Speed</span>
                    <span style={styles.infoValue}>{track.speed.toFixed(2)}x</span>
                  </div>
                )}

                {track.volume !== 1.0 && (
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>Volume</span>
                    <span style={styles.infoValue}>{Math.round(track.volume * 100)}%</span>
                  </div>
                )}
              </div>

              {/* Effect badges */}
              <div style={styles.effectBadges}>
                {track.fadeIn > 0 && (
                  <span style={styles.effectBadge}>Fade In</span>
                )}
                {track.fadeOut > 0 && (
                  <span style={styles.effectBadge}>Fade Out</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {tracks.length === 0 && (
        <div style={styles.emptyState}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span>No tracks yet</span>
          <span style={styles.emptySubtext}>Add audio tracks to build your medley</span>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: '12px',
    border: '1px solid #2A2A2A',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 150ms ease',
  },
  selectedCard: {
    borderColor: '#E63946',
    boxShadow: '0 0 0 1px #E63946, 0 4px 12px rgba(230, 57, 70, 0.2)',
  },
  dragOverCard: {
    borderColor: '#FFE066',
    transform: 'scale(1.02)',
  },
  draggingCard: {
    opacity: 0.5,
    transform: 'scale(0.98)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#141414',
    borderBottom: '1px solid #2A2A2A',
    gap: '8px',
  },
  dragHandle: {
    cursor: 'grab',
    color: '#4A4A4A',
    display: 'flex',
    alignItems: 'center',
  },
  trackNumber: {
    color: '#6B6B6B',
    fontSize: '12px',
    fontFamily: 'JetBrains Mono, monospace',
    flex: 1,
  },
  selectedBadge: {
    backgroundColor: '#E63946',
    color: '#FFFFFF',
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '4px',
    textTransform: 'uppercase',
  },
  waveformThumbnail: {
    padding: '16px',
    display: 'flex',
    justifyContent: 'center',
    backgroundColor: '#0A0A0A',
  },
  cardInfo: {
    padding: '16px',
  },
  trackName: {
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '12px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
    marginBottom: '12px',
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  infoLabel: {
    color: '#6B6B6B',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  infoValue: {
    color: '#A0A0A0',
    fontSize: '12px',
    fontFamily: 'JetBrains Mono, monospace',
  },
  effectBadges: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  effectBadge: {
    backgroundColor: '#2A2A2A',
    color: '#A0A0A0',
    fontSize: '10px',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    color: '#6B6B6B',
    gap: '12px',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: '13px',
    color: '#4A4A4A',
  },
};