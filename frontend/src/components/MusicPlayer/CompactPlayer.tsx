import { useState, useRef, useEffect } from 'react';

interface CompactPlayerProps {
  musicId: string;
  version: number;
  durationMs: number;
  audioUrl: string;
  title?: string;
  model?: string;
  artworkUrl?: string;
}

const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function CompactPlayer({
  musicId: _musicId,
  version,
  durationMs,
  audioUrl,
  title,
  model,
  artworkUrl,
}: CompactPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const progressPercent = durationMs > 0 ? (currentTime / durationMs) * 100 : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime * 1000);
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
  }, []);

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

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
    }}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Artwork Thumbnail */}
      {artworkUrl ? (
        <img
          src={artworkUrl}
          alt="Artwork"
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '6px',
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      ) : (
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '6px',
          backgroundColor: '#2A2A2A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
      )}

      {/* Track Info */}
      <div style={{ flex: '0 0 180px' }}>
        <div style={{
          color: '#FFFFFF',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: 'Outfit, sans-serif',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {title || `Version ${version}`}
        </div>
        <div style={{
          color: '#666666',
          fontSize: '11px',
          marginTop: '2px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {model}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={() => seekBy(-10)}
          style={{
            background: 'none',
            border: 'none',
            color: '#A0A0A0',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Rewind 10s"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 19 2 12 11 5 11 19"/>
            <polygon points="22 19 13 12 22 5 22 19"/>
          </svg>
        </button>

        <button
          onClick={togglePlay}
          style={{
            background: '#E63946',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#FFFFFF',
          }}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16"/>
              <rect x="14" y="4" width="4" height="16"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          )}
        </button>

        <button
          onClick={() => seekBy(10)}
          style={{
            background: 'none',
            border: 'none',
            color: '#A0A0A0',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Forward 10s"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 19 22 12 13 5 13 19"/>
            <polygon points="2 19 11 12 2 5 2 19"/>
          </svg>
        </button>
      </div>

      {/* Progress */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '400px' }}>
        <span style={{
          color: '#A0A0A0',
          fontSize: '11px',
          fontFamily: 'JetBrains Mono, monospace',
          minWidth: '35px',
        }}>
          {formatTime(currentTime)}
        </span>

        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: '100%',
            height: '4px',
            backgroundColor: '#2A2A2A',
            borderRadius: '2px',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: `${progressPercent}%`,
            height: '4px',
            backgroundColor: '#E63946',
            borderRadius: '2px',
            pointerEvents: 'none',
          }} />
          <input
            type="range"
            min="0"
            max={durationMs || 100}
            step="100"
            value={currentTime}
            onChange={(e) => {
              const audio = audioRef.current;
              if (!audio) return;
              const newTime = parseInt(e.target.value);
              audio.currentTime = newTime / 1000;
              setCurrentTime(newTime);
            }}
            style={{
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '100%',
              height: '20px',
              margin: 0,
              padding: 0,
              opacity: 0,
              cursor: 'pointer',
              zIndex: 2,
            }}
          />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: `${progressPercent}%`,
            transform: 'translate(-50%, -50%)',
            width: '12px',
            height: '12px',
            backgroundColor: '#FFFFFF',
            borderRadius: '50%',
            boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
            transition: 'left 100ms linear',
          }} />
        </div>

        <span style={{
          color: '#A0A0A0',
          fontSize: '11px',
          fontFamily: 'JetBrains Mono, monospace',
          minWidth: '35px',
        }}>
          {formatTime(durationMs)}
        </span>
      </div>

      {/* Volume */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={toggleMute}
          style={{
            background: 'none',
            border: 'none',
            color: '#A0A0A0',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted || volume === 0 ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <line x1="23" y1="9" x2="17" y2="15"/>
              <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          ) : volume < 0.5 ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
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
            width: '70px',
            height: '4px',
            accentColor: '#E63946',
            cursor: 'pointer',
          }}
        />
      </div>

      {/* Download */}
      <a
        href={audioUrl}
        download
        style={{
          color: '#A0A0A0',
          textDecoration: 'none',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
        }}
        title="Download"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </a>
    </div>
  );
}