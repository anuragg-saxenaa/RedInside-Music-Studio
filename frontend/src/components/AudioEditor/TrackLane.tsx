import { useState, useRef, useEffect, useCallback } from 'react';

export interface TrackLaneProps {
  audioUrl: string
  trackId: string
  trimStart: number
  trimEnd: number
  duration: number
  isSelected?: boolean
  onSeek?: (time: number) => void
  onTrimChange?: (start: number, end: number) => void
}

const formatTimeMs = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
};

export default function TrackLane({
  audioUrl,
  trackId,
  trimStart,
  trimEnd,
  duration,
  isSelected = false,
  onSeek,
  onTrimChange,
}: TrackLaneProps) {
  const [peaks, setPeaks] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
  const [localTrimStart, setLocalTrimStart] = useState(trimStart);
  const [localTrimEnd, setLocalTrimEnd] = useState(trimEnd);
  const [playheadPosition, setPlayheadPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number>();

  // Sync with prop changes
  useEffect(() => {
    setLocalTrimStart(trimStart);
  }, [trimStart]);

  useEffect(() => {
    setLocalTrimEnd(trimEnd);
  }, [trimEnd]);

  // Fetch and decode audio
  useEffect(() => {
    let cancelled = false;

    const fetchAudio = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(audioUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch audio: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        if (cancelled) return;

        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        if (cancelled) return;

        // Downsample to peaks
        const channelData = audioBuffer.getChannelData(0);
        const samplesPerPeak = Math.max(1, Math.floor(channelData.length / 150));
        const peakCount = Math.floor(channelData.length / samplesPerPeak);
        const peakData: number[] = [];

        for (let i = 0; i < peakCount; i++) {
          const start = i * samplesPerPeak;
          const end = Math.min(start + samplesPerPeak, channelData.length);
          let max = 0;
          for (let j = start; j < end; j++) {
            const abs = Math.abs(channelData[j]);
            if (abs > max) max = abs;
          }
          peakData.push(max);
        }

        // Normalize peaks
        const maxPeak = Math.max(...peakData, 0.01);
        const normalizedPeaks = peakData.map(p => p / maxPeak);

        setPeaks(normalizedPeaks);
        setLoading(false);
        audioContext.close();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to decode audio');
          setLoading(false);
        }
      }
    };

    fetchAudio();

    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  // Playback time update loop
  const updatePlayhead = useCallback(() => {
    if (audioRef.current && isPlaying) {
      setPlayheadPosition(audioRef.current.currentTime);
      animationRef.current = requestAnimationFrame(updatePlayhead);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(updatePlayhead);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, updatePlayhead]);

  // Handle click-to-seek
  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) return;
    if (!containerRef.current || peaks.length === 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = clickX / rect.width;
    const seekTime = percent * duration;

    onSeek?.(seekTime);
    setPlayheadPosition(seekTime);
  };

  // Handle marker drag
  const handleMarkerDragStart = (
    e: React.MouseEvent,
    marker: 'start' | 'end'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(marker);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percent = x / rect.width;
      const time = percent * duration;

      if (isDragging === 'start') {
        const newStart = Math.max(0, Math.min(time, localTrimEnd - 0.1));
        setLocalTrimStart(newStart);
      } else if (isDragging === 'end') {
        const newEnd = Math.max(localTrimStart + 0.1, Math.min(time, duration));
        setLocalTrimEnd(newEnd);
      }
    };

    const handleMouseUp = () => {
      if (isDragging === 'start' || isDragging === 'end') {
        onTrimChange?.(localTrimStart, localTrimEnd);
      }
      setIsDragging(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, duration, localTrimStart, localTrimEnd, onTrimChange]);

  const startPercent = duration > 0 ? (localTrimStart / duration) * 100 : 0;
  const endPercent = duration > 0 ? (localTrimEnd / duration) * 100 : 100;
  const playheadPercent = duration > 0 ? (playheadPosition / duration) * 100 : 0;

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingState}>
          <div style={styles.spinner} />
          <span>Loading waveform...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorState}>
          <span>Failed to load audio: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.container, borderColor: isSelected ? '#E63946' : '#2A2A2A' }}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Track header */}
      <div style={styles.trackHeader}>
        <span style={styles.trackId}>Track {trackId}</span>
        <span style={styles.timeRange}>
          {formatTimeMs(localTrimStart * 1000)} - {formatTimeMs(localTrimEnd * 1000)}
        </span>
        <button
          onClick={handlePlayPause}
          style={styles.playButton}
        >
          {isPlaying ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>
      </div>

      {/* Waveform SVG */}
      <div
        ref={containerRef}
        style={styles.waveformContainer}
        onClick={handleWaveformClick}
      >
        <svg width="100%" height="60" style={styles.waveformSvg}>
          {/* Background dim for trimmed regions */}
          <rect x="0%" y="0" width={`${startPercent}%`} height="60" fill="rgba(0,0,0,0.5)" />
          <rect x={`${endPercent}%`} y="0" width={`${100 - endPercent}%`} height="60" fill="rgba(0,0,0,0.5)" />

          {/* Waveform bars */}
          {peaks.map((peak, index) => {
            const barPercent = (index / peaks.length) * 100;
            const isInTrimRegion = barPercent >= startPercent && barPercent <= endPercent;
            const barHeight = Math.max(4, peak * 50);

            return (
              <rect
                key={index}
                x={`${barPercent}%`}
                y={`${(60 - barHeight) / 2}px`}
                width={`${100 / peaks.length * 0.8}%`}
                height={`${barHeight}px`}
                fill={isInTrimRegion ? '#E63946' : '#3A3A3A'}
                rx="1"
              />
            );
          })}

          {/* Playhead */}
          <line
            x1={`${playheadPercent}%`}
            y1="0"
            x2={`${playheadPercent}%`}
            y2="60"
            stroke="#FFFFFF"
            strokeWidth="2"
            opacity={0.9}
          />

          {/* Start marker */}
          <g
            style={{ cursor: 'ew-resize' }}
            onMouseDown={(e) => handleMarkerDragStart(e, 'start')}
          >
            <rect
              x={`${startPercent}%`}
              y="0"
              width="10"
              height="60"
              fill="#E63946"
              opacity={isDragging === 'start' ? 0.8 : 0.6}
            />
            <polygon
              points={`${startPercent}%,60 ${startPercent + 1}%,55 ${startPercent}%,50`}
              fill="#E63946"
            />
          </g>

          {/* End marker */}
          <g
            style={{ cursor: 'ew-resize' }}
            onMouseDown={(e) => handleMarkerDragStart(e, 'end')}
          >
            <rect
              x={`${endPercent}%`}
              y="0"
              width="10"
              height="60"
              fill="#E63946"
              opacity={isDragging === 'end' ? 0.8 : 0.6}
            />
            <polygon
              points={`${endPercent}%,60 ${endPercent - 1}%,55 ${endPercent}%,50`}
              fill="#E63946"
            />
          </g>
        </svg>

        {/* Marker handles on top */}
        <div
          style={{
            position: 'absolute',
            left: `${startPercent}%`,
            top: 0,
            width: '2px',
            height: '100%',
            backgroundColor: '#FFFFFF',
            cursor: 'ew-resize',
            transform: 'translateX(-50%)',
            opacity: 0.8,
          }}
          onMouseDown={(e) => handleMarkerDragStart(e, 'start')}
        />
        <div
          style={{
            position: 'absolute',
            left: `${endPercent}%`,
            top: 0,
            width: '2px',
            height: '100%',
            backgroundColor: '#FFFFFF',
            cursor: 'ew-resize',
            transform: 'translateX(-50%)',
            opacity: 0.8,
          }}
          onMouseDown={(e) => handleMarkerDragStart(e, 'end')}
        />
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#1E1E1E',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid #2A2A2A',
    fontFamily: 'DM Sans, sans-serif',
  },
  trackHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  trackId: {
    color: '#FFFFFF',
    fontSize: '13px',
    fontWeight: 600,
  },
  timeRange: {
    color: '#A0A0A0',
    fontSize: '11px',
    fontFamily: 'JetBrains Mono, monospace',
  },
  playButton: {
    background: '#E63946',
    border: 'none',
    borderRadius: '50%',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#FFFFFF',
    flexShrink: 0,
    marginLeft: 'auto',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    color: '#A0A0A0',
    gap: '8px',
    fontSize: '12px',
  },
  errorState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    color: '#E63946',
    fontSize: '12px',
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '2px solid #2A2A2A',
    borderTopColor: '#E63946',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  waveformContainer: {
    position: 'relative',
    backgroundColor: '#2A2A2A',
    borderRadius: '6px',
    height: '60px',
    cursor: 'pointer',
    overflow: 'hidden',
  },
  waveformSvg: {
    display: 'block',
    width: '100%',
    height: '60px',
  },
};
