import { useState, useRef, useEffect, useCallback } from 'react';

interface SpotifyWaveformPlayerProps {
  musicId: string;
  version: number;
  durationMs: number;
  audioUrl: string;
  title?: string;
  model?: string;
  artworkUrl?: string;
  onTimeUpdate?: (currentTime: number) => void;
}

const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function SpotifyWaveformPlayer({
  musicId: _musicId,
  version,
  durationMs,
  audioUrl,
  title,
  model,
  artworkUrl,
  onTimeUpdate,
}: SpotifyWaveformPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [audioError, setAudioError] = useState(false);
  const [actualDuration, setActualDuration] = useState(durationMs);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);

  const progressPercent = actualDuration > 0 ? (currentTime / actualDuration) * 100 : 0;

  // Inject seek slider CSS once
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .seek-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        background: #E63946;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 0 10px rgba(230, 57, 70, 0.7);
        border: 3px solid #fff;
      }
      .seek-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        background: #E63946;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 0 10px rgba(230, 57, 70, 0.7);
        border: 3px solid #fff;
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // Fetch and decode audio for real waveform peaks
  useEffect(() => {
    let cancelled = false;

    const fetchAudio = async () => {
      try {
        const response = await fetch(audioUrl);
        if (!response.ok) return;

        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        if (cancelled) {
          audioContext.close();
          return;
        }

        // Downsample to peaks for waveform display
        const channelData = audioBuffer.getChannelData(0);
        const samplesPerPeak = Math.max(1, Math.floor(channelData.length / 50));
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

        setWaveformPeaks(normalizedPeaks);
        audioContext.close();
      } catch (err) {
        console.error('Failed to decode audio for waveform:', err);
      }
    };

    fetchAudio();

    return () => {
      cancelled = true;
      audioContextRef.current?.close();
    };
  }, [audioUrl]);

  // Real time update loop using requestAnimationFrame
  const updateTime = useCallback(() => {
    if (audioRef.current && isPlaying) {
      const timeMs = audioRef.current.currentTime * 1000;
      setCurrentTime(timeMs);
      onTimeUpdate?.(timeMs);
      animationRef.current = requestAnimationFrame(updateTime);
    }
  }, [isPlaying, onTimeUpdate]);

  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(updateTime);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, updateTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      // Already handled by animation frame
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleLoadedMetadata = () => {
      setIsLoading(false);
      setAudioError(false);
      if (audioRef.current) {
        setActualDuration(audioRef.current.duration * 1000);
      }
    };
    const handleError = () => {
      setIsLoading(false);
      setAudioError(true);
    };
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekBy(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekBy(5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          adjustVolume(0.05);
          break;
        case 'ArrowDown':
          e.preventDefault();
          adjustVolume(-0.05);
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, volume, isMuted]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (audio.paused) {
        // Find currently playing audio and transfer position before pausing
        const playingAudio = document.querySelector('audio:not([paused])') as HTMLAudioElement | null;
        const currentPosition = playingAudio ? playingAudio.currentTime : 0;

        // Pause all other audio elements on the page
        document.querySelectorAll('audio').forEach(a => {
          if (a !== audio) a.pause();
        });

        // Transfer position from playing audio to this one
        audio.currentTime = currentPosition;
        await audio.play();
        setIsPlaying(true);
      } else {
        await audio.pause();
        setIsPlaying(false);
      }
    } catch (err) {
      console.error('Playback error:', err);
    }
  };

  const adjustVolume = (delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newVol = Math.max(0, Math.min(1, volume + delta));
    audio.volume = newVol;
    setVolume(newVol);
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
      audio.volume = newVol;
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    setVolume(newVolume);
    audio.volume = newVolume;
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume || 0.8;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const seekBy = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
    setCurrentTime(audio.currentTime * 1000);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || isLoading || audioError || !audio.duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * audio.duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime * 1000);
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1A1A1A 0%, #141414 50%, #0D0D0D 100%)',
        color: '#FFFFFF',
        borderRadius: '16px',
        padding: '24px',
        fontFamily: 'DM Sans, sans-serif',
        width: '100%',
        border: '1px solid rgba(230, 57, 70, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow effect */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        background: 'radial-gradient(circle at 30% 50%, rgba(230, 57, 70, 0.08) 0%, transparent 50%)',
        pointerEvents: 'none',
      }}/>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
        {/* Artwork with glow */}
        {artworkUrl ? (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <img
              src={artworkUrl}
              alt="Artwork"
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '12px',
                objectFit: 'cover',
                flexShrink: 0,
                boxShadow: '0 4px 20px rgba(230, 57, 70, 0.3)',
              }}
            />
            <div style={{
              position: 'absolute',
              inset: '-2px',
              borderRadius: '14px',
              border: '2px solid rgba(230, 57, 70, 0.5)',
              boxShadow: '0 0 15px rgba(230, 57, 70, 0.3)',
            }}/>
          </div>
        ) : (
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #2A2A2A 0%, #1E1E1E 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: '1px solid rgba(230, 57, 70, 0.3)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="1.5" opacity="0.6">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        )}

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px', color: '#FFFFFF', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.3px' }}>
            {title || `Version ${version}`}
          </div>
          <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: '#A0A0A0' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', backgroundColor: 'rgba(230, 57, 70, 0.15)', color: '#E63946', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
              v{version}
            </span>
            {model && <span style={{ padding: '3px 8px', backgroundColor: '#2A2A2A', borderRadius: '4px' }}>{model}</span>}
            <span style={{ padding: '3px 8px', backgroundColor: '#2A2A2A', borderRadius: '4px', fontFamily: 'JetBrains Mono, monospace' }}>{formatTime(durationMs)}</span>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && !audioError && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#A0A0A0', fontSize: '13px' }}>
          <div style={{ width: '24px', height: '24px', border: '2px solid #2A2A2A', borderTopColor: '#E63946', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
          Loading audio...
        </div>
      )}

      {/* Error State */}
      {audioError && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#E63946', fontSize: '13px' }}>
          Failed to load audio
        </div>
      )}

      {/* Waveform - always visible, plays/pauses with state */}
      {!audioError && (
        <>
          <div
            onClick={handleSeek}
            style={{
              cursor: isLoading ? 'wait' : 'pointer',
              backgroundColor: '#1E1E1E',
              borderRadius: '8px',
              height: '56px',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              padding: '0 6px',
            }}
          >
            {waveformPeaks.map((peak, index) => {
              const barPercent = (index / waveformPeaks.length) * 100;
              const isPlayed = barPercent < progressPercent;
              const barHeight = Math.max(4, peak * 50 + 4); // min 4px, max ~54px
              return (
                <div
                  key={index}
                  style={{
                    height: `${barHeight}px`,
                    flex: 1,
                    minWidth: '3px',
                    maxWidth: '5px',
                    backgroundColor: isPlayed ? '#E63946' : '#3A3A3A',
                    transition: 'background-color 80ms linear',
                    borderRadius: '2px',
                  }}
                />
              );
            })}
          </div>

          {/* Time display */}
          <div style={{ fontSize: '12px', color: '#A0A0A0', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', fontFamily: 'JetBrains Mono, monospace' }}>
            <span style={{ color: isPlaying ? '#E63946' : '#A0A0A0' }}>{formatTime(currentTime)}</span>
            <span>{formatTime(actualDuration)}</span>
          </div>

          {/* Seek Slider */}
          <div style={{ marginBottom: '16px', padding: '0 4px' }}>
            <input
              type="range"
              min={0}
              max={1000}
              value={currentTime > 0 && actualDuration > 0 ? (currentTime / actualDuration) * 1000 : 0}
              onChange={(e) => {
                const audio = audioRef.current;
                if (!audio || !actualDuration) return;
                const percent = parseFloat(e.target.value) / 1000;
                const newTimeSec = percent * actualDuration / 1000;
                audio.currentTime = newTimeSec;
                setCurrentTime(percent * actualDuration);
              }}
              style={{
                width: '100%',
                height: '6px',
                cursor: 'pointer',
                accentColor: '#E63946',
                background: `linear-gradient(to right, #E63946 ${progressPercent}%, rgba(255, 255, 255, 0.12) ${progressPercent}%)`,
                borderRadius: '3px',
                outline: 'none',
                WebkitAppearance: 'none',
              }}
              className="seek-slider"
            />
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px' }}>
            <button
              onClick={() => seekBy(-10)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#A0A0A0',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '12px',
                borderRadius: '12px',
                transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                (e.currentTarget as HTMLElement).style.color = '#FFFFFF';
                (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                (e.currentTarget as HTMLElement).style.color = '#A0A0A0';
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              }}
              title="Rewind 10s (←)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 19 2 12 11 5 11 19"/>
                <polygon points="22 19 13 12 22 5 22 19"/>
              </svg>
            </button>

            <button
              onClick={togglePlay}
              disabled={isLoading}
              style={{
                background: 'linear-gradient(135deg, #E63946 0%, #D62839 100%)',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '18px',
                cursor: isLoading ? 'wait' : 'pointer',
                borderRadius: '50%',
                width: '56px',
                height: '56px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 4px 20px rgba(230, 57, 70, 0.4), 0 0 0 0 rgba(230, 57, 70, 0.3)',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseOver={(e) => {
                if (!isLoading) {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 28px rgba(230, 57, 70, 0.5), 0 0 0 4px rgba(230, 57, 70, 0.15)';
                }
              }}
              onMouseOut={(e) => {
                if (!isLoading) {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(230, 57, 70, 0.4), 0 0 0 0 rgba(230, 57, 70, 0.3)';
                }
              }}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isLoading ? (
                <div style={{ width: '22px', height: '22px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              ) : isPlaying ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1"/>
                  <rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '2px' }}>
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              )}
            </button>

            <button
              onClick={() => seekBy(10)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#A0A0A0',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '12px',
                borderRadius: '12px',
                transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                (e.currentTarget as HTMLElement).style.color = '#FFFFFF';
                (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                (e.currentTarget as HTMLElement).style.color = '#A0A0A0';
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              }}
              title="Forward 10s (→)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 19 22 12 13 5 13 19"/>
                <polygon points="2 19 11 12 2 5 2 19"/>
              </svg>
            </button>
          </div>

          {/* Volume */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '20px', padding: '16px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}>
            <button
              onClick={toggleMute}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#A0A0A0',
                fontSize: '14px',
                cursor: 'pointer',
                padding: '10px',
                borderRadius: '10px',
                transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                (e.currentTarget as HTMLElement).style.color = '#FFFFFF';
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                (e.currentTarget as HTMLElement).style.color = '#A0A0A0';
              }}
              title="Mute (M)"
            >
              {isMuted || volume === 0 ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
                </svg>
              ) : volume < 0.5 ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              style={{
                width: '120px',
                height: '4px',
                cursor: 'pointer',
                accentColor: '#E63946',
                background: `linear-gradient(to right, #E63946 ${(isMuted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.15) ${(isMuted ? 0 : volume) * 100}%)`,
                borderRadius: '2px',
              }}
            />
            <span style={{ fontSize: '11px', color: '#666666', fontFamily: 'JetBrains Mono, monospace', minWidth: '36px', textAlign: 'right' }}>
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}