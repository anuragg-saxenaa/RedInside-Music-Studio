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

  return (
    <div
      style={{
        backgroundColor: '#1A1A1A',
        color: '#FFFFFF',
        borderRadius: '8px',
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        maxWidth: '600px',
        margin: '0 auto',
      }}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" onTimeUpdate={() => {}} onPlay={() => {}} onPause={() => {}} onEnded={() => {}} />

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
          {title || `Version ${version}`}
        </h2>
        <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#B3B3B3' }}>
          <span>Version {version}</span>
          {model && <span>{model}</span>}
          <span>{formatTime(durationMs)}</span>
        </div>
      </div>

      {/* Waveform */}
      <div
        className="waveform"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const percent = (e.clientX - rect.left) / rect.width;
          const newTime = percent * durationMs;
          if (audioRef.current) {
            audioRef.current.currentTime = newTime / 1000;
            setCurrentTime(newTime);
          }
        }}
        style={{ cursor: 'pointer', backgroundColor: '#282828', borderRadius: '4px', height: '80px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '2px', padding: '0 4px' }}
      >
        {waveformBars.map((height, index) => {
          const barPercent = (index / waveformBars.length) * 100;
          const isPlayed = barPercent < progressPercent;
          return (
            <div
              key={index}
              style={{
                height: `${height}%`,
                width: '2px',
                backgroundColor: isPlayed ? '#F59200' : '#333333',
                transition: 'background-color 100ms linear',
              }}
            />
          );
        })}
      </div>

      {/* Time display */}
      <div style={{ fontSize: '12px', color: '#B3B3B3', marginBottom: '16px' }}>
        <span>{formatTime(currentTime)}</span>
        <span> / </span>
        <span>{formatTime(durationMs)}</span>
      </div>

      {/* Controls placeholder */}
      <div
        style={{
          backgroundColor: '#282828',
          borderRadius: '4px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#B3B3B3',
          fontSize: '14px',
          gap: '8px',
        }}
      >
        <button onClick={togglePlay}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button onClick={toggleMute}>
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={isMuted ? 0 : volume}
          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
        />
        Playback controls (Task 3)
      </div>
    </div>
  );
}
