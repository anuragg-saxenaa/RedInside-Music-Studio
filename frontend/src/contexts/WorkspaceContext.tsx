import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import type { Project, MusicGeneration, LyricsGeneration, Playlist, V4Tab } from '../types';

interface WorkspaceContextType {
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  setActiveProjectId: (id: string | null) => void;
  refreshProjects: () => void;

  tracks: MusicGeneration[];
  selectedTrack: MusicGeneration | null;
  setSelectedTrack: (t: MusicGeneration | null) => void;
  refreshTracks: () => void;

  selectedLyrics: LyricsGeneration | null;
  setSelectedLyrics: (l: LyricsGeneration | null) => void;

  activeTab: V4Tab;
  setActiveTab: (tab: V4Tab) => void;

  playlists: Playlist[];
  refreshPlaylists: () => void;

  playerTrack: MusicGeneration | null;
  playerIsPlaying: boolean;
  playerProgress: number;
  playerCurrentTime: number;
  playerDuration: number;
  playerVolume: number;
  playTrack: (track: MusicGeneration) => void;
  togglePlay: () => void;
  seekTo: (fraction: number) => void;
  setPlayerVolume: (v: number) => void;
  playNext: () => void;
  playPrev: () => void;

  isLooping: boolean;
  isShuffled: boolean;
  toggleLoop: () => void;
  toggleShuffle: () => void;

  isMockMode: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

const PERSIST_KEY = 'ris_player_track';

// Module-level — persists across provider remounts (e.g. navigating away then back to Studio)
let persistentAudio: HTMLAudioElement | null = null;
let persistentTrack: MusicGeneration | null = null;

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<MusicGeneration[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<MusicGeneration | null>(null);
  const [selectedLyrics, setSelectedLyrics] = useState<LyricsGeneration | null>(null);
  const [activeTab, setActiveTab] = useState<V4Tab>('sounds');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playerTrack, setPlayerTrack] = useState<MusicGeneration | null>(persistentTrack);
  const [playerIsPlaying, setPlayerIsPlaying] = useState(false);
  const [playerProgress, setPlayerProgress] = useState(0);
  const [playerCurrentTime, setPlayerCurrentTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const [playerVolume, setPlayerVolumeState] = useState(0.8);
  const [isMockMode, setIsMockMode] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(persistentAudio);

  // Mount: restore state from persistent audio if it was playing
  useEffect(() => {
    fetch('/health').then(r => r.json()).then(d => { if (d.minimax === 'mock') setIsMockMode(true); }).catch(() => {});
    refreshProjects();
    refreshPlaylists();

    if (persistentAudio) {
      setPlayerTrack(persistentTrack);
      setPlayerIsPlaying(!persistentAudio.paused && !persistentAudio.ended);
      if (persistentAudio.duration && isFinite(persistentAudio.duration)) {
        setPlayerProgress(persistentAudio.currentTime / persistentAudio.duration);
        setPlayerCurrentTime(persistentAudio.currentTime);
        setPlayerDuration(persistentAudio.duration);
      }
    } else {
      // Full page refresh — restore from localStorage
      try {
        const saved = localStorage.getItem(PERSIST_KEY);
        if (saved) {
          const track: MusicGeneration = JSON.parse(saved);
          persistentTrack = track;
          const audio = new Audio(`/api/music/${track.id}/file`);
          persistentAudio = audio;
          audioRef.current = audio;
          audio.volume = playerVolume;
          setPlayerTrack(track);
          setPlayerIsPlaying(true);
          audio.addEventListener('timeupdate', () => {
            if (audio.duration && isFinite(audio.duration)) {
              setPlayerProgress(audio.currentTime / audio.duration);
              setPlayerCurrentTime(audio.currentTime);
              setPlayerDuration(audio.duration);
            }
          });
          audio.addEventListener('loadedmetadata', () => {
            if (isFinite(audio.duration)) setPlayerDuration(audio.duration);
          });
          audio.addEventListener('ended', () => {
            if (isLooping) {
              audio.currentTime = 0;
              audio.play().catch(() => {});
            } else {
              setPlayerIsPlaying(false);
            }
          });
          audio.play().catch(() => {});
        }
      } catch (_) { /* ignore corrupt localStorage */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeProjectId) refreshTracks();
    else setTracks([]);
  }, [activeProjectId]);

  const refreshProjects = useCallback(() => {
    fetch('/api/projects').then(r => r.json()).then(setProjects).catch(() => {});
  }, []);

  const refreshTracks = useCallback(() => {
    if (!activeProjectId) return;
    fetch(`/api/projects/${activeProjectId}/music`)
      .then(r => r.json())
      .then((list: MusicGeneration[]) => {
        setTracks(list);
        if (selectedTrack) {
          const updated = list.find(t => t.id === selectedTrack.id);
          if (updated) setSelectedTrack(updated);
        }
        if (playerTrack) {
          const updated = list.find(t => t.id === playerTrack.id);
          if (updated) setPlayerTrack(updated);
        }
        if (list.length > 0 && !selectedTrack) setSelectedTrack(list[0]);
      })
      .catch(() => {});
  }, [activeProjectId, selectedTrack, playerTrack]);

  const refreshPlaylists = useCallback(() => {
    fetch('/api/playlists').then(r => r.json()).then(setPlaylists).catch(() => {});
  }, []);

  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;

  const playTrack = useCallback((track: MusicGeneration) => {
    if (persistentAudio) {
      persistentAudio.pause();
      persistentAudio.src = '';
    }
    const audio = new Audio(`/api/music/${track.id}/file`);
    audio.volume = playerVolume;
    persistentAudio = audio;
    audioRef.current = audio;
    persistentTrack = track;
    try { localStorage.setItem(PERSIST_KEY, JSON.stringify(track)); } catch (_) { /* quota */ }
    audio.play().catch(() => {});
    setPlayerTrack(track);
    setPlayerIsPlaying(true);
    setPlayerProgress(0);
    setPlayerCurrentTime(0);

    const updateTime = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setPlayerProgress(audio.currentTime / audio.duration);
        setPlayerCurrentTime(audio.currentTime);
        setPlayerDuration(audio.duration);
      }
    };
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateTime);
    audio.addEventListener('ended', () => {
      if (isLooping) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        setPlayerIsPlaying(false);
      }
    });
  }, [playerVolume, isLooping]);

  const togglePlay = useCallback(() => {
    if (!persistentAudio) return;
    if (playerIsPlaying) {
      persistentAudio.pause();
      setPlayerIsPlaying(false);
    } else {
      persistentAudio.play().catch(() => {});
      setPlayerIsPlaying(true);
    }
  }, [playerIsPlaying]);

  const seekTo = useCallback((fraction: number) => {
    if (!persistentAudio || !isFinite(persistentAudio.duration)) return;
    persistentAudio.currentTime = fraction * persistentAudio.duration;
  }, []);

  const setPlayerVolume = useCallback((v: number) => {
    setPlayerVolumeState(v);
    if (persistentAudio) persistentAudio.volume = v;
  }, []);

  const playNext = useCallback(() => {
    if (!playerTrack || tracks.length === 0) return;
    if (isShuffled && tracks.length > 1) {
      const others = tracks.filter(t => t.id !== playerTrack.id);
      const next = others[Math.floor(Math.random() * others.length)];
      playTrack(next);
      return;
    }
    const idx = tracks.findIndex(t => t.id === playerTrack.id);
    const isLast = idx === tracks.length - 1;
    if (isLast && !isLooping) return;
    const next = tracks[(idx + 1) % tracks.length];
    playTrack(next);
  }, [playerTrack, tracks, isShuffled, isLooping, playTrack]);

  const playPrev = useCallback(() => {
    if (!playerTrack || tracks.length === 0) return;
    const idx = tracks.findIndex(t => t.id === playerTrack.id);
    const prev = tracks[(idx - 1 + tracks.length) % tracks.length];
    playTrack(prev);
  }, [playerTrack, tracks, playTrack]);

  const toggleLoop = useCallback(() => setIsLooping(v => !v), []);
  const toggleShuffle = useCallback(() => setIsShuffled(v => !v), []);

  return (
    <WorkspaceContext.Provider value={{
      projects, activeProjectId, activeProject, setActiveProjectId, refreshProjects,
      tracks, selectedTrack, setSelectedTrack, refreshTracks,
      selectedLyrics, setSelectedLyrics,
      activeTab, setActiveTab,
      playlists, refreshPlaylists,
      playerTrack, playerIsPlaying, playerProgress, playerCurrentTime, playerDuration, playerVolume,
      playTrack, togglePlay, seekTo, setPlayerVolume, playNext, playPrev,
      isLooping, isShuffled, toggleLoop, toggleShuffle,
      isMockMode,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextType {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}
