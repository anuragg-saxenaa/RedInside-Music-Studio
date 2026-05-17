import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { LyricsGeneration, MusicGeneration } from '../../types';
import { registerAudioStop, stopAllRegisteredAudio } from '../../utils/audioControl';
import { useWebSocket } from '../../hooks/useWebSocket';

// ============== GLOBAL PLAYBACK STATE MANAGER ==============
let globalPlayingId: string | null = null;
let globalAudioElement: HTMLAudioElement | null = null;
let globalPlaylist: MusicGeneration[] = [];
const listeners = new Set<(playingId: string | null) => void>();

export function stopAllPlayback() {
  if (globalAudioElement) {
    globalAudioElement.pause();
    globalAudioElement.currentTime = 0;
  }
  globalPlayingId = null;
  notifyListeners();
  // Also stop all other audio systems (CompactPlayer, AudioEditor, etc.)
  stopAllRegisteredAudio();
}

function notifyListeners() {
  listeners.forEach(l => l(globalPlayingId));
}

export function subscribeToPlaybackState(callback: (playingId: string | null) => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function setGlobalPlaylist(playlist: MusicGeneration[]) {
  globalPlaylist = playlist;
}

export function getGlobalPlaylist(): MusicGeneration[] {
  return globalPlaylist;
}

// ============== ICONS (SVG, no emoji) ==============
const PlayIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5,3 19,12 5,21" />
  </svg>
);

const PauseIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);

const SkipBackIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="19,20 9,12 19,4" />
    <line x1="5" y1="19" x2="5" y2="5" />
  </svg>
);

const SkipForwardIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="5,4 15,12 5,20" />
    <line x1="19" y1="4" x2="19" y2="20" />
  </svg>
);

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const ConvertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 21h5v-5" />
  </svg>
);

const MusicNoteIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5">
    <circle cx="5.5" cy="17.5" r="2.5" />
    <circle cx="18.5" cy="17.5" r="2.5" />
    <path d="M15 6l-6 4-6-4" />
    <path d="M3 17.5v-7A2 2 0 0 1 5 8.5h11a2 2 0 0 1 2 2v7" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CancelIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

// ============== GENERATION PROGRESS INDICATOR ==============
interface GenerationProgressProps {
  jobId: string;
  onCancel: () => void;
}

const GenerationProgressIndicator = ({ jobId, onCancel }: GenerationProgressProps) => {
  const [elapsedSec, setElapsedSec] = useState(0);
  const [pulsePhase, setPulsePhase] = useState(0);
  const startTimeRef = useRef(Date.now());
  const animationRef = useRef<number>();

  useEffect(() => {
    startTimeRef.current = Date.now();
    setElapsedSec(0);

    const updateTime = () => {
      setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
      setPulsePhase(p => (p + 1) % 100);
      animationRef.current = requestAnimationFrame(updateTime);
    };
    animationRef.current = requestAnimationFrame(updateTime);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [jobId]);

  const formatTime = (sec: number) => {
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return `${min}m ${s}s`;
  };

  // Animated waveform bars (8 bars, varying heights)
  const bars = [0.3, 0.5, 0.8, 1, 0.7, 0.9, 0.4, 0.6];
  const animatedBars = bars.map((baseHeight, i) => {
    const phase = (pulsePhase + i * 12) % 100;
    const wave = Math.sin(phase * Math.PI / 50) * 0.5 + 0.5;
    return baseHeight * (0.6 + wave * 0.4);
  });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '16px 20px',
      background: 'linear-gradient(135deg, rgba(230,57,70,0.15) 0%, rgba(184,35,46,0.1) 100%)',
      borderRadius: '12px',
      border: '1px solid rgba(230,57,70,0.3)',
      boxShadow: '0 0 30px rgba(230,57,70,0.15), inset 0 0 20px rgba(0,0,0,0.3)',
    }}>
      {/* Animated waveform */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        height: '36px',
        padding: '0 8px',
        background: 'rgba(0,0,0,0.4)',
        borderRadius: '8px',
      }}>
        {animatedBars.map((height, i) => (
          <div
            key={i}
            style={{
              width: '4px',
              height: `${height * 100}%`,
              background: i === 3 || i === 4
                ? 'linear-gradient(180deg, #E63946 0%, #FF6B6B 100%)'
                : '#888',
              borderRadius: '2px',
              transition: 'height 150ms ease',
              boxShadow: i === 3 || i === 4 ? '0 0 8px rgba(230,57,70,0.8)' : 'none',
            }}
          />
        ))}
      </div>

      {/* Status text */}
      <div style={{ flex: 1 }}>
        <div style={{
          color: '#fff',
          fontSize: '14px',
          fontWeight: 600,
          fontFamily: "'Outfit', sans-serif",
          marginBottom: '4px',
          textShadow: '0 0 10px rgba(230,57,70,0.5)',
        }}>
          Generating your track
          <span style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#E63946',
            marginLeft: '8px',
            animation: 'pulse 1.5s ease-in-out infinite',
            boxShadow: '0 0 10px #E63946',
          }} />
        </div>
        <div style={{
          color: '#888',
          fontSize: '12px',
          fontFamily: "'DM Sans', sans-serif",
        }}>
          This usually takes 1-2 minutes
        </div>
      </div>

      {/* Time elapsed */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '2px',
      }}>
        <div style={{
          color: '#FFB800',
          fontSize: '16px',
          fontWeight: 700,
          fontFamily: "'Outfit', sans-serif",
          fontVariantNumeric: 'tabular-nums',
        }}>
          {formatTime(elapsedSec)}
        </div>
        <div style={{ color: '#555', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Elapsed
        </div>
      </div>

      {/* Cancel button */}
      <button
        onClick={onCancel}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 14px',
          borderRadius: '8px',
          border: '1px solid rgba(255,100,100,0.3)',
          background: 'rgba(255,50,50,0.1)',
          color: '#ff6b6b',
          fontSize: '12px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 150ms',
          fontFamily: "'DM Sans', sans-serif",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = 'rgba(255,50,50,0.2)';
          e.currentTarget.style.borderColor = 'rgba(255,100,100,0.6)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = 'rgba(255,50,50,0.1)';
          e.currentTarget.style.borderColor = 'rgba(255,100,100,0.3)';
        }}
      >
        <CancelIcon />
        Cancel
      </button>
    </div>
  );
};

const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const VolumeIcon = ({ muted, size = 18 }: { muted: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
    {!muted && <path d="M15.54,8.46 a5,5,0,0,1 0,7.07" />}
    {!muted && <path d="M19.07,4.93 a10,10,0,0,1 0,14.14" />}
    {muted && <><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>}
  </svg>
);

// ============== HELPERS ==============
const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// ============== AUDIO EDITOR INLINE (Glass effect) ==============
interface AudioEditorInlineProps {
  audioUrl: string;
  trackId: string;
  onClose: () => void;
  onExportComplete?: (result: any) => void;
}

function AudioEditorInline({ audioUrl, trackId: _trackId, onClose, onExportComplete }: AudioEditorInlineProps) {
  const [peaks, setPeaks] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'processing'; text: string } | null>(null);
  const [speed, setSpeed] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [fadeIn, setFadeIn] = useState(false);
  const [fadeInDur, setFadeInDur] = useState(1.0);
  const [fadeOut, setFadeOut] = useState(false);
  const [fadeOutDur, setFadeOutDur] = useState(1.0);
  const [reverse, setReverse] = useState(false);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const unregisterStopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchAudio = async () => {
      try {
        setLoading(true);
        const response = await fetch(audioUrl);
        if (!response.ok) throw new Error('Failed to fetch audio');
        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;

        const audioCtx = new AudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        if (cancelled) { audioCtx.close(); return; }

        audioBufferRef.current = audioBuffer;

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
        setPeaks(peakData.map(p => p / maxPeak));
        setDuration(audioBuffer.duration);
        setTrimEnd(audioBuffer.duration);
        setLoading(false);
        audioCtx.close();
      } catch (err) {
        setLoading(false);
      }
    };
    fetchAudio();
    return () => { cancelled = true; };
  }, [audioUrl]);

  const stopPreview = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (sourceNodeRef.current) { try { sourceNodeRef.current.stop(); } catch (_) {} sourceNodeRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    unregisterStopRef.current?.(); unregisterStopRef.current = null;
    setIsPlaying(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, [stopPreview]);

  const getTimeFromX = (clientX: number): number => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(x / rect.width, 1));
    return percent * duration;
  };

  const handleMarkerDown = (e: React.PointerEvent, marker: 'start' | 'end') => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(marker);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: PointerEvent) => {
      const time = getTimeFromX(e.clientX);
      if (isDragging === 'start') {
        setTrimStart(Math.max(0, Math.min(time, trimEnd - 0.5)));
      } else {
        setTrimEnd(Math.max(trimStart + 0.5, Math.min(time, duration)));
      }
    };

    const handleUp = () => setIsDragging(null);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isDragging, duration, trimStart, trimEnd]);

  const startPct = duration > 0 ? (trimStart / duration) * 100 : 0;
  const endPct = duration > 0 ? (trimEnd / duration) * 100 : 100;
  const playheadPct = duration > 0 ? (playheadSec / duration) * 100 : 0;

  const handlePreview = useCallback(async () => {
    if (isPlaying) { stopPreview(); return; }

    const buffer = audioBufferRef.current;
    if (!buffer) return;

    // Stop all other audio before previewing
    stopAllRegisteredAudio();

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const sampleRate = buffer.sampleRate;
    const startSample = Math.floor(trimStart * sampleRate);
    const endSample = Math.min(Math.floor(trimEnd * sampleRate), buffer.length);
    const frameCount = endSample - startSample;
    if (frameCount <= 0) { ctx.close(); return; }

    // Slice and optionally reverse the buffer
    const trimmedBuffer = ctx.createBuffer(buffer.numberOfChannels, frameCount, sampleRate);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c).slice(startSample, endSample);
      if (reverse) data.reverse();
      trimmedBuffer.getChannelData(c).set(data);
    }

    const gainNode = ctx.createGain();
    const safeVol = Math.min(1, Math.max(0.001, volume));
    const now = ctx.currentTime;
    const segDur = trimmedBuffer.duration / speed;

    if (fadeIn && fadeInDur > 0) {
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(safeVol, now + Math.min(fadeInDur, segDur * 0.5));
    } else {
      gainNode.gain.setValueAtTime(safeVol, now);
    }

    if (fadeOut && fadeOutDur > 0 && segDur > fadeOutDur) {
      const fadeStart = now + segDur - Math.min(fadeOutDur, segDur * 0.5);
      gainNode.gain.setValueAtTime(safeVol, fadeStart);
      gainNode.gain.linearRampToValueAtTime(0.001, now + segDur);
    }

    gainNode.connect(ctx.destination);

    const source = ctx.createBufferSource();
    source.buffer = trimmedBuffer;
    source.playbackRate.value = speed;
    source.connect(gainNode);
    sourceNodeRef.current = source;
    startTimeRef.current = ctx.currentTime;

    const handleEnded = () => {
      setPlayheadSec(reverse ? trimStart : trimEnd);
      stopPreview();
    };
    source.onended = handleEnded;

    // Register with shared registry so other players can stop this
    unregisterStopRef.current = registerAudioStop(() => { stopPreview(); });

    source.start();
    setIsPlaying(true);
    setPlayheadSec(reverse ? trimEnd : trimStart);

    // Animate playhead
    const animate = () => {
      if (!audioCtxRef.current) return;
      const elapsed = audioCtxRef.current.currentTime - startTimeRef.current;
      const elapsed_realtime = elapsed * speed;
      const currentSec = reverse
        ? Math.max(trimStart, trimEnd - elapsed_realtime)
        : Math.min(trimEnd, trimStart + elapsed_realtime);
      setPlayheadSec(currentSec);
      if (elapsed_realtime < (trimEnd - trimStart)) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
  }, [isPlaying, trimStart, trimEnd, volume, speed, fadeIn, fadeInDur, fadeOut, fadeOutDur, reverse, stopPreview]);

  const handleExport = async () => {
    setIsExporting(true);
    setMessage(null);

    try {
      const ops = [];
      if (trimStart > 0 || trimEnd < duration) {
        ops.push({ type: 'trim', startSec: trimStart, endSec: trimEnd });
      }
      if (speed !== 1.0) ops.push({ type: 'speed', tempoFactor: speed });
      if (volume !== 1.0) ops.push({ type: 'volume', gain: volume });
      if (fadeIn) ops.push({ type: 'fadeIn', durationSec: fadeInDur });
      if (fadeOut) ops.push({ type: 'fadeOut', durationSec: fadeOutDur });
      if (reverse) ops.push({ type: 'reverse' });

      const outputPath = `/tmp/processed_${Date.now()}.mp3`;

      const response = await fetch('/api/audio/process', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputPath: audioUrl, operations: ops, outputPath, options: { format: 'mp3', bitrate: '320k' } }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Export failed');

      const filename = data.masteredFile?.split('/').pop() || data.filePath?.split('/').pop();
      if (filename) {
        const link = document.createElement('a');
        link.href = `/api/audio/download/${filename}`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setMessage({ type: 'success', text: 'Exported successfully!' });
      onExportComplete?.(data);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Export failed' });
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
        Loading audio...
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(30,30,30,0.95) 0%, rgba(15,15,15,0.98) 100%)',
      backdropFilter: 'blur(40px)',
      WebkitBackdropFilter: 'blur(40px)',
      borderRadius: '20px',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(40,40,40,0.8) 0%, rgba(25,25,25,0.8) 100%)',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#E63946', boxShadow: '0 0 12px #E63946',
          }} />
          <span style={{
            color: '#fff', fontSize: '13px', fontWeight: 700,
            letterSpacing: '2px', fontFamily: "'Outfit', sans-serif",
          }}>AUDIO EDITOR</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px',
            color: '#888', fontSize: '18px', cursor: 'pointer', padding: '6px 12px',
            transition: 'all 150ms',
          }}
          onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
          onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = '#888'; }}
        >
          ×
        </button>
      </div>

      {/* Waveform */}
      <div style={{ padding: '20px' }}>
        <div
          data-testid="waveform-display"
          ref={containerRef}
          style={{
            position: 'relative', background: 'rgba(0,0,0,0.4)',
            borderRadius: '12px', height: '80px', cursor: 'crosshair',
            overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ position: 'absolute', left: 0, top: 0, width: `${startPct}%`, height: '100%', background: 'rgba(0,0,0,0.6)' }} />
          <div style={{ position: 'absolute', left: `${endPct}%`, top: 0, width: `${100 - endPct}%`, height: '100%', background: 'rgba(0,0,0,0.6)' }} />

          <svg width="100%" height="80" style={{ display: 'block' }}>
            {peaks.map((peak, i) => {
              const pct = (i / peaks.length) * 100;
              const inTrim = pct >= startPct && pct <= endPct;
              const h = Math.max(4, peak * 60);
              return <rect key={i} x={`${pct}%`} y={`${(80 - h) / 2}`} width={`${100 / peaks.length * 0.85}%`} height={`${h}`} fill={inTrim ? '#E63946' : '#444'} rx="1" />;
            })}
            {isPlaying && (
              <line x1={`${playheadPct}%`} y1="0" x2={`${playheadPct}%`} y2="80" stroke="#fff" strokeWidth="2" opacity={0.9} style={{ pointerEvents: 'none' }} />
            )}
          </svg>

          <div style={{ position: 'absolute', left: `${startPct}%`, top: 0, width: '20px', height: '100%', transform: 'translateX(-50%)', cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }} onPointerDown={(e) => handleMarkerDown(e, 'start')}>
            <div style={{ width: 4, height: '70%', background: '#fff', borderRadius: 2, boxShadow: '0 0 8px rgba(255,255,255,0.5)' }} />
          </div>
          <div style={{ position: 'absolute', left: `${endPct}%`, top: 0, width: '20px', height: '100%', transform: 'translateX(-50%)', cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }} onPointerDown={(e) => handleMarkerDown(e, 'end')}>
            <div style={{ width: 4, height: '70%', background: '#fff', borderRadius: 2, boxShadow: '0 0 8px rgba(255,255,255,0.5)' }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '12px', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>
          <span>START: <span style={{ color: '#00FF00' }}>{formatTime(trimStart * 1000)}</span></span>
          <span>END: <span style={{ color: '#00FF00' }}>{formatTime(trimEnd * 1000)}</span></span>
          <span>LENGTH: <span style={{ color: '#E63946' }}>{formatTime((trimEnd - trimStart) * 1000)}</span></span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', color: '#666', fontSize: '10px', marginBottom: '6px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>SPEED: {speed.toFixed(2)}x</label>
            <input type="range" min="0.5" max="2" step="0.05" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ display: 'block', color: '#666', fontSize: '10px', marginBottom: '6px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}>VOLUME: {Math.round(volume * 100)}%</label>
            <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} style={{ width: '100%' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setFadeIn(!fadeIn)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid', borderColor: fadeIn ? '#00D26A' : 'rgba(255,255,255,0.1)', background: fadeIn ? 'rgba(0,210,106,0.15)' : 'transparent', color: fadeIn ? '#00D26A' : '#888', fontSize: '11px', cursor: 'pointer', transition: 'all 150ms' }}>
            FADE IN{fadeIn && ` (${fadeInDur}s)`}
          </button>
          {fadeIn && <input type="number" value={fadeInDur} onChange={(e) => setFadeInDur(parseFloat(e.target.value) || 1)} min="0.1" max="10" step="0.1" style={{ width: '50px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#00FF00', fontSize: '11px', padding: '4px 8px' }} />}

          <button onClick={() => setFadeOut(!fadeOut)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid', borderColor: fadeOut ? '#00D26A' : 'rgba(255,255,255,0.1)', background: fadeOut ? 'rgba(0,210,106,0.15)' : 'transparent', color: fadeOut ? '#00D26A' : '#888', fontSize: '11px', cursor: 'pointer', transition: 'all 150ms' }}>
            FADE OUT{fadeOut && ` (${fadeOutDur}s)`}
          </button>
          {fadeOut && <input type="number" value={fadeOutDur} onChange={(e) => setFadeOutDur(parseFloat(e.target.value) || 1)} min="0.1" max="10" step="0.1" style={{ width: '50px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#00FF00', fontSize: '11px', padding: '4px 8px' }} />}

          <button onClick={() => setReverse(!reverse)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid', borderColor: reverse ? '#E63946' : 'rgba(255,255,255,0.1)', background: reverse ? 'rgba(230,57,70,0.15)' : 'transparent', color: reverse ? '#E63946' : '#888', fontSize: '11px', cursor: 'pointer', transition: 'all 150ms' }}>
            REVERSE
          </button>
        </div>

        <div style={{ color: '#555', fontSize: '10px', letterSpacing: '0.5px', fontFamily: "'JetBrains Mono', monospace" }}>
          PREVIEW plays trim region with all effects applied in realtime.
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          <button
            onClick={handlePreview}
            style={{
              flex: 1, padding: '14px', borderRadius: '10px', border: 'none',
              background: isPlaying ? '#E63946' : 'rgba(255,255,255,0.1)',
              color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 200ms',
            }}
          >
            {isPlaying ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
            {isPlaying ? 'PAUSE' : 'PREVIEW'}
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            style={{
              flex: 1, padding: '14px', borderRadius: '10px', border: 'none',
              background: isExporting ? '#666' : '#E63946',
              color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              transition: 'all 200ms',
            }}
          >
            {isExporting ? 'PROCESSING...' : 'APPLY & DOWNLOAD'}
          </button>
        </div>

        {message && (
          <div style={{
            padding: '12px', borderRadius: '8px',
            background: message.type === 'success' ? 'rgba(0,210,106,0.15)' : message.type === 'error' ? 'rgba(230,57,70,0.15)' : 'rgba(255,184,0,0.15)',
            color: message.type === 'success' ? '#00D26A' : message.type === 'error' ? '#E63946' : '#FFB800',
            fontSize: '12px', textAlign: 'center',
          }}>
            {message.text}
          </div>
        )}
      </div>

      <style>{`
        button { appearance: none; -webkit-appearance: none; }
        input[type="range"] { appearance: none; -webkit-appearance: none; background: rgba(255,255,255,0.1); height: 4px; border-radius: 2px; cursor: pointer; }
        input[type="range"]::-webkit-slider-thumb { appearance: none; -webkit-appearance: none; width: 14px; height: 14px; background: #E63946; border-radius: 50%; cursor: pointer; box-shadow: 0 2px 6px rgba(230,57,70,0.4); }
      `}</style>
    </div>
  );
}

// ============== TRACK ROW COMPONENT ==============
interface TrackRowProps {
  music: MusicGeneration;
  isPlaying: boolean;
  isThisPlaying: boolean;
  onPlay: () => void;
  onEdit: () => void;
  onConvert: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

function TrackRow({ music, isPlaying: _isPlaying, isThisPlaying, onPlay, onEdit, onConvert, onDownload, onDelete }: TrackRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [converting, setConverting] = useState(false);

  const handleConvert = async () => {
    setConverting(true);
    await onConvert();
    setConverting(false);
  };

  return (
    <div
      data-testid="track-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '12px 16px',
        background: isThisPlaying
          ? 'linear-gradient(135deg, rgba(230, 57, 70, 0.12) 0%, rgba(230, 57, 70, 0.04) 100%)'
          : isHovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        borderRadius: '12px',
        border: isThisPlaying ? '1px solid rgba(230, 57, 70, 0.3)' : '1px solid transparent',
        transition: 'all 200ms ease',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onPlay}
    >
      {/* Play button */}
      <button
        data-testid="play-button"
        onClick={(e) => { e.stopPropagation(); onPlay(); }}
        style={{
          width: '36px', height: '36px', borderRadius: '50%', border: 'none',
          background: isThisPlaying
            ? 'linear-gradient(135deg, #E63946 0%, #B8232E 100%)'
            : 'rgba(255,255,255,0.08)',
          color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isThisPlaying ? '0 4px 15px rgba(230,57,70,0.4)' : 'none',
          transition: 'all 200ms',
          transform: isThisPlaying ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        {isThisPlaying ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
      </button>

      {/* Artwork */}
      <div style={{
        width: '48px', height: '48px', borderRadius: '8px',
        background: 'linear-gradient(145deg, #2a2a2a 0%, #1a1a1a 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, overflow: 'hidden',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)',
      }}>
        <MusicNoteIcon />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{
            color: isThisPlaying ? '#E63946' : '#fff',
            fontSize: '14px', fontWeight: 600, fontFamily: "'Outfit', sans-serif",
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {music.title || `Version ${music.version}`}
          </span>
          <span style={{
            background: 'rgba(230,57,70,0.15)', color: '#E63946',
            fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: 600,
          }}>
            v{music.version}
          </span>
          {isThisPlaying && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              color: '#E63946', fontSize: '10px', fontWeight: 600,
            }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: '#E63946', boxShadow: '0 0 8px #E63946',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
              PLAYING
            </span>
          )}
        </div>
        <div style={{
          color: '#666', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace",
        }}>
          {music.duration_seconds ? formatTime(music.duration_seconds * 1000) : '--:--'} • {music.model || 'unknown'}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', opacity: isHovered || isThisPlaying ? 1 : 0.4, transition: 'opacity 200ms' }}>
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px', color: '#888', cursor: 'pointer', transition: 'all 150ms' }} title="Edit" onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(230,57,70,0.2)'; (e.currentTarget as HTMLButtonElement).style.color = '#E63946'; }} onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = '#888'; }}>
          <EditIcon />
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleConvert(); }} disabled={converting} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px', color: '#888', cursor: 'pointer', transition: 'all 150ms' }} title="Convert to MP3" onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,210,106,0.2)'; (e.currentTarget as HTMLButtonElement).style.color = '#00D26A'; }} onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = '#888'; }}>
          {converting ? <div style={{ width: '16px', height: '16px', border: '2px solid #666', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <ConvertIcon />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDownload(); }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px', color: '#888', cursor: 'pointer', transition: 'all 150ms' }} title="Download" onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }} onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = '#888'; }}>
          <DownloadIcon />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px', color: '#888', cursor: 'pointer', transition: 'all 150ms' }} title="Delete" onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(230,57,70,0.2)'; (e.currentTarget as HTMLButtonElement).style.color = '#E63946'; }} onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = '#888'; }}>
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

// ============== BOTTOM PLAYBACK BAR ==============
interface PlaybackBarProps {
  music: MusicGeneration | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onSeekBy: (seconds: number) => void;
  onVolumeChange: (volume: number) => void;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  onToggleMute: () => void;
}

function PlaybackBar({ music, isPlaying, onTogglePlay, onSeek, onSeekBy, onVolumeChange, currentTime, duration, volume, isMuted, onToggleMute }: PlaybackBarProps) {
  if (!music) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'linear-gradient(180deg, rgba(30,30,30,0.98) 0%, rgba(15,15,15,0.99) 100%)',
      backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 -10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
      padding: '12px 24px', zIndex: 1000,
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '20px' }}>
        {/* Track info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '200px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '8px',
            background: 'linear-gradient(145deg, #2a2a2a 0%, #1a1a1a 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MusicNoteIcon />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600, fontFamily: "'Outfit', sans-serif" }}>
              {music.title || `Version ${music.version}`}
            </div>
            <div style={{ color: '#666', fontSize: '11px' }}>{music.model}</div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => onSeekBy(-10)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '4px', display: 'flex' }} title="Back 10s"><SkipBackIcon size={20} /></button>
          <button
            onClick={onTogglePlay}
            style={{
              width: '40px', height: '40px', borderRadius: '50%', border: 'none',
              background: 'linear-gradient(135deg, #E63946 0%, #B8232E 100%)',
              color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(230,57,70,0.4)',
            }}
          >
            {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
          </button>
          <button onClick={() => onSeekBy(10)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '4px', display: 'flex' }} title="Forward 10s"><SkipForwardIcon size={20} /></button>
        </div>

        {/* Progress */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#888', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", minWidth: '40px', textAlign: 'right' }}>{formatTime(currentTime)}</span>
          <div style={{ flex: 1, position: 'relative', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', cursor: 'pointer' }} onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            onSeek(percent * duration);
          }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #E63946 0%, #FF6B6B 100%)', borderRadius: '2px' }} />
            <div style={{ position: 'absolute', top: '50%', left: `${progress}%`, transform: 'translate(-50%, -50%)', width: '12px', height: '12px', background: '#fff', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', display: isPlaying ? 'block' : 'none' }} />
          </div>
          <span style={{ color: '#888', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", minWidth: '40px' }}>{formatTime(duration)}</span>
        </div>

        {/* Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={onToggleMute} style={{ background: 'none', border: 'none', color: isMuted ? '#E63946' : '#888', cursor: 'pointer', padding: '4px', display: 'flex' }}>
            <VolumeIcon muted={isMuted} />
          </button>
          <input
            type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            style={{ width: '80px', accentColor: '#E63946', cursor: 'pointer' }}
          />
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        input[type="range"] { -webkit-appearance: none; appearance: none; background: rgba(255,255,255,0.1); height: 4px; border-radius: 2px; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: #fff; border-radius: 50%; cursor: pointer; }
      `}</style>
    </div>
  );
}

// ============== MAIN MUSIC PLAYER COMPONENT ==============
interface MusicPlayerProps {
  projectId: string;
  selectedLyrics: LyricsGeneration | null;
  onMusicGenerated: (music: MusicGeneration) => void;
  onSelectForPlayer?: (music: MusicGeneration) => void;
  allMusic?: MusicGeneration[];
  onConversionComplete?: () => void;
}

export default function MusicPlayer({ projectId, selectedLyrics, onMusicGenerated, onSelectForPlayer, onConversionComplete }: MusicPlayerProps) {
  const [generating, setGenerating] = useState(false);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const pollingJobIdRef = useRef<string | null>(null);
  pollingJobIdRef.current = pollingJobId;
  const [error, setError] = useState<string | null>(null);
  const [musicHistory, setMusicHistory] = useState<MusicGeneration[]>([]);
  const [model] = useState('music-2.6');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [mode, setMode] = useState<'generate' | 'cover'>('generate');
  const [customPrompt, setCustomPrompt] = useState('');
  const [editingMusic, setEditingMusic] = useState<MusicGeneration | null>(null);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);

  // Playback state
  const [currentTrack, setCurrentTrack] = useState<MusicGeneration | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0); // real duration from audio element
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const audioStopUnregisterRef = useRef<(() => void) | null>(null);

  // WebSocket: instant job completion notification (faster than 3s polling)
  useWebSocket((event) => {
    if ((event.type === 'job.completed' || event.type === 'job.failed') && event.jobId === pollingJobIdRef.current) {
      if (event.type === 'job.completed') {
        setPollingJobId(null);
        fetch(`/api/projects/${projectId}/music`)
          .then(r => r.json())
          .then(list => { setMusicHistory(list); if (list.length > 0) onMusicGenerated(list[0]); })
          .catch(console.error);
      } else {
        setError(event.error || 'Generation failed');
        setPollingJobId(null);
      }
    }
  });

  // Subscribe to global playback
  useEffect(() => {
    const unsubscribe = subscribeToPlaybackState((playingId) => {
      if (playingId !== currentTrack?.id && isPlaying) {
        setIsPlaying(false);
      }
    });
    return () => { unsubscribe(); };
  }, [currentTrack?.id, isPlaying]);

  useEffect(() => {
    fetchMusicList();
  }, [projectId]);

  useEffect(() => {
    setGlobalPlaylist(musicHistory);
  }, [musicHistory]);

  const fetchMusicList = () => {
    fetch(`/api/projects/${projectId}/music`)
      .then(res => res.json())
      .then(setMusicHistory)
      .catch(console.error);
  };

  const generateMusic = async () => {
    if (generating || !!pollingJobId) return;
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/music/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          lyricsId: selectedLyrics?.id,
          model,
          prompt: [selectedStyle && `[${selectedStyle} style]`, customPrompt].filter(Boolean).join(' ') || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start generation');
      }

      const { jobId } = await response.json();
      setPollingJobId(jobId);
      setGenerating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setGenerating(false);
    }
  };

  const handleCancelGeneration = async () => {
    if (!pollingJobId) return;
    try {
      await fetch(`/api/jobs/${pollingJobId}/cancel`, { method: 'POST' });
    } catch (err) {
      console.error('Cancel failed:', err);
    }
    setPollingJobId(null);
    setGenerating(false);
  };

  useEffect(() => {
    if (!pollingJobId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${pollingJobId}`);
        const job = await res.json();

        if (job.status === 'completed') {
          setPollingJobId(null);
          fetch(`/api/projects/${projectId}/music`)
            .then(res => res.json())
            .then(musicList => {
              setMusicHistory(musicList);
              if (musicList.length > 0) {
                onMusicGenerated(musicList[0]);
              }
            })
            .catch(console.error);
        } else if (job.status === 'failed') {
          setError(job.error_message || job.error || 'Generation failed');
          setPollingJobId(null);
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [pollingJobId]);

  const handleUploadNew = async (file: File) => {
    setUploadingFile(file);
    const formData = new FormData();
    formData.append('files', file);

    try {
      // Upload the file first
      const res = await fetch(`/api/mastering/upload/${projectId}`, { method: 'POST', body: formData });
      const data = await res.json();

      const fileId = data.files?.[0]?.id;
      if (fileId) {
        // Process/master it to create a music entry
        await fetch('/api/mastering/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId, projectId, preset: 'spotify', saveToProject: true }),
        });
        // Refresh the music list and notify parent so workflow steps unlock
        const musicListRes = await fetch(`/api/projects/${projectId}/music`);
        const musicList = await musicListRes.json();
        setMusicHistory(musicList);
        if (musicList.length > 0) {
          onMusicGenerated(musicList[0]);
        }
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploadingFile(null);
    }
  };

  const handleConvertToMp3 = async (musicId: string) => {
    await fetch(`/api/music/${musicId}/convert`, { method: 'POST' });
    fetchMusicList();
    onConversionComplete?.();
  };

  const handleDeleteMusic = async (musicId: string) => {
    if (!confirm('Are you sure you want to delete this song?')) return;
    try {
      const res = await fetch(`/api/music/${musicId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      // Stop playback if deleting currently playing track
      if (currentTrack?.id === musicId) {
        stopAllPlayback();
        setCurrentTrack(null);
      }
      fetchMusicList();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handlePlayTrack = useCallback(async (music: MusicGeneration) => {
    if (currentTrack?.id === music.id && isPlaying) {
      // Pause current track
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      globalPlayingId = null;
      notifyListeners();
      audioStopUnregisterRef.current?.();
      audioStopUnregisterRef.current = null;
    } else {
      // Stop all audio (CompactPlayer, AudioEditor, other instances)
      stopAllPlayback();
      setCurrentTime(0);
      setAudioDuration(0);

      const audio = new Audio(`/api/music/${music.id}/file`);
      audio.crossOrigin = 'anonymous';
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        setAudioDuration(audio.duration || 0);
      };

      audio.onplay = () => {
        setIsPlaying(true);
        setCurrentTrack(music);
        globalPlayingId = music.id;
        globalAudioElement = audio;
        notifyListeners();
        onSelectForPlayer?.(music);
      };

      audio.onpause = () => {
        setIsPlaying(false);
      };

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime || 0);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        globalPlayingId = null;
        notifyListeners();
        audioStopUnregisterRef.current?.();
        audioStopUnregisterRef.current = null;
      };

      // Register with shared registry so CompactPlayer/AudioEditor can stop this
      audioStopUnregisterRef.current = registerAudioStop(() => {
        audio.pause();
        audio.currentTime = 0;
        setIsPlaying(false);
        globalPlayingId = null;
        notifyListeners();
      });

      try {
        await audio.play();
      } catch (err) {
        console.error('Playback error:', err);
      }
    }
  }, [currentTrack, isPlaying]);

  const handleSeek = (time: number) => {
    // time is in seconds (matches duration unit)
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleSeekBy = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + seconds));
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    setIsMuted(v === 0);
  };

  const handleToggleMute = () => {
    if (isMuted) {
      if (audioRef.current) audioRef.current.volume = volume || 0.8;
      setIsMuted(false);
    } else {
      if (audioRef.current) audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const styles = [
    { label: 'Hip-Hop', value: 'hip-hop' },
    { label: 'Pop', value: 'pop' },
    { label: 'Rock', value: 'rock' },
    { label: 'R&B', value: 'rnb' },
    { label: 'Electronic', value: 'electronic' },
    { label: 'Jazz', value: 'jazz' },
    { label: 'Classical', value: 'classical' },
  ];

  const isProcessing = generating || !!pollingJobId;

  const handleEditTrack = (music: MusicGeneration) => {
    // Stop any currently playing audio so editor has clean slate
    if (isPlaying) {
      stopAllPlayback();
    }
    setEditingMusic(music);
    setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  return (
    <div data-testid="music-player" style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: currentTrack ? '100px' : '24px' }}>

      {/* Top Bar - Create New */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(30,30,30,0.9) 0%, rgba(20,20,20,0.95) 100%)',
        backdropFilter: 'blur(30px)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.08)',
        padding: '20px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <button
            onClick={() => setMode('generate')}
            style={{
              padding: '10px 20px', borderRadius: '10px', border: '1px solid',
              borderColor: mode === 'generate' ? '#E63946' : 'rgba(255,255,255,0.1)',
              backgroundColor: mode === 'generate' ? '#E63946' : 'transparent',
              color: mode === 'generate' ? '#fff' : '#888',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              transition: 'all 150ms',
            }}
          >
            <PlusIcon /> Create New
          </button>
          <button
            onClick={() => setMode('cover')}
            style={{
              padding: '10px 20px', borderRadius: '10px', border: '1px solid',
              borderColor: mode === 'cover' ? '#E63946' : 'rgba(255,255,255,0.1)',
              backgroundColor: mode === 'cover' ? '#E63946' : 'transparent',
              color: mode === 'cover' ? '#fff' : '#888',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              transition: 'all 150ms',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload Audio
          </button>
        </div>

        {mode === 'generate' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Style dropdown and custom prompt */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setStyleDropdownOpen(!styleDropdownOpen)}
                style={{
                  padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '13px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px',
                }}
              >
                <span style={{ color: '#888' }}>Style:</span>
                <span>{styles.find(s => s.value === selectedStyle)?.label || 'Select Style'}</span>
                <ChevronDownIcon />
              </button>
              {styleDropdownOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: '4px',
                  background: 'rgba(30,30,30,0.98)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px', overflow: 'hidden', zIndex: 100, minWidth: '200px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                }}>
                  {styles.map(s => (
                    <button
                      key={s.value}
                      onClick={() => { setSelectedStyle(selectedStyle === s.value ? '' : s.value); setStyleDropdownOpen(false); }}
                      style={{
                        width: '100%', padding: '12px 16px', border: 'none',
                        background: selectedStyle === s.value ? 'rgba(230,57,70,0.2)' : 'transparent',
                        color: selectedStyle === s.value ? '#E63946' : '#fff',
                        fontSize: '13px', cursor: 'pointer', textAlign: 'left',
                      }}
                      onMouseOver={(e) => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'}
                      onMouseOut={(e) => (e.currentTarget as HTMLButtonElement).style.background = selectedStyle === s.value ? 'rgba(230,57,70,0.2)' : 'transparent'}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Describe the music you want to create... (e.g., 'Slow lo-fi beat with ambient pads and soft drums')"
              style={{
                width: '100%', height: '60px', background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                padding: '12px 16px', color: '#fff', fontSize: '13px',
                resize: 'none', outline: 'none', fontFamily: "'DM Sans', sans-serif",
              }}
            />

            {selectedLyrics && (
              <div style={{ background: 'rgba(230,57,70,0.1)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(230,57,70,0.2)' }}>
                <span style={{ color: '#888', fontSize: '11px' }}>USING LYRICS: </span>
                <span style={{ color: '#fff', fontSize: '13px', fontWeight: 500 }}>{selectedLyrics.title || `Version ${selectedLyrics.version}`}</span>
              </div>
            )}

            {pollingJobId && (
              <div data-testid="job-status">
              <GenerationProgressIndicator
                jobId={pollingJobId}
                onCancel={handleCancelGeneration}
              />
              </div>
            )}

            <button
              onClick={generateMusic}
              disabled={isProcessing || (mode === 'generate' && !selectedLyrics)}
              style={{
                padding: '14px 24px', borderRadius: '10px', border: 'none',
                background: isProcessing || (mode === 'generate' && !selectedLyrics) ? '#555' : 'linear-gradient(135deg, #E63946 0%, #B8232E 100%)',
                color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                boxShadow: isProcessing ? 'none' : '0 4px 20px rgba(230,57,70,0.4)',
                transition: 'all 200ms',
              }}
            >
              {pollingJobId ? 'Generating...' : 'Generate Music'}
            </button>
          </div>
        )}

        {mode === 'cover' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                border: '2px dashed rgba(255,255,255,0.15)', borderRadius: '12px',
                padding: '40px', textAlign: 'center', cursor: 'pointer',
                transition: 'all 200ms',
              }}
              onClick={() => document.getElementById('cover-upload')?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUploadNew(f); }}
              onMouseOver={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(230,57,70,0.5)'}
              onMouseOut={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.15)'}
            >
              <input id="cover-upload" type="file" accept="audio/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadNew(f); }} />
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5" style={{ marginBottom: '12px' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <div style={{ color: '#888', fontSize: '14px' }}>Drop audio file here or click to upload</div>
              <div style={{ color: '#555', fontSize: '11px', marginTop: '8px' }}>MP3, WAV, FLAC, M4A (max 50MB)</div>
            </div>

            {uploadingFile && (
              <div style={{ color: '#FFB800', fontSize: '13px' }}>Uploading {uploadingFile.name}...</div>
            )}
          </div>
        )}
      </div>

      {/* Track List */}
      <div>
        <h4 style={{
          color: '#fff', fontSize: '16px', fontWeight: 600,
          fontFamily: "'Outfit', sans-serif", marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2">
            <circle cx="5.5" cy="17.5" r="2.5" /><circle cx="18.5" cy="17.5" r="2.5" />
            <path d="M15 6l-6 4-6-4" /><path d="M3 17.5v-7A2 2 0 0 1 5 8.5h11a2 2 0 0 1 2 2v7" />
          </svg>
          Your Songs
          <span style={{ color: '#555', fontSize: '12px', fontWeight: 400 }}>({musicHistory.length})</span>
        </h4>

        {musicHistory.length === 0 ? (
          <div style={{
            background: 'rgba(30,30,30,0.5)', padding: '60px 40px',
            borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center',
          }}>
            <div style={{ color: '#555', fontSize: '14px', marginBottom: '8px' }}>No songs yet</div>
            <div style={{ color: '#444', fontSize: '12px' }}>Create a new song or upload audio to get started</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {musicHistory.map(music => (
              <React.Fragment key={music.id}>
                <TrackRow
                  music={music}
                  isPlaying={isPlaying}
                  isThisPlaying={currentTrack?.id === music.id && isPlaying}
                  onPlay={() => handlePlayTrack(music)}
                  onEdit={() => handleEditTrack(music)}
                  onConvert={() => handleConvertToMp3(music.id)}
                  onDownload={() => {
                    const link = document.createElement('a');
                    link.href = `/api/music/${music.id}/file`;
                    link.download = music.title || `Version ${music.version}`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  onDelete={() => handleDeleteMusic(music.id)}
                />
                {editingMusic?.id === music.id && (
                  <div ref={editorRef}>
                    <AudioEditorInline
                      audioUrl={`/api/music/${editingMusic.id}/file`}
                      trackId={editingMusic.id}
                      onClose={() => setEditingMusic(null)}
                      onExportComplete={() => {
                        setEditingMusic(null);
                        fetchMusicList();
                      }}
                    />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Playback Bar */}
      <PlaybackBar
        music={currentTrack}
        isPlaying={isPlaying}
        onTogglePlay={() => currentTrack && handlePlayTrack(currentTrack)}
        onSeek={handleSeek}
        onSeekBy={handleSeekBy}
        onVolumeChange={handleVolumeChange}
        currentTime={currentTime}
        duration={audioDuration || (currentTrack?.duration_seconds || 0)}
        volume={volume}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />

      {error && (
        <div style={{
          position: 'fixed', bottom: '100px', right: '24px',
          background: 'rgba(230,57,70,0.95)', color: '#fff',
          padding: '16px 24px', borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(230,57,70,0.3)',
          fontSize: '13px', zIndex: 1001,
        }}>
          {error}
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: '16px', fontSize: '16px' }}>×</button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}