import { useState, useRef, useEffect, useCallback } from 'react';
import TrackLane from './TrackLane';
import ControlsSidebar, { AudioOperations } from './ControlsSidebar';

export interface AudioEditorPanelProps {
  projectId: string
  audioUrl: string
  trackId: string
  onExport?: (result: { filePath: string, duration: number }) => void
}

interface ProcessingResult {
  filePath: string
  duration: number
}

const defaultOperations: AudioOperations = {
  trimStart: 0,
  trimEnd: 0,
  speed: 1.0,
  volume: 1.0,
  fadeInEnabled: false,
  fadeInDuration: 1.0,
  fadeOutEnabled: false,
  fadeOutDuration: 1.0,
  reverse: false,
};

export default function AudioEditorPanel({
  projectId,
  audioUrl,
  trackId,
  onExport,
}: AudioEditorPanelProps) {
  const [duration, setDuration] = useState(0);
  const [operations, setOperations] = useState<AudioOperations>({
    ...defaultOperations,
    trimEnd: 0,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number>();
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Load audio duration
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      const dur = audio.duration;
      setDuration(dur);
      setOperations((prev) => ({ ...prev, trimEnd: dur }));
    };

    const handleError = () => {
      setError('Failed to load audio file');
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);
    audio.src = audioUrl;

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
    };
  }, [audioUrl]);

  // Update preview settings when operations change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = operations.speed;
      audioRef.current.volume = operations.volume;
    }
  }, [operations.speed, operations.volume]);

  // Playback loop
  const updatePlayhead = useCallback(() => {
    if (audioRef.current && isPlaying) {
      setCurrentTime(audioRef.current.currentTime);
      animationRef.current = requestAnimationFrame(updatePlayhead);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(updatePlayhead);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, updatePlayhead]);

  const handlePreview = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    // Set playback position to trim start
    audio.currentTime = operations.trimStart;
    audio.playbackRate = operations.speed;
    audio.volume = operations.volume;
    setIsPlaying(true);

    const updatePlayback = () => {
      if (!audioRef.current) return;

      // Stop at trim end
      if (audioRef.current.currentTime >= operations.trimEnd) {
        audioRef.current.pause();
        audioRef.current.currentTime = operations.trimStart;
        setIsPlaying(false);
        setCurrentTime(operations.trimStart);
        return;
      }

      setCurrentTime(audioRef.current.currentTime);
      animationRef.current = requestAnimationFrame(updatePlayback);
    };

    animationRef.current = requestAnimationFrame(updatePlayback);
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = operations.trimStart;
    }
    setIsPlaying(false);
    setCurrentTime(operations.trimStart);
  };

  const buildOperationsArray = (): Array<{
    op: string
    start?: number
    end?: number
    tempo?: number
    volume?: number
    fadeIn?: number
    fadeOut?: number
    reverse?: boolean
  }> => {
    const ops: Array<{
      op: string
      start?: number
      end?: number
      tempo?: number
      volume?: number
      fadeIn?: number
      fadeOut?: number
      reverse?: boolean
    }> = [];

    // Trim operation
    if (operations.trimStart > 0 || operations.trimEnd < duration) {
      ops.push({
        op: 'trim',
        start: operations.trimStart,
        end: operations.trimEnd,
      });
    }

    // Speed operation
    if (operations.speed !== 1.0) {
      ops.push({
        op: 'speed',
        tempo: operations.speed,
      });
    }

    // Volume operation
    if (operations.volume !== 1.0) {
      ops.push({
        op: 'volume',
        volume: operations.volume,
      });
    }

    // Fade in
    if (operations.fadeInEnabled && operations.fadeInDuration > 0) {
      ops.push({
        op: 'fadeIn',
        fadeIn: operations.fadeInDuration,
      });
    }

    // Fade out
    if (operations.fadeOutEnabled && operations.fadeOutDuration > 0) {
      ops.push({
        op: 'fadeOut',
        fadeOut: operations.fadeOutDuration,
      });
    }

    // Reverse
    if (operations.reverse) {
      ops.push({
        op: 'reverse',
      });
    }

    return ops;
  };

  const handleExport = async (format: 'mp3-320' | 'wav' | 'flac') => {
    setIsExporting(true);
    setError(null);

    try {
      const payload = {
        projectId,
        audioUrl,
        operations: buildOperationsArray(),
        outputFormat: format === 'mp3-320' ? 'mp3' : format,
        bitrate: format === 'mp3-320' ? '320k' : undefined,
      };

      const response = await fetch('/api/audio/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to process audio');
      }

      const result: ProcessingResult = await response.json();
      onExport?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleTrimChange = (start: number, end: number) => {
    setOperations((prev) => ({
      ...prev,
      trimStart: start,
      trimEnd: end,
    }));
  };

  const handleOperationsChange = (newOps: AudioOperations) => {
    setOperations(newOps);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>Audio Editor</h2>
        {duration > 0 && (
          <span style={styles.duration}>
            Total: {Math.floor(duration / 60)}:{(duration % 60).toFixed(2).padStart(5, '0')}
          </span>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div style={styles.errorBanner}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={styles.errorClose}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Main content */}
      <div style={styles.content}>
        {/* Track lane */}
        <div style={styles.waveformSection}>
          <TrackLane
            audioUrl={audioUrl}
            trackId={trackId}
            trimStart={operations.trimStart}
            trimEnd={operations.trimEnd}
            duration={duration}
            isSelected={true}
            onSeek={(time) => setCurrentTime(time)}
            onTrimChange={handleTrimChange}
          />
        </div>

        {/* Controls sidebar */}
        <ControlsSidebar
          duration={duration}
          operations={operations}
          onChange={handleOperationsChange}
          onPreview={handlePreview}
          onExport={handleExport}
          isExporting={isExporting}
        />
      </div>

      {/* Playback controls */}
      <div style={styles.playbackBar}>
        <button onClick={handleStop} style={styles.stopButton}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <rect x="4" y="4" width="16" height="16" />
          </svg>
        </button>

        <div style={styles.progressContainer}>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
              }}
            />
            <div
              style={{
                ...styles.trimRegion,
                left: `${duration > 0 ? (operations.trimStart / duration) * 100 : 0}%`,
                width: `${duration > 0 ? ((operations.trimEnd - operations.trimStart) / duration) * 100 : 100}%`,
              }}
            />
          </div>
          <div style={styles.timeDisplay}>
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div style={styles.playbackInfo}>
          <span style={styles.infoChip}>
            {operations.speed.toFixed(2)}x
          </span>
          <span style={styles.infoChip}>
            Vol: {Math.round(operations.volume * 100)}%
          </span>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#141414',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #2A2A2A',
    fontFamily: 'DM Sans, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    color: '#FFFFFF',
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'Outfit, sans-serif',
    margin: 0,
  },
  duration: {
    color: '#A0A0A0',
    fontSize: '12px',
    fontFamily: 'JetBrains Mono, monospace',
  },
  errorBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(230, 57, 70, 0.1)',
    border: '1px solid rgba(230, 57, 70, 0.3)',
    borderRadius: '8px',
    padding: '10px 14px',
    marginBottom: '16px',
    color: '#E63946',
    fontSize: '13px',
  },
  errorClose: {
    background: 'none',
    border: 'none',
    color: '#E63946',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  content: {
    display: 'flex',
    gap: '20px',
    marginBottom: '20px',
  },
  waveformSection: {
    flex: 1,
    minWidth: 0,
  },
  playbackBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 16px',
    backgroundColor: '#1E1E1E',
    borderRadius: '8px',
    border: '1px solid #2A2A2A',
  },
  stopButton: {
    background: '#2A2A2A',
    border: 'none',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#A0A0A0',
    flexShrink: 0,
    transition: 'all 150ms',
  },
  progressContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  progressBar: {
    position: 'relative',
    height: '6px',
    backgroundColor: '#2A2A2A',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: '#E63946',
    borderRadius: '3px',
    transition: 'width 100ms linear',
  },
  trimRegion: {
    position: 'absolute',
    top: 0,
    height: '100%',
    backgroundColor: 'rgba(230, 57, 70, 0.3)',
    borderRadius: '3px',
  },
  timeDisplay: {
    display: 'flex',
    gap: '6px',
    fontSize: '11px',
    fontFamily: 'JetBrains Mono, monospace',
    color: '#A0A0A0',
  },
  playbackInfo: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
  infoChip: {
    backgroundColor: '#2A2A2A',
    color: '#A0A0A0',
    fontSize: '10px',
    fontFamily: 'JetBrains Mono, monospace',
    padding: '4px 8px',
    borderRadius: '4px',
  },
};