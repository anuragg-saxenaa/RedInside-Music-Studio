import { useState, useRef, useEffect, useCallback } from 'react';
import TrackLane from './TrackLane';
import TimelineView from './TimelineView';
import GridView from './GridView';
import ControlsSidebar, { AudioOperations } from './ControlsSidebar';
import { useSharedAudio } from '../../contexts/SharedAudioContext';

type ViewMode = 'timeline' | 'grid';

export interface AudioEditorPanelProps {
  projectId: string
  audioUrl: string
  trackId: string
  mode?: 'single' | 'medley'
  tracks?: any[]
  onExport?: (result: { filePath: string, duration: number }) => void
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
  audioUrl,
  trackId,
  mode = 'single',
  tracks = [],
  onExport,
}: AudioEditorPanelProps) {
  const [duration, setDuration] = useState(0);
  const [operations, setOperations] = useState<AudioOperations>({
    ...defaultOperations,
    trimEnd: 0,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<{type: 'success' | 'error' | 'processing', text: string} | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bufferLoading, setBufferLoading] = useState(false);

  // Web Audio API refs
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef<number>(0);   // AudioContext.currentTime when playback started
  const startOffsetRef = useRef<number>(0); // position in original buffer where we started
  const animationRef = useRef<number>(0);

  const isMedley = mode === 'medley';
  const { stopAll } = useSharedAudio();
  const safeVolume = Math.min(1, Math.max(0, operations.volume));

  // Decode audio buffer whenever audioUrl changes
  useEffect(() => {
    let cancelled = false;
    setBufferLoading(true);
    audioBufferRef.current = null;

    const decode = async () => {
      try {
        const resp = await fetch(audioUrl);
        if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
        const arrayBuffer = await resp.arrayBuffer();
        if (cancelled) return;

        // Decode using a temporary AudioContext (no user gesture needed for decode)
        const tempCtx = new AudioContext();
        const buffer = await tempCtx.decodeAudioData(arrayBuffer);
        await tempCtx.close();
        if (cancelled) return;

        audioBufferRef.current = buffer;
        setDuration(buffer.duration);
        setOperations(prev => ({ ...prev, trimEnd: prev.trimEnd > 0 ? prev.trimEnd : buffer.duration }));
      } catch (err) {
        console.error('AudioEditorPanel: failed to decode audio', err);
      } finally {
        if (!cancelled) setBufferLoading(false);
      }
    };

    decode();
    return () => { cancelled = true; };
  }, [audioUrl]);

  // Stop source node and cancel animation
  const stopSource = useCallback(() => {
    cancelAnimationFrame(animationRef.current);
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (_) {}
      sourceNodeRef.current = null;
    }
    gainNodeRef.current = null;
  }, []);

  // Animation loop — tracks position using AudioContext time
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(animationRef.current);
      return;
    }

    const tick = () => {
      const ctx = audioContextRef.current;
      if (!ctx) return;
      const elapsed = ctx.currentTime - startTimeRef.current;
      const pos = startOffsetRef.current + elapsed * operations.speed;
      setCurrentTime(pos);

      // Stop when past trim end (source.onended handles it too, but RAF catches early)
      if (pos >= operations.trimEnd && operations.trimEnd > 0) {
        stopSource();
        setIsPlaying(false);
        setCurrentTime(operations.trimStart);
        return;
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying, operations.trimStart, operations.trimEnd, operations.speed, stopSource]);

  const handlePreview = useCallback(async () => {
    if (isPlaying) {
      stopSource();
      setIsPlaying(false);
      return;
    }

    const buffer = audioBufferRef.current;
    if (!buffer) return;

    stopAll(); // Single playback constraint

    // Create AudioContext on user gesture
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') await ctx.resume();

    const { trimStart, trimEnd, speed, volume,
            fadeInEnabled, fadeInDuration,
            fadeOutEnabled, fadeOutDuration, reverse } = operations;

    // Slice buffer for trim region
    const sr = buffer.sampleRate;
    const startSample = Math.max(0, Math.floor(trimStart * sr));
    const endSample = Math.min(buffer.length, Math.floor(trimEnd * sr));
    const length = endSample - startSample;
    if (length <= 0) return;

    const trimmedBuffer = ctx.createBuffer(buffer.numberOfChannels, length, sr);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c).slice(startSample, endSample);
      if (reverse) data.reverse(); // In-place reverse for real-time preview
      trimmedBuffer.getChannelData(c).set(data);
    }

    // Source node
    const source = ctx.createBufferSource();
    source.buffer = trimmedBuffer;
    source.playbackRate.value = speed;

    // Gain node for volume + fade envelope
    const gainNode = ctx.createGain();
    const vol = Math.min(1, Math.max(0, volume));
    const trimDuration = (trimEnd - trimStart) / speed; // real-time duration
    const now = ctx.currentTime;

    if (fadeInEnabled && fadeInDuration > 0) {
      gainNode.gain.setValueAtTime(0.0001, now);
      gainNode.gain.linearRampToValueAtTime(vol, now + Math.min(fadeInDuration, trimDuration));
    } else {
      gainNode.gain.setValueAtTime(vol, now);
    }

    if (fadeOutEnabled && fadeOutDuration > 0) {
      const clampedFadeOut = Math.min(fadeOutDuration, trimDuration);
      const fadeOutStart = now + Math.max(0, trimDuration - clampedFadeOut);
      gainNode.gain.setValueAtTime(vol, fadeOutStart);
      gainNode.gain.linearRampToValueAtTime(0.0001, now + trimDuration);
    }

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    sourceNodeRef.current = source;
    gainNodeRef.current = gainNode;
    startTimeRef.current = now;
    startOffsetRef.current = trimStart;

    source.onended = () => {
      setIsPlaying(false);
      setCurrentTime(trimStart);
    };

    source.start(now);
    setIsPlaying(true);
    setCurrentTime(trimStart);
  }, [isPlaying, operations, safeVolume, stopAll, stopSource]);

  const handleStop = useCallback(() => {
    stopSource();
    setIsPlaying(false);
    setCurrentTime(operations.trimStart);
  }, [operations.trimStart, stopSource]);

  const buildOperationsArray = () => {
    const ops: Array<{
      type: string
      startSec?: number
      endSec?: number
      tempoFactor?: number
      gain?: number
      durationSec?: number
    }> = [];

    if (operations.trimStart > 0 || operations.trimEnd < duration) {
      ops.push({ type: 'trim', startSec: operations.trimStart, endSec: operations.trimEnd });
    }
    if (operations.speed !== 1.0) {
      ops.push({ type: 'speed', tempoFactor: operations.speed });
    }
    if (operations.volume !== 1.0) {
      ops.push({ type: 'volume', gain: operations.volume });
    }
    if (operations.fadeInEnabled && operations.fadeInDuration > 0) {
      ops.push({ type: 'fadeIn', durationSec: operations.fadeInDuration });
    }
    if (operations.fadeOutEnabled && operations.fadeOutDuration > 0) {
      ops.push({ type: 'fadeOut', durationSec: operations.fadeOutDuration });
    }
    if (operations.reverse) {
      ops.push({ type: 'reverse' });
    }
    return ops;
  };

  const handleExport = async (format: 'mp3-320' | 'wav' | 'flac') => {
    setIsExporting(true);
    setExportMessage(null);

    try {
      const outputFormat = format === 'mp3-320' ? 'mp3' : format;
      const outputPath = `/tmp/processed_${Date.now()}.${outputFormat}`;

      const payload = {
        inputPath: audioUrl,
        operations: buildOperationsArray(),
        outputPath,
        options: {
          format: outputFormat,
          bitrate: format === 'mp3-320' ? '320k' : undefined,
        },
      };

      setExportMessage({ type: 'processing', text: 'Processing audio...' });

      const response = await fetch('/api/audio/process', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Export failed');
      }

      // Trigger download
      if (data.downloadUrl) {
        // Use mastered file if available, otherwise use processed file
        const downloadFilename = data.masteredFile
          ? data.masteredFile.split('/').pop()
          : data.filePath?.split('/').pop();

        if (!downloadFilename) {
          throw new Error('No file to download');
        }

        const downloadUrl = `/api/audio/download/${downloadFilename}`;

        setExportMessage({ type: 'processing', text: 'Mastering complete! Starting download...' });

        // Create a link and click it to trigger download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = downloadFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setExportMessage({
        type: 'success',
        text: data.masteredFile
          ? `Exported & mastered! Download started.`
          : `Exported! Duration: ${data.duration?.toFixed(1) || '?'}s`
      });
      onExport?.(data);
    } catch (err) {
      setExportMessage({ type: 'error', text: err instanceof Error ? err.message : 'Export failed' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleTrimChange = (start: number, end: number) => {
    setOperations(prev => ({ ...prev, trimStart: start, trimEnd: end }));
  };

  const handleOpsChange = (newOps: AudioOperations) => {
    setOperations(newOps);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.powerLed} />
          <span style={styles.title}>AUDIO EDITOR</span>
        </div>
        {bufferLoading && (
          <span style={{ color: '#666', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>Loading...</span>
        )}
        {duration > 0 && (
          <div style={styles.durationBadge}>
            <span style={styles.durationLabel}>TOTAL</span>
            <span style={styles.durationValue}>{formatTime(duration)}</span>
          </div>
        )}
      </div>

      {/* Export message */}
      {exportMessage && (
        <div style={{
          ...styles.messageBanner,
          background: exportMessage.type === 'processing' ? 'rgba(255,184,0,0.15)' : exportMessage.type === 'success' ? 'rgba(0,210,106,0.15)' : 'rgba(230,57,70,0.15)',
          color: exportMessage.type === 'processing' ? '#FFB800' : exportMessage.type === 'success' ? '#00D26A' : '#E63946',
          borderBottom: `1px solid ${exportMessage.type === 'processing' ? 'rgba(255,184,0,0.3)' : exportMessage.type === 'success' ? 'rgba(0,210,106,0.3)' : 'rgba(230,57,70,0.3)'}`,
        }}>
          <span>{exportMessage.text}</span>
          <button onClick={() => setExportMessage(null)} style={styles.messageClose}>×</button>
        </div>
      )}

      {/* Main area */}
      <div style={styles.mainArea}>
        <div style={styles.waveformSection}>
          <div style={styles.sectionHeader}>
            <div style={styles.sectionLabel}>{isMedley ? 'MEDLEY' : 'WAVEFORM'}</div>
            {isMedley && (
              <div style={styles.viewToggle}>
                <button
                  onClick={() => setViewMode('timeline')}
                  style={{
                    ...styles.viewToggleBtn,
                    background: viewMode === 'timeline' ? '#E63946' : '#2A2A2A',
                  }}
                >
                  ≡
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  style={{
                    ...styles.viewToggleBtn,
                    background: viewMode === 'grid' ? '#E63946' : '#2A2A2A',
                  }}
                >
                  ⊞
                </button>
              </div>
            )}
          </div>
          {isMedley ? (
            viewMode === 'grid' ? (
              <GridView
                tracks={tracks}
                selectedTrackId={trackId}
                onSelectTrack={(id) => {}}
                onReorderTracks={(from, to) => {}}
                onUpdateTrack={(id, updates) => {}}
              />
            ) : (
              <TimelineView
                tracks={tracks}
                selectedTrackId={trackId}
                onSelectTrack={(id) => {}}
                onReorderTracks={(from, to) => {}}
                onUpdateTrack={(id, updates) => {}}
              />
            )
          ) : (
            <TrackLane
              audioUrl={audioUrl}
              trackId={trackId}
              trimStart={operations.trimStart}
              trimEnd={operations.trimEnd}
              duration={duration}
              currentTime={currentTime}
              isSelected={true}
              isPlaying={isPlaying}
              onSeek={(t) => {
                // Seek: if playing, restart from new position; otherwise just update cursor
                setCurrentTime(t);
                if (isPlaying) {
                  stopSource();
                  startOffsetRef.current = t;
                  // Re-trigger handlePreview from new offset position
                  setIsPlaying(false);
                }
              }}
              onTrimChange={handleTrimChange}
              onPlayPause={handlePreview}
            />
          )}
        </div>

        <ControlsSidebar
          duration={duration}
          operations={operations}
          onChange={handleOpsChange}
          onPreview={handlePreview}
          onExport={handleExport}
          isExporting={isExporting}
        />
      </div>

      {/* Console bar */}
      <div style={styles.consoleBar}>
        <div style={styles.transportBtns}>
          <button onClick={handleStop} style={styles.transportBtn}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" />
            </svg>
          </button>
          <button
            onClick={handlePreview}
            style={{
              ...styles.transportBtn,
              ...styles.playBtn,
              background: isPlaying ? '#E63946' : '#333',
            }}
          >
            {isPlaying ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>
        </div>

        <div style={styles.progressSection}>
          <div style={styles.progressBar} onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            const newTime = percent * duration;
            setCurrentTime(newTime);
            // If playing, restart from new position
            if (isPlaying) {
              stopSource();
              startOffsetRef.current = newTime;
              setIsPlaying(false);
            }
          }}>
            <div style={{
              ...styles.progressFill,
              width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`
            }} />
          </div>
          <div style={styles.timeDisplay}>
            <span style={styles.currentTime}>{formatTime(currentTime)}</span>
            <span style={styles.timeSep}>/</span>
            <span style={styles.totalTime}>{formatTime(duration)}</span>
          </div>
        </div>

        <div style={styles.infoChips}>
          <div style={{...styles.chip, background: operations.speed !== 1.0 ? '#E63946' : '#1a1a1a'}}>
            <span style={styles.chipLabel}>SPD</span>
            <span style={styles.chipValue}>{operations.speed.toFixed(2)}x</span>
          </div>
          <div style={{...styles.chip, background: operations.volume !== 1.0 ? '#E63946' : '#1a1a1a'}}>
            <span style={styles.chipLabel}>VOL</span>
            <span style={styles.chipValue}>{Math.round(operations.volume * 100)}%</span>
          </div>
          {operations.fadeInEnabled && (
            <div style={{...styles.chip, background: '#E63946'}}>
              <span style={styles.chipLabel}>IN</span>
              <span style={styles.chipValue}>{operations.fadeInDuration}s</span>
            </div>
          )}
          {operations.fadeOutEnabled && (
            <div style={{...styles.chip, background: '#E63946'}}>
              <span style={styles.chipLabel}>OUT</span>
              <span style={styles.chipValue}>{operations.fadeOutDuration}s</span>
            </div>
          )}
          {operations.reverse && (
            <div style={{...styles.chip, background: '#E63946'}}>
              <span style={styles.chipLabel}>REV</span>
            </div>
          )}
        </div>
        {(operations.speed !== 1.0 || operations.volume !== 1.0 || operations.fadeInEnabled || operations.fadeOutEnabled || operations.reverse) && (
          <div style={styles.effectsBadge}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#FFB800">
              <path d="M12 3v18M3 12h18" stroke="#FFB800" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span style={{color: '#FFB800', fontSize: 10, fontWeight: 600}}>EFFECTS ACTIVE</span>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)',
    borderRadius: 12,
    border: '1px solid #3a3a3a',
    overflow: 'hidden',
    fontFamily: 'Outfit, sans-serif',
  },
  header: {
    background: 'linear-gradient(180deg, #1e1e1e 0%, #141414 100%)',
    padding: '12px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #2a2a2a',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  powerLed: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#00FF00',
    boxShadow: '0 0 8px #00FF00',
  },
  title: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 2,
    fontFamily: 'Bebas Neue, sans-serif',
  },
  durationBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
  },
  durationLabel: {
    color: '#666',
    fontSize: 9,
    letterSpacing: 1,
  },
  durationValue: {
    color: '#00FF00',
    fontSize: 15,
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 600,
  },
  messageBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 20px',
    fontSize: 12,
  },
  messageClose: {
    background: 'none',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: 16,
    padding: 0,
  },
  mainArea: {
    padding: 20,
    display: 'flex',
    gap: 20,
  },
  waveformSection: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  sectionLabel: {
    color: '#555',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  viewToggle: {
    display: 'flex',
    gap: 4,
  },
  viewToggleBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: 'none',
    color: '#fff',
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  consoleBar: {
    background: 'linear-gradient(180deg, #141414 0%, #0a0a0a 100%)',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    borderTop: '1px solid #2a2a2a',
  },
  transportBtns: {
    display: 'flex',
    gap: 8,
  },
  transportBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '1px solid #333',
    background: '#1a1a1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#888',
  },
  playBtn: {
    border: 'none',
    borderRadius: '50%',
  },
  progressSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  progressBar: {
    height: 4,
    background: '#1a1a1a',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #00FF00 0%, #FFB800 70%, #E63946 100%)',
    transition: 'width 100ms linear',
  },
  timeDisplay: {
    display: 'flex',
    gap: 4,
    fontSize: 11,
    fontFamily: 'JetBrains Mono, monospace',
  },
  currentTime: {
    color: '#fff',
    fontWeight: 600,
  },
  timeSep: {
    color: '#555',
  },
  totalTime: {
    color: '#888',
  },
  infoChips: {
    display: 'flex',
    gap: 6,
  },
  chip: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 4,
    padding: '4px 8px',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  chipLabel: {
    color: '#666',
    fontSize: 9,
    fontFamily: 'JetBrains Mono, monospace',
  },
  chipValue: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 600,
  },
  effectsBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    background: 'rgba(255,184,0,0.1)',
    border: '1px solid rgba(255,184,0,0.3)',
    borderRadius: 4,
  },
};