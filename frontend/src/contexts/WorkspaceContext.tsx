import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { Project, MusicGeneration, LyricsGeneration, Playlist, V4Tab } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
// Prefix relative /api/ URLs so <img src> works on cloud (not just fetch calls)
function prefixApiUrls(track: MusicGeneration): MusicGeneration {
  if (!API_BASE) return track;
  const fix = (u?: string) => (u && u.startsWith('/api') ? API_BASE + u : u);
  return { ...track, artwork_url: fix(track.artwork_url) };
}

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
const UI_STATE_KEY = 'ris_ui_state';
type PersistedPlayer = { track: MusicGeneration; currentTime: number };
type UiState = { activeTab: V4Tab; activeProjectId: string | null; selectedTrackId: string | null };

// Module-level — persists across provider remounts (e.g. navigating away then back to Studio)
let persistentAudio: HTMLAudioElement | null = null;
let persistentTrack: MusicGeneration | null = null;

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();

  const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = await getToken();
    const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
    return fetch(fullUrl, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }, [getToken]);

  // Read persisted UI state synchronously at render time
  const savedUiState = (() => {
    try { const s = localStorage.getItem(UI_STATE_KEY); return s ? (JSON.parse(s) as UiState) : null; } catch (_) { return null; }
  })();

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(savedUiState?.activeProjectId ?? null);
  const [tracks, setTracks] = useState<MusicGeneration[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<MusicGeneration | null>(null);
  const [selectedLyrics, setSelectedLyrics] = useState<LyricsGeneration | null>(null);
  const [activeTab, setActiveTab] = useState<V4Tab>((savedUiState?.activeTab as V4Tab) ?? 'sounds');
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
  // Refs so ended handlers always read current values (stale closure prevention)
  const isLoopingRef = useRef(false);
  const isShuffledRef = useRef(false);
  const playNextRef = useRef<() => void>(() => {});

  // Persist UI state to localStorage
  const persistUi = useCallback((tab: V4Tab, projId: string | null, trackId: string | null) => {
    try { localStorage.setItem(UI_STATE_KEY, JSON.stringify({ activeTab: tab, activeProjectId: projId, selectedTrackId: trackId })); } catch (_) { /* quota */ }
  }, []);

  // Wrapped setters that persist
  const setActiveProjectIdWrapped = useCallback((id: string | null) => {
    setActiveProjectId(id);
    persistUi(activeTab, id, selectedTrack?.id ?? null);
  }, [activeTab, selectedTrack, persistUi]);

  const setActiveTabWrapped = useCallback((tab: V4Tab) => {
    setActiveTab(tab);
    persistUi(tab, activeProjectId, selectedTrack?.id ?? null);
  }, [activeProjectId, selectedTrack, persistUi]);

  const setSelectedTrackWrapped = useCallback((t: MusicGeneration | null) => {
    setSelectedTrack(t);
    persistUi(activeTab, activeProjectId, t?.id ?? null);
  }, [activeTab, activeProjectId, persistUi]);

  // Mount: restore all persisted state
  useEffect(() => {
    authFetch('/health').then(r => r.json()).then(d => { if (d.minimax === 'mock') setIsMockMode(true); }).catch(() => {});
    authFetch('/api/playlists').then(r => r.json()).then(setPlaylists).catch(() => {});

    if (persistentAudio) {
      // In-session navigation: audio already playing
      setPlayerTrack(persistentTrack);
      setPlayerIsPlaying(!persistentAudio.paused && !persistentAudio.ended);
      if (persistentAudio.duration && isFinite(persistentAudio.duration)) {
        setPlayerProgress(persistentAudio.currentTime / persistentAudio.duration);
        setPlayerCurrentTime(persistentAudio.currentTime);
        setPlayerDuration(persistentAudio.duration);
      }
    } else {
      // Full page refresh — restore audio from localStorage
      try {
        const raw = localStorage.getItem(PERSIST_KEY);
        if (raw) {
          const { track, currentTime }: PersistedPlayer = JSON.parse(raw);
          persistentTrack = track;
          const audio = new Audio(`${API_BASE}/api/music/${track.id}/file`);
          persistentAudio = audio;
          audioRef.current = audio;
          audio.volume = playerVolume;
          setPlayerTrack(track);
          setPlayerIsPlaying(false);
          audio.addEventListener('timeupdate', () => {
            if (audio.duration && isFinite(audio.duration)) {
              setPlayerProgress(audio.currentTime / audio.duration);
              setPlayerCurrentTime(audio.currentTime);
              setPlayerDuration(audio.duration);
              // Persist currentTime
              try { localStorage.setItem(PERSIST_KEY, JSON.stringify({ track, currentTime: audio.currentTime })); } catch (_) { /* quota */ }
            }
          });
          audio.addEventListener('loadedmetadata', () => {
            if (isFinite(audio.duration)) {
              setPlayerDuration(audio.duration);
              audio.currentTime = currentTime;
              setPlayerCurrentTime(currentTime);
              setPlayerProgress(audio.duration ? currentTime / audio.duration : 0);
            }
          });
          audio.addEventListener('ended', () => {
            if (isLoopingRef.current) { audio.currentTime = 0; audio.play().catch(() => {}); }
            else { setPlayerIsPlaying(false); playNextRef.current(); }
          });
        }
      } catch (_) { /* ignore corrupt localStorage */ }
    }

    // Load projects and restore active project/tab from localStorage
    authFetch('/api/projects')
      .then(r => r.json())
      .then((projs: Project[]) => {
        setProjects(projs);
        const saved: UiState | null = (() => {
          try { const s = localStorage.getItem(UI_STATE_KEY); return s ? (JSON.parse(s) as UiState) : null; } catch (_) { return null; }
        })();
        if (saved?.activeProjectId) {
          const exists = projs.find(p => p.id === saved.activeProjectId);
          if (exists) setActiveProjectId(saved.activeProjectId);
        }
        if (saved?.activeTab) setActiveTab(saved.activeTab as V4Tab);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch tracks and restore selected track when project changes
  useEffect(() => {
    if (!activeProjectId) { setTracks([]); return; }
    const saved: UiState | null = (() => {
      try { const s = localStorage.getItem(UI_STATE_KEY); return s ? (JSON.parse(s) as UiState) : null; } catch (_) { return null; }
    })();
    authFetch(`/api/projects/${activeProjectId}/music`)
      .then(r => r.json())
      .then((list: MusicGeneration[]) => {
        setTracks(list.map(prefixApiUrls));
        // Sync stale selected/player tracks
        if (selectedTrack) {
          const u = list.find(t => t.id === selectedTrack.id);
          if (u) setSelectedTrack(u);
        }
        if (playerTrack) {
          const u = list.find(t => t.id === playerTrack.id);
          if (u) setPlayerTrack(u);
        }
        // Restore selected track from persisted UI state
        if (!selectedTrack && saved?.selectedTrackId) {
          const match = list.find(t => t.id === saved.selectedTrackId);
          if (match) setSelectedTrack(match);
        }
        if (list.length > 0 && !selectedTrack) setSelectedTrack(list[0]);
      })
      .catch(() => {});
  }, [activeProjectId]);

  const refreshProjects = useCallback(() => {
    authFetch('/api/projects').then(r => r.json()).then(setProjects).catch(() => {});
  }, [authFetch]);

  const refreshPlaylists = useCallback(() => {
    authFetch('/api/playlists').then(r => r.json()).then(setPlaylists).catch(() => {});
  }, [authFetch]);

  const refreshTracks = useCallback(() => {
    if (!activeProjectId) return;
    authFetch(`/api/projects/${activeProjectId}/music`)
      .then(r => r.json())
      .then((list: MusicGeneration[]) => {
        setTracks(list.map(prefixApiUrls));
        if (selectedTrack) { const u = list.find(t => t.id === selectedTrack.id); if (u) setSelectedTrack(u); }
        if (playerTrack) { const u = list.find(t => t.id === playerTrack.id); if (u) setPlayerTrack(u); }
        if (list.length > 0 && !selectedTrack) setSelectedTrack(list[0]);
      })
      .catch(() => {});
  }, [activeProjectId, selectedTrack, playerTrack, authFetch]);

  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;

  const playTrack = useCallback((track: MusicGeneration) => {
    if (persistentAudio) { persistentAudio.pause(); persistentAudio.src = ''; }
    const audio = new Audio(`${API_BASE}/api/music/${track.id}/file`);
    audio.volume = playerVolume;
    persistentAudio = audio;
    audioRef.current = audio;
    persistentTrack = track;
    try { localStorage.setItem(PERSIST_KEY, JSON.stringify({ track, currentTime: 0 })); } catch (_) { /* quota */ }
    audio.play().catch(() => {});
    setPlayerTrack(track);
    setSelectedTrack(track);
    setPlayerIsPlaying(true);
    setPlayerProgress(0);
    setPlayerCurrentTime(0);
    const updateTime = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setPlayerProgress(audio.currentTime / audio.duration);
        setPlayerCurrentTime(audio.currentTime);
        setPlayerDuration(audio.duration);
        try { localStorage.setItem(PERSIST_KEY, JSON.stringify({ track, currentTime: audio.currentTime })); } catch (_) { /* quota */ }
      }
    };
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateTime);
    audio.addEventListener('ended', () => {
      if (isLoopingRef.current) { audio.currentTime = 0; audio.play().catch(() => {}); }
      else { setPlayerIsPlaying(false); playNextRef.current(); }
    });
  }, [playerVolume]);

  const togglePlay = useCallback(() => {
    if (!persistentAudio) return;
    if (playerIsPlaying) { persistentAudio.pause(); setPlayerIsPlaying(false); }
    else { persistentAudio.play().catch(() => {}); setPlayerIsPlaying(true); }
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
    if (isShuffledRef.current && tracks.length > 1) {
      const others = tracks.filter(t => t.id !== playerTrack.id);
      playTrack(others[Math.floor(Math.random() * others.length)]);
      return;
    }
    const idx = tracks.findIndex(t => t.id === playerTrack.id);
    const isLast = idx === tracks.length - 1;
    if (isLast && !isLoopingRef.current) return;
    playTrack(tracks[(idx + 1) % tracks.length]);
  }, [playerTrack, tracks, playTrack]);

  // Keep playNextRef current so ended handlers can call it without stale closure
  useEffect(() => { playNextRef.current = playNext; }, [playNext]);

  const playPrev = useCallback(() => {
    if (!playerTrack || tracks.length === 0) return;
    const idx = tracks.findIndex(t => t.id === playerTrack.id);
    playTrack(tracks[(idx - 1 + tracks.length) % tracks.length]);
  }, [playerTrack, tracks, playTrack]);

  const toggleLoop = useCallback(() => setIsLooping(v => !v), []);
  const toggleShuffle = useCallback(() => setIsShuffled(v => !v), []);

  // Keep refs in sync so ended handlers always see current values
  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);
  useEffect(() => { isShuffledRef.current = isShuffled; }, [isShuffled]);

  return (
    <WorkspaceContext.Provider value={{
      projects, activeProjectId, activeProject, setActiveProjectId: setActiveProjectIdWrapped, refreshProjects,
      tracks, selectedTrack, setSelectedTrack: setSelectedTrackWrapped, refreshTracks,
      selectedLyrics, setSelectedLyrics,
      activeTab: activeTab, setActiveTab: setActiveTabWrapped,
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
