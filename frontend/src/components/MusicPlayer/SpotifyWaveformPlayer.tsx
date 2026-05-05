import { useState, useRef, useEffect } from 'react';

interface SpotifyWaveformPlayerProps {
  musicId: string;
  version: number;
  durationMs: number;
  audioUrl: string;
  title?: string;
  model?: string;
  onTimeUpdate?: (currentTime: number) => void;
}

const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const generateWaveformBars = (id: string, barCount: number = 50): number[] => {
  const seed = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const bars: number[] = [];
  for (let i = 0; i < barCount; i++) {
    const value = Math.sin(seed * (i + 1) * 0.1) * 0.5 + 0.5;
    bars.push(Math.floor(value * 50) + 20); // 20-70 height
  }
  return bars;
};

export default function SpotifyWaveformPlayer({
  musicId: _musicId,
  version,
  durationMs,
  audioUrl,
  title,
  model,
  onTimeUpdate,
}: SpotifyWaveformPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const waveformBars = generateWaveformBars(_musicId, 50);
  const progressPercent = durationMs > 0 ? (currentTime / durationMs) * 100 : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime * 1000);
      onTimeUpdate?.(audio.currentTime * 1000);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [onTimeUpdate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (audioRef.current) {
            if (isPlaying) audioRef.current.pause();
            else audioRef.current.play();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (audioRef.current) audioRef.current.currentTime -= 5;
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (audioRef.current) audioRef.current.currentTime += 5;
          break;
        case 'ArrowUp':
          e.preventDefault();
          const newVolUp = Math.min(1, volume + 0.05);
          if (audioRef.current) audioRef.current.volume = newVolUp;
          setVolume(newVolUp);
          setIsMuted(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          const newVolDown = Math.max(0, volume - 0.05);
          if (audioRef.current) audioRef.current.volume = newVolDown;
          setVolume(newVolDown);
          break;
        case 'KeyM':
          e.preventDefault();
          if (audioRef.current) {
            if (isMuted) {
              audioRef.current.volume = volume || 0.8;
              setIsMuted(false);
            } else {
              audioRef.current.volume = 0;
              setIsMuted(true);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, volume, isMuted]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
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
      audio.volume = volume || 1;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const seekBy = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime += seconds;
  };

  return (
    <div
      style={{
        backgroundColor: '#282828',
        color: '#FFFFFF',
        borderRadius: '8px',
        padding: '16px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        width: '100%',
      }}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" onLoadedData={() => setIsLoading(false)} onTimeUpdate={() => {}} onPlay={() => {}} onPause={() => {}} onEnded={() => {}} />

      {/* Header */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
          {title || `Version ${version}`}
        </div>
        <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#B3B3B3' }}>
          <span>v{version}</span>
          {model && <span>{model}</span>}
          <span>{formatTime(durationMs)}</span>
        </div>
      </div>

      {/* Waveform */}
      <div
        className="waveform"
        onClick={(e) => {
          if (isLoading) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const percent = (e.clientX - rect.left) / rect.width;
          const newTime = percent * durationMs;
          if (audioRef.current) {
            audioRef.current.currentTime = newTime / 1000;
            setCurrentTime(newTime);
          }
        }}
        style={{ cursor: isLoading ? 'default' : 'pointer', backgroundColor: '#333333', borderRadius: '4px', height: '48px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '1px', padding: '0 4px' }}
      >
        {isLoading ? (
          <>
            {Array.from({ length: 40 }).map((_, index) => (
              <div
                key={index}
                style={{
                  height: `${20 + Math.sin(index * 0.3) * 15}%`,
                  flex: 1,
                  minWidth: '3px',
                  maxWidth: '4px',
                  backgroundColor: '#555555',
                  animation: 'pulse 1.5s ease-in-out infinite',
                  animationDelay: `${index * 30}ms`,
                }}
              />
            ))}
          </>
        ) : (
          waveformBars.map((height, index) => {
            const barPercent = (index / waveformBars.length) * 100;
            const isPlayed = barPercent < progressPercent;
            return (
              <div
                key={index}
                style={{
                  height: `${height}%`,
                  flex: 1,
                  minWidth: '3px',
                  maxWidth: '4px',
                  backgroundColor: isPlayed ? '#E63946' : '#4a4a4a',
                  transition: 'background-color 100ms linear',
                }}
              />
            );
          })
        )}
      </div>

      {/* Time display */}
      <div style={{ fontSize: '11px', color: '#B3B3B3', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(durationMs)}</span>
      </div>

      {/* Controls */}
      <div className="controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => seekBy(-10)} style={{ background: 'none', border: 'none', color: '#E8E8E8', fontSize: 16, cursor: 'pointer', padding: 4 }}>⏪</button>
          <button onClick={togglePlay} style={{ background: '#E63946', border: 'none', color: '#000', fontSize: 18, cursor: 'pointer', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{isPlaying ? '⏸' : '▶'}</button>
          <button onClick={() => seekBy(10)} style={{ background: 'none', border: 'none', color: '#E8E8E8', fontSize: 16, cursor: 'pointer', padding: 4 }}>⏩</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={toggleMute} style={{ background: 'none', border: 'none', color: '#E8E8E8', fontSize: 14, cursor: 'pointer', padding: 4 }}>{isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}</button>
          <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={(e) => handleVolumeChange(parseFloat(e.target.value))} style={{ width: 60, height: 4, cursor: 'pointer' }} />
        </div>
      </div>

      {/* Download Options */}
      <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
        <a
          href={`/api/music/${_musicId}/file`}
          download
          style={{ color: '#1DB954', textDecoration: 'none', fontSize: 12, fontWeight: 500 }}
        >
          Download MP3
        </a>
        {version > 1 && (
          <span style={{ color: '#666', fontSize: 11 }}>
            • 320kbps
          </span>
        )}
      </div>
    </div>
  );
}
