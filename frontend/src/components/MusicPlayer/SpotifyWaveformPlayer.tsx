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

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
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
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

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

      {/* Waveform placeholder */}
      <div
        style={{
          backgroundColor: '#282828',
          borderRadius: '4px',
          height: '80px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#B3B3B3',
          fontSize: '14px',
        }}
      >
        Waveform visualization (Task 2)
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