import { useState, useRef, useEffect, useCallback } from 'react';
import { registerAudioStop, stopAllRegisteredAudio } from '../../utils/audioControl';

interface CompactPlayerProps {
  musicId: string;
  version: number;
  durationMs: number;
  audioUrl: string;
  title?: string;
  model?: string;
  artworkUrl?: string;
  isActive?: boolean;
  onActivate?: () => void;
}

const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// SVG Icons - proper vector icons, no emoji
const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5,3 19,12 5,21" />
  </svg>
);

const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);

const SkipBackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="19,20 9,12 19,4" />
    <line x1="5" y1="19" x2="5" y2="5" />
  </svg>
);

const SkipForwardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="5,4 15,12 5,20" />
    <line x1="19" y1="4" x2="19" y2="20" />
  </svg>
);

const VolumeIcon = ({ muted }: { muted: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
    {!muted && <path d="M15.54,8.46 a5,5,0,0,1 0,7.07" />}
    {!muted && <path d="M19.07,4.93 a10,10,0,0,1 0,14.14" />}
    {muted && <line x1="23" y1="9" x2="17" y2="15" />}
    {muted && <line x1="17" y1="9" x2="23" y2="15" />}
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21,15 v4a2,2,0,0,1 -2,2 H5 a2,2,0,0,1 -2,-2 v-4" />
    <polyline points="7,10 12,15 17,10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

// Per-component playback state (tracks which CompactPlayer instance is active)
let globalPlayingId: string | null = null;
let globalAudioElement: HTMLAudioElement | null = null;
const listeners = new Set<(playingId: string | null) => void>();

function notifyListeners() {
  listeners.forEach(l => l(globalPlayingId));
}

export function stopAllPlayback() {
  // Stop the tracked CompactPlayer audio
  if (globalAudioElement) {
    globalAudioElement.pause();
    globalAudioElement.currentTime = 0;
  }
  globalPlayingId = null;
  notifyListeners();
  // Also stop all other audio systems (MusicPlayer, AudioEditor, etc.)
  stopAllRegisteredAudio();
}

export function subscribeToPlaybackState(callback: (playingId: string | null) => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export default function CompactPlayer({
  musicId,
  version,
  durationMs,
  audioUrl,
  title,
  model,
  artworkUrl,
  isActive = false,
  onActivate,
}: CompactPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Subscribe to global playback state
  useEffect(() => {
    const unsubscribe = subscribeToPlaybackState((playingId) => {
      if (playingId !== musicId && isPlaying) {
        setIsPlaying(false);
      }
    });
    return () => { unsubscribe(); };
  }, [musicId, isPlaying]);

  // Sync playing state with global state
  useEffect(() => {
    if (globalPlayingId === musicId && !isPlaying && audioRef.current) {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else if (globalPlayingId !== musicId && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
  }, [musicId]);

  const progressPercent = durationMs > 0 ? (currentTime / durationMs) * 100 : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime * 1000);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      globalPlayingId = null;
      notifyListeners();
    };

    const handlePlay = () => {
      setIsPlaying(true);
      globalPlayingId = musicId;
      globalAudioElement = audio;
      notifyListeners();
    };

    const handlePause = () => {
      // Only update if this is the global playing audio
      if (globalPlayingId === musicId) {
        setIsPlaying(false);
      }
    };

    const handleLoaded = () => setIsLoading(false);
    const handleWaiting = () => setIsLoading(true);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('loadeddata', handleLoaded);
    audio.addEventListener('waiting', handleWaiting);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('loadeddata', handleLoaded);
      audio.removeEventListener('waiting', handleWaiting);
    };
  }, [musicId, isDragging]);

  const stopFnRef = useRef<(() => void) | null>(null);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
        globalPlayingId = null;
        notifyListeners();
        stopFnRef.current?.();
        stopFnRef.current = null;
      } else {
        // Stop all other audio (MusicPlayer, other CompactPlayers, AudioEditor)
        stopAllRegisteredAudio();
        stopAllPlayback();

        // Register this player's stop callback
        const unregister = registerAudioStop(() => {
          audio.pause();
          audio.currentTime = 0;
          setIsPlaying(false);
          globalPlayingId = null;
          notifyListeners();
        });
        stopFnRef.current = unregister;

        audio.currentTime = currentTime / 1000;
        await audio.play();
        setIsPlaying(true);
        globalPlayingId = musicId;
        globalAudioElement = audio;
        notifyListeners();
      }
    } catch (err) {
      console.error('Playback error:', err);
    }
  }, [isPlaying, currentTime, musicId]);

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
    const newTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
    audio.currentTime = newTime;
    setCurrentTime(newTime * 1000);
  };

  const handleProgressClick = (e: React.MouseEvent) => {
    if (!progressRef.current || !audioRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = percent * (durationMs / 1000);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime * 1000);
  };

  // Determine if this player is the active one
  const isThisPlaying = isPlaying && globalPlayingId === musicId;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '12px 16px',
        background: isThisPlaying
          ? 'linear-gradient(135deg, rgba(230, 57, 70, 0.15) 0%, rgba(230, 57, 70, 0.05) 100%)'
          : 'linear-gradient(135deg, rgba(30, 30, 30, 0.9) 0%, rgba(20, 20, 20, 0.9) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '16px',
        border: isThisPlaying
          ? '1px solid rgba(230, 57, 70, 0.4)'
          : '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: isThisPlaying
          ? '0 4px 30px rgba(230, 57, 70, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          : '0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        transition: 'all 300ms ease',
        opacity: isLoading ? 0.7 : 1,
      }}
      onClick={onActivate}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Artwork - glass effect */}
      <div style={{
        width: '52px',
        height: '52px',
        borderRadius: '10px',
        background: 'linear-gradient(145deg, #2a2a2a 0%, #1a1a1a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.05)',
      }}>
        {artworkUrl ? (
          <img
            src={artworkUrl}
            alt="Artwork"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M9 9 a4 4 0 1 0 6 3" strokeLinecap="round" />
          </svg>
        )}
      </div>

      {/* Track Info */}
      <div style={{ flex: '0 0 160px', minWidth: 0 }}>
        <div style={{
          color: '#FFFFFF',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: "'Outfit', sans-serif",
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }}>
          {title || `Version ${version}`}
        </div>
        <div style={{
          color: isThisPlaying ? '#E63946' : '#777',
          fontSize: '10px',
          marginTop: '2px',
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
        }}>
          {model || 'unknown'}
          {isThisPlaying && (
            <span style={{ marginLeft: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: '#E63946', boxShadow: '0 0 8px #E63946',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
              PLAYING
            </span>
          )}
        </div>
      </div>

      {/* Controls - glass buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={(e) => { e.stopPropagation(); seekBy(-10); }}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#AAA',
            transition: 'all 150ms ease',
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)';
            (e.currentTarget as HTMLButtonElement).style.color = '#FFF';
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
            (e.currentTarget as HTMLButtonElement).style.color = '#AAA';
          }}
          title="Rewind 10s"
        >
          <SkipBackIcon />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          style={{
            background: isThisPlaying
              ? 'linear-gradient(135deg, #E63946 0%, #B8232E 100%)'
              : 'linear-gradient(135deg, #333 0%, #222 100%)',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#FFFFFF',
            boxShadow: isThisPlaying
              ? '0 4px 20px rgba(230, 57, 70, 0.5), inset 0 1px 0 rgba(255,255,255,0.2)'
              : '0 2px 10px rgba(0,0,0,0.3)',
            transition: 'all 200ms ease',
            transform: isThisPlaying ? 'scale(1.05)' : 'scale(1)',
          }}
          title={isThisPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <div style={{
              width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#FFF', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          ) : isThisPlaying ? (
            <PauseIcon />
          ) : (
            <PlayIcon />
          )}
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); seekBy(10); }}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#AAA',
            transition: 'all 150ms ease',
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)';
            (e.currentTarget as HTMLButtonElement).style.color = '#FFF';
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
            (e.currentTarget as HTMLButtonElement).style.color = '#AAA';
          }}
          title="Forward 10s"
        >
          <SkipForwardIcon />
        </button>
      </div>

      {/* Progress */}
      <div
        style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <span style={{
          color: '#888',
          fontSize: '11px',
          fontFamily: "'JetBrains Mono', monospace",
          minWidth: '38px',
          textAlign: 'right',
        }}>
          {formatTime(currentTime)}
        </span>

        <div
          ref={progressRef}
          onClick={(e) => { e.stopPropagation(); handleProgressClick(e); }}
          style={{
          flex: 1,
          position: 'relative',
          height: '6px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '3px',
          cursor: 'pointer',
          overflow: 'visible',
        }}>
          {/* Progress fill */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: `${progressPercent}%`,
            height: '100%',
            background: isThisPlaying
              ? 'linear-gradient(90deg, #E63946 0%, #FF6B6B 100%)'
              : 'linear-gradient(90deg, #666 0%, #888 100%)',
            borderRadius: '3px',
            transition: isDragging ? 'none' : 'width 100ms linear',
          }} />

          {/* Thumb */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: `${progressPercent}%`,
            transform: 'translate(-50%, -50%)',
            width: isThisPlaying ? '14px' : '0px',
            height: isThisPlaying ? '14px' : '0px',
            background: '#FFF',
            borderRadius: '50%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            transition: 'all 200ms ease',
            opacity: isThisPlaying ? 1 : 0,
          }} />
        </div>

        <span style={{
          color: '#888',
          fontSize: '11px',
          fontFamily: "'JetBrains Mono', monospace",
          minWidth: '38px',
        }}>
          {formatTime(durationMs)}
        </span>
      </div>

      {/* Volume */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          onClick={(e) => { e.stopPropagation(); toggleMute(); }}
          style={{
            background: 'none',
            border: 'none',
            color: isMuted ? '#E63946' : '#888',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            transition: 'color 150ms',
          }}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          <VolumeIcon muted={isMuted} />
        </button>

        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={isMuted ? 0 : volume}
          onChange={(e) => { e.stopPropagation(); handleVolumeChange(parseFloat(e.target.value)); }}
          style={{
            width: '60px',
            height: '4px',
            accentColor: '#E63946',
            cursor: 'pointer',
            background: `linear-gradient(90deg, #E63946 ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%)`,
          }}
        />
      </div>

      {/* Download */}
      <a
        href={audioUrl}
        download
        onClick={(e) => e.stopPropagation()}
        style={{
          color: '#888',
          textDecoration: 'none',
          padding: '6px',
          display: 'flex',
          alignItems: 'center',
          borderRadius: '6px',
          transition: 'all 150ms',
        }}
        title="Download"
        onMouseOver={(e) => (e.currentTarget as HTMLAnchorElement).style.color = '#E63946'}
        onMouseOut={(e) => (e.currentTarget as HTMLAnchorElement).style.color = '#888'}
      >
        <DownloadIcon />
      </a>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          border-radius: 3px;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          background: #FFF;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
}