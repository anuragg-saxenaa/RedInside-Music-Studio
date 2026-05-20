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

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<MusicGeneration[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<MusicGeneration | null>(null);
  const [selectedLyrics, setSelectedLyrics] = useState<LyricsGeneration | null>(null);
  const [activeTab, setActiveTab] = useState<V4Tab>('sounds');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playerTrack, setPlayerTrack] = useState<MusicGeneration | null>(null);
  const [playerIsPlaying, setPlayerIsPlaying] = useState(false);
  const [playerProgress, setPlayerProgress] = useState(0);
  const [playerCurrentTime, setPlayerCurrentTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const [playerVolume, setPlayerVolumeState] = useState(0.8);
  const [isMockMode, setIsMockMode] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch('/health').then(r => r.json()).then(d => { if (d.minimax === 'mock') setIsMockMode(true); }).catch(() => {});
    refreshProjects();
    refreshPlaylists();
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
        if (list.length > 0 && !selectedTrack) setSelectedTrack(list[0]);
      })
      .catch(() => {});
  }, [activeProjectId, selectedTrack]);

  const refreshPlaylists = useCallback(() => {
    fetch('/api/playlists').then(r => r.json()).then(setPlaylists).catch(() => {});
  }, []);

  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;

  const playTrack = useCallback((track: MusicGeneration) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    const audio = new Audio(`/api/music/${track.id}/file`);
    audio.volume = playerVolume;
    audioRef.current = audio;
    audio.play().catch(() => {});
    setPlayerTrack(track);
    setPlayerIsPlaying(true);
    setPlayerProgress(0);
    setPlayerCurrentTime(0);
    audio.addEventListener('ended', () => {
      if (isLooping) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        setPlayerIsPlaying(false);
      }
    });
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
  }, [playerVolume, isLooping]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (playerIsPlaying) {
      audioRef.current.pause();
      setPlayerIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setPlayerIsPlaying(true);
    }
  }, [playerIsPlaying]);

  const seekTo = useCallback((fraction: number) => {
    if (!audioRef.current || !isFinite(audioRef.current.duration)) return;
    audioRef.current.currentTime = fraction * audioRef.current.duration;
  }, []);

  const setPlayerVolume = useCallback((v: number) => {
    setPlayerVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
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
