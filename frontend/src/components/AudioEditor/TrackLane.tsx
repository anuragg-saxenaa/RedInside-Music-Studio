import { useState, useRef, useEffect } from 'react';

export interface TrackLaneProps {
  audioUrl: string
  trackId: string
  trimStart: number
  trimEnd: number
  duration: number
  isSelected?: boolean
  isPlaying?: boolean
  onSeek?: (time: number) => void
  onTrimChange?: (start: number, end: number) => void
  onPlayPause?: () => void
}

const formatTime = (s: number): string => {
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

export default function TrackLane({
  audioUrl,
  trackId,
  trimStart,
  trimEnd,
  duration,
  isSelected = false,
  isPlaying = false,
  onSeek,
  onTrimChange,
  onPlayPause,
}: TrackLaneProps) {
  const [peaks, setPeaks] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localTrimStart, setLocalTrimStart] = useState(trimStart);
  const [localTrimEnd, setLocalTrimEnd] = useState(trimEnd);
  const [playheadPosition, setPlayheadPosition] = useState(0);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Sync with prop changes
  useEffect(() => {
    setLocalTrimStart(trimStart);
  }, [trimStart]);

  useEffect(() => {
    setLocalTrimEnd(trimEnd);
  }, [trimEnd]);

  // Sync playhead with isPlaying
  useEffect(() => {
    if (!isPlaying) {
      setPlayheadPosition(localTrimStart);
    }
  }, [isPlaying, localTrimStart]);

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

  // Get time from mouse position
  const getTimeFromMouse = (clientX: number): number => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(x / rect.width, 1));
    return percent * duration;
  };

  // Marker drag handlers
  const handleMarkerMouseDown = (e: React.PointerEvent, marker: 'start' | 'end') => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(marker);

    const time = getTimeFromMouse(e.clientX);
    setDragOffset(marker === 'start' ? time - localTrimStart : time - localTrimEnd);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const time = getTimeFromMouse(e.clientX);

      if (isDragging === 'start') {
        const newStart = Math.max(0, Math.min(time - dragOffset, localTrimEnd - 0.5));
        setLocalTrimStart(newStart);
      } else if (isDragging === 'end') {
        const newEnd = Math.max(localTrimStart + 0.5, Math.min(time - dragOffset, duration));
        setLocalTrimEnd(newEnd);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (isDragging === 'start' || isDragging === 'end') {
        // Final update to parent
        const time = getTimeFromMouse(e.clientX);
        if (isDragging === 'start') {
          const finalStart = Math.max(0, Math.min(time - dragOffset, localTrimEnd - 0.5));
          onTrimChange?.(finalStart, localTrimEnd);
        } else {
          const finalEnd = Math.max(localTrimStart + 0.5, Math.min(time - dragOffset, duration));
          onTrimChange?.(localTrimStart, finalEnd);
        }
      }
      setIsDragging(null);
    };

    window.addEventListener('pointermove', handleMouseMove);
    window.addEventListener('pointerup', handleMouseUp);

    return () => {
      window.removeEventListener('pointermove', handleMouseMove);
      window.removeEventListener('pointerup', handleMouseUp);
    };
  }, [isDragging, dragOffset, duration, localTrimStart, localTrimEnd, onTrimChange]);

  const startPercent = duration > 0 ? (localTrimStart / duration) * 100 : 0;
  const endPercent = duration > 0 ? (localTrimEnd / duration) * 100 : 100;
  const playheadPercent = duration > 0 ? (playheadPosition / duration) * 100 : 0;

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
        <div style={styles.errorState}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.container, borderColor: isSelected ? '#E63946' : '#2A2A2A' }}>
      {/* Track header */}
      <div style={styles.trackHeader}>
        <span style={styles.trackId}>Track {trackId}</span>
        <span style={styles.timeRange}>
          {formatTime(localTrimStart)} - {formatTime(localTrimEnd)}
        </span>
        <button
          className="play-btn-fix"
          onClick={(e) => {
            e.stopPropagation();
            onPlayPause?.();
          }}
          style={{
            ...styles.playButton,
            background: isPlaying ? '#E63946' : '#333',
            borderRadius: '50%',
            border: 'none',
            width: 28,
            height: 28,
            padding: 0,
          }}
        >
          {isPlaying ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>
      </div>

      {/* Waveform with markers */}
      <div
        ref={containerRef}
        style={styles.waveformContainer}
        onPointerDown={(e) => {
          if (isDragging) return;
          const time = getTimeFromMouse(e.clientX);
          onSeek?.(time);
          setPlayheadPosition(time);
          containerRef.current?.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!containerRef.current?.hasPointerCapture(e.pointerId)) return;
          const time = getTimeFromMouse(e.clientX);
          setPlayheadPosition(time);
        }}
      >
        {/* Background dim */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: `${startPercent}%`,
          height: '100%',
          background: 'rgba(0,0,0,0.6)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          left: `${endPercent}%`,
          top: 0,
          width: `${100 - endPercent}%`,
          height: '100%',
          background: 'rgba(0,0,0,0.6)',
          pointerEvents: 'none',
        }} />

        {/* Waveform bars */}
        <svg ref={svgRef} width="100%" height="60" style={{ display: 'block', position: 'relative', zIndex: 1 }}>
          {peaks.map((peak, index) => {
            const barPercent = (index / peaks.length) * 100;
            const isInTrim = barPercent >= startPercent && barPercent <= endPercent;
            const barHeight = Math.max(4, peak * 50);
            return (
              <rect
                key={index}
                x={`${barPercent}%`}
                y={`${(60 - barHeight) / 2}`}
                width={`${100 / peaks.length * 0.85}%`}
                height={`${barHeight}`}
                fill={isInTrim ? '#E63946' : '#4a4a4a'}
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
            stroke="#fff"
            strokeWidth="2"
            opacity={0.9}
            style={{ pointerEvents: 'none' }}
          />
        </svg>

        {/* Start marker - larger click target */}
        <div
          style={{
            position: 'absolute',
            left: `${startPercent}%`,
            top: 0,
            width: 20,
            height: '100%',
            transform: 'translateX(-50%)',
            cursor: 'ew-resize',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPointerDown={(e) => handleMarkerMouseDown(e, 'start')}
        >
          <div style={{
            width: 4,
            height: '80%',
            background: '#fff',
            borderRadius: 2,
            opacity: isDragging === 'start' ? 1 : 0.7,
            boxShadow: isDragging === 'start' ? '0 0 8px rgba(255,255,255,0.5)' : 'none',
          }} />
        </div>

        {/* End marker - larger click target */}
        <div
          style={{
            position: 'absolute',
            left: `${endPercent}%`,
            top: 0,
            width: 20,
            height: '100%',
            transform: 'translateX(-50%)',
            cursor: 'ew-resize',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPointerDown={(e) => handleMarkerMouseDown(e, 'end')}
        >
          <div style={{
            width: 4,
            height: '80%',
            background: '#fff',
            borderRadius: 2,
            opacity: isDragging === 'end' ? 1 : 0.7,
            boxShadow: isDragging === 'end' ? '0 0 8px rgba(255,255,255,0.5)' : 'none',
          }} />
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        button.play-btn-fix {
          appearance: none !important;
          -webkit-appearance: none !important;
          border-radius: 50% !important;
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 12,
    border: '1px solid #2A2A2A',
    fontFamily: 'DM Sans, sans-serif',
    userSelect: 'none',
  },
  trackHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  trackId: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
  },
  timeRange: {
    color: '#A0A0A0',
    fontSize: 11,
    fontFamily: 'JetBrains Mono, monospace',
  },
  playButton: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#fff',
    marginLeft: 'auto',
    transition: 'background 150ms',
    appearance: 'none',
    WebkitAppearance: 'none',
    borderRadius: '50%',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    color: '#A0A0A0',
    gap: 8,
    fontSize: 12,
  },
  errorState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    color: '#E63946',
    fontSize: 12,
  },
  spinner: {
    width: 20,
    height: 20,
    border: '2px solid #2A2A2A',
    borderTopColor: '#E63946',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  waveformContainer: {
    position: 'relative',
    backgroundColor: '#2A2A2A',
    borderRadius: 6,
    height: 60,
    cursor: 'crosshair',
    overflow: 'visible',
  },
};