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
        backgroundColor: '#141414',
        color: '#FFFFFF',
        borderRadius: '12px',
        padding: '20px',
        fontFamily: 'DM Sans, sans-serif',
        width: '100%',
        border: '1px solid #2A2A2A',
      }}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Header */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        {/* Artwork */}
        {artworkUrl ? (
          <img
            src={artworkUrl}
            alt="Artwork"
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '8px',
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
        ) : (
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '8px',
            backgroundColor: '#2A2A2A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        )}

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px', color: '#FFFFFF', fontFamily: 'Outfit, sans-serif' }}>
            {title || `Version ${version}`}
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#A0A0A0' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', backgroundColor: '#2A2A2A', padding: '2px 6px', borderRadius: '4px' }}>v{version}</span>
            {model && <span>{model}</span>}
            <span>{formatTime(durationMs)}</span>
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
          <div style={{ marginBottom: '16px' }}>
            <input
              type="range"
              min={0}
              max={actualDuration}
              value={currentTime}
              onChange={(e) => {
                const audio = audioRef.current;
                if (!audio) return;
                const newTimeMs = parseFloat(e.target.value);
                const newTimeSec = newTimeMs / 1000;
                audio.currentTime = newTimeSec;
                setCurrentTime(newTimeMs);
              }}
              style={{
                width: '100%',
                height: '6px',
                cursor: 'pointer',
                accentColor: '#E63946',
                background: `linear-gradient(to right, #E63946 ${progressPercent}%, #3A3A3A ${progressPercent}%)`,
                borderRadius: '3px',
              }}
            />
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
            <button
              onClick={() => seekBy(-10)}
              style={{ background: 'none', border: 'none', color: '#A0A0A0', fontSize: '20px', cursor: 'pointer', padding: '8px', transition: 'color 150ms' }}
              onMouseOver={(e) => (e.currentTarget as HTMLElement).style.color = '#FFFFFF'}
              onMouseOut={(e) => (e.currentTarget as HTMLElement).style.color = '#A0A0A0'}
              title="Rewind 10s (←)"
            >
              ⏪
            </button>

            <button
              onClick={togglePlay}
              disabled={isLoading}
              style={{
                background: '#E63946',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '20px',
                cursor: isLoading ? 'wait' : 'pointer',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 150ms',
                boxShadow: '0 4px 12px rgba(230, 57, 70, 0.3)',
              }}
              onMouseOver={(e) => { if (!isLoading) (e.currentTarget as HTMLElement).style.backgroundColor = '#FF4757'; }}
              onMouseOut={(e) => { if (!isLoading) (e.currentTarget as HTMLElement).style.backgroundColor = '#E63946'; }}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isLoading ? (
                <div style={{ width: '20px', height: '20px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              ) : isPlaying ? '⏸' : '▶'}
            </button>

            <button
              onClick={() => seekBy(10)}
              style={{ background: 'none', border: 'none', color: '#A0A0A0', fontSize: '20px', cursor: 'pointer', padding: '8px', transition: 'color 150ms' }}
              onMouseOver={(e) => (e.currentTarget as HTMLElement).style.color = '#FFFFFF'}
              onMouseOut={(e) => (e.currentTarget as HTMLElement).style.color = '#A0A0A0'}
              title="Forward 10s (→)"
            >
              ⏩
            </button>
          </div>

          {/* Volume */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
            <button
              onClick={toggleMute}
              style={{ background: 'none', border: 'none', color: '#A0A0A0', fontSize: '16px', cursor: 'pointer', padding: '4px', transition: 'color 150ms' }}
              onMouseOver={(e) => (e.currentTarget as HTMLElement).style.color = '#FFFFFF'}
              onMouseOut={(e) => (e.currentTarget as HTMLElement).style.color = '#A0A0A0'}
              title="Mute (M)"
            >
              {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              style={{ width: '100px', height: '4px', cursor: 'pointer', accentColor: '#E63946' }}
            />
            <span style={{ fontSize: '11px', color: '#666666', fontFamily: 'JetBrains Mono, monospace' }}>
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