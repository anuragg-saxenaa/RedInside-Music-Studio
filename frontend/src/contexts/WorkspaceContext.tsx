import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { useSafeAuth } from '../lib/clerkSafe';
import { setNowPlaying, setPlaybackState, setPosition, clearNowPlaying, bindMediaActions } from '../pwa/mediaSession';
import { createAudio, setRemoteHandlers, isNativeApp, preloadNext, setLoadingStartHandler } from '../pwa/nativeAudio';
import type { Project, MusicGeneration, LyricsGeneration, Playlist, V4Tab } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
// Coerce a fetch result to an array — a cloud error/redirect body ({error:...})
// must never reach .find/.map and blank the whole app.
function asArray<T>(v: unknown): T[] { return Array.isArray(v) ? (v as T[]) : []; }
// Prefix relative /api/ URLs so <img src> works on cloud (not just fetch calls)
function prefixApiUrls(track: MusicGeneration): MusicGeneration {
  if (!API_BASE) return track;
  const fix = (u?: string) => (u && u.startsWith('/api') ? API_BASE + u : u);
  return { ...track, artwork_url: fix(track.artwork_url) };
}

export interface DownloadJob {
  id: string;
  jobType: 'download' | 'stream';
  status: 'pending' | 'processing' | 'done' | 'failed';
  title?: string;
  thumbnail?: string;
  error?: string;
}

interface WorkspaceContextType {
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  setActiveProjectId: (id: string | null) => void;
  refreshProjects: () => void;

  tracks: MusicGeneration[];
  tracksLoading: boolean;
  selectedTrack: MusicGeneration | null;
  setSelectedTrack: (t: MusicGeneration | null) => void;
  refreshTracks: () => void;

  likedIds: Set<string>;
  isLiked: (trackId: string) => boolean;
  toggleLike: (track: MusicGeneration) => void;
  addTrackToPlaylist: (playlistId: string, trackId: string) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  createPlaylistNamed: (name: string) => Promise<string | null>;
  playQueue: (list: MusicGeneration[], startIndex?: number) => void;
  queue: MusicGeneration[];
  addToQueue: (track: MusicGeneration) => void;
  playTrackNext: (track: MusicGeneration) => void;
  sleepMinutes: number | null;
  setSleepTimer: (minutes: number | null) => void;
  recentTracks: MusicGeneration[];
  mobilePlaylistId: string | null;
  setMobilePlaylistId: (id: string | null) => void;

  // Global YouTube download/stream jobs — tracked app-wide so they keep polling and
  // auto-refresh the library even if the import panel is closed (downloads reflect
  // immediately, no close/reopen). Stream jobs auto-play when ready.
  downloadJobs: DownloadJob[];
  enqueueDownload: (url: string, jobType: 'download' | 'stream', meta?: { title?: string; thumbnail?: string }) => Promise<string | null>;

  selectedLyrics: LyricsGeneration | null;
  setSelectedLyrics: (l: LyricsGeneration | null) => void;

  activeTab: V4Tab;
  setActiveTab: (tab: V4Tab) => void;

  playlists: Playlist[];
  refreshPlaylists: () => void;

  playerTrack: MusicGeneration | null;
  playerIsPlaying: boolean;
  playerLoading: boolean;
  playerProgress: number;
  playerCurrentTime: number;
  playerDuration: number;
  playerVolume: number;
  playTrack: (track: MusicGeneration) => void;
  playStreamUrl: (streamUrl: string, meta: { title: string; artist?: string; artworkUrl?: string | null }) => void;
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
let lastPersistAt = 0; // throttle localStorage writes (synchronous = main-thread jank)
// Throttled resume-point persist — writing every 0.5s timeupdate is synchronous
// disk I/O that accumulates into jank over a long session. Persist at most every 5s.
function persistResumePoint(track: MusicGeneration, currentTime: number) {
  const now = Date.now();
  if (now - lastPersistAt < 5000) return;
  lastPersistAt = now;
  try { localStorage.setItem('ris_player_track', JSON.stringify({ track, currentTime })); } catch (_) { /* quota */ }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { getToken } = useSafeAuth();

  const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = await getToken();
    const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
    // Desktop (Tauri) standalone build authenticates with a baked shared secret
    // instead of interactive login (Google OAuth is blocked in embedded webviews).
    const desktopToken = import.meta.env.VITE_DESKTOP_TOKEN;
    return fetch(fullUrl, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(desktopToken ? { 'X-Desktop-Token': desktopToken } : {}),
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
  const [tracksLoading, setTracksLoading] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const likedPlaylistId = useRef<string | null>(null);
  const queueRef = useRef<MusicGeneration[]>([]);
  const tracksRef = useRef<MusicGeneration[]>([]);
  const [queue, setQueueState] = useState<MusicGeneration[]>([]);
  const setQueue = useCallback((list: MusicGeneration[]) => { queueRef.current = list; setQueueState(list); }, []);
  const [mobilePlaylistId, setMobilePlaylistId] = useState<string | null>(null);
  const sleepRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const [downloadJobs, setDownloadJobs] = useState<DownloadJob[]>([]);
  const RECENT_KEY = 'ris_recent_tracks';
  const [recentTracks, setRecentTracks] = useState<MusicGeneration[]>(() => {
    try { const s = localStorage.getItem(RECENT_KEY); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [selectedTrack, setSelectedTrack] = useState<MusicGeneration | null>(null);
  const [selectedLyrics, setSelectedLyrics] = useState<LyricsGeneration | null>(null);
  const [activeTab, setActiveTab] = useState<V4Tab>((savedUiState?.activeTab as V4Tab) ?? 'sounds');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playerTrack, setPlayerTrack] = useState<MusicGeneration | null>(persistentTrack);
  const [playerIsPlaying, setPlayerIsPlaying] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);
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
  const playPrevRef = useRef<() => void>(() => {});

  // Build the OS Now-Playing artwork URL for a track.
  const nowPlayingArt = (t: MusicGeneration) =>
    t.artwork_url ? `${API_BASE}/api/projects/${t.project_id}/artwork/${t.id}` : null;

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
    authFetch('/api/playlists').then(r => r.json()).then(d => setPlaylists(asArray<Playlist>(d))).catch(() => {});

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
          const audio = createAudio(`${API_BASE}/api/music/${track.id}/file`, { title: track.title || `Track v${track.version}`, artist: track.artist || '', artworkUrl: nowPlayingArt(track) });
          persistentAudio = audio;
          audioRef.current = audio;
          audio.volume = playerVolume;
          setPlayerTrack(track);
          setPlayerIsPlaying(false);
          setNowPlaying({ title: track.title || `Track v${track.version}`, artist: track.artist || '', artworkUrl: nowPlayingArt(track) });
          setPlaybackState('paused');
          audio.addEventListener('timeupdate', () => {
            if (audio.duration && isFinite(audio.duration)) {
              setPlayerProgress(audio.currentTime / audio.duration);
              setPlayerCurrentTime(audio.currentTime);
              setPlayerDuration(audio.duration);
              setPosition(audio.duration, audio.currentTime);
              persistResumePoint(track, audio.currentTime); // throttled
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
      .then((data: unknown) => {
        const projs = asArray<Project>(data);
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
    setTracksLoading(true);
    authFetch(`/api/projects/${activeProjectId}/music`)
      .then(r => r.json())
      .then((data: unknown) => {
        const list = asArray<MusicGeneration>(data);
        setTracks(list.map(prefixApiUrls));
        setTracksLoading(false);
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
      .catch(() => setTracksLoading(false));
  }, [activeProjectId]);

  const refreshProjects = useCallback(() => {
    authFetch('/api/projects').then(r => r.json()).then(d => setProjects(asArray<Project>(d))).catch(() => {});
  }, [authFetch]);

  const refreshPlaylists = useCallback(() => {
    authFetch('/api/playlists').then(r => r.json()).then(d => setPlaylists(asArray<Playlist>(d))).catch(() => {});
  }, [authFetch]);

  // ── Likes (a "Liked Songs" playlist, Spotify-style) ──
  const LIKED_NAME = 'Liked Songs';
  const loadLikes = useCallback(async () => {
    try {
      const pls = asArray<Playlist>(await (await authFetch('/api/playlists')).json());
      const liked = pls.find(p => p.name === LIKED_NAME);
      if (!liked) { likedPlaylistId.current = null; setLikedIds(new Set()); return; }
      likedPlaylistId.current = liked.id;
      const ts = asArray<MusicGeneration>(await (await authFetch(`/api/playlists/${liked.id}/tracks`)).json());
      setLikedIds(new Set(ts.map(t => t.id)));
    } catch { /* offline / not ready */ }
  }, [authFetch]);

  const isLiked = useCallback((trackId: string) => likedIds.has(trackId), [likedIds]);

  const toggleLike = useCallback(async (track: MusicGeneration) => {
    const wasLiked = likedIds.has(track.id);
    // Optimistic + sticky (never flip back — avoids visual flicker on slow API).
    setLikedIds(prev => { const n = new Set(prev); if (wasLiked) n.delete(track.id); else n.add(track.id); return n; });
    try {
      if (!likedPlaylistId.current) {
        const created = await (await authFetch('/api/playlists', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: LIKED_NAME }),
        })).json();
        likedPlaylistId.current = created?.id ?? null;
      }
      const pid = likedPlaylistId.current;
      if (!pid) return;
      if (wasLiked) {
        await authFetch(`/api/playlists/${pid}/tracks/${track.id}`, { method: 'DELETE' });
      } else {
        await authFetch(`/api/playlists/${pid}/tracks`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ musicId: track.id }),
        });
      }
      refreshPlaylists();
    } catch { /* keep optimistic state; will reconcile on next load */ }
  }, [authFetch, likedIds, refreshPlaylists]);

  // Generic playlist membership (used by the add-to-playlist sheet).
  const addTrackToPlaylist = useCallback(async (playlistId: string, trackId: string) => {
    try {
      await authFetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ musicId: trackId }),
      });
      if (playlistId === likedPlaylistId.current) setLikedIds(prev => new Set(prev).add(trackId));
      refreshPlaylists();
    } catch { /* ignore */ }
  }, [authFetch, refreshPlaylists]);

  const removeTrackFromPlaylist = useCallback(async (playlistId: string, trackId: string) => {
    try {
      await authFetch(`/api/playlists/${playlistId}/tracks/${trackId}`, { method: 'DELETE' });
      if (playlistId === likedPlaylistId.current) setLikedIds(prev => { const n = new Set(prev); n.delete(trackId); return n; });
      refreshPlaylists();
    } catch { /* ignore */ }
  }, [authFetch, refreshPlaylists]);

  const createPlaylistNamed = useCallback(async (name: string): Promise<string | null> => {
    try {
      const created = await (await authFetch('/api/playlists', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })).json();
      refreshPlaylists();
      return created?.id ?? null;
    } catch { return null; }
  }, [authFetch, refreshPlaylists]);

  // Load likes once on mount. Deps intentionally empty — loadLikes closes over a
  // stable authFetch; keying the effect on it would re-fire every render (the
  // no-Clerk auth stub returns a fresh getToken each render), causing a fetch loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadLikes(); }, []);

  const refreshTracks = useCallback(() => {
    if (!activeProjectId) return;
    authFetch(`/api/projects/${activeProjectId}/music`)
      .then(r => r.json())
      .then((data: unknown) => {
        const list = asArray<MusicGeneration>(data);
        setTracks(list.map(prefixApiUrls));
        if (selectedTrack) { const u = list.find(t => t.id === selectedTrack.id); if (u) setSelectedTrack(u); }
        if (playerTrack) { const u = list.find(t => t.id === playerTrack.id); if (u) setPlayerTrack(u); }
        if (list.length > 0 && !selectedTrack) setSelectedTrack(list[0]);
      })
      .catch(() => {});
  }, [activeProjectId, selectedTrack, playerTrack, authFetch]);

  // ── Global YouTube download/stream jobs ──
  // Enqueue a job and track it app-wide. Survives the import panel closing.
  const enqueueDownload = useCallback(async (url: string, jobType: 'download' | 'stream', meta?: { title?: string; thumbnail?: string }): Promise<string | null> => {
    try {
      const body: Record<string, unknown> = { url, jobType };
      if (jobType === 'download') body.projectId = activeProjectId;
      const r = await authFetch('/api/youtube/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok || !d.jobId) return null;
      setDownloadJobs(prev => [...prev, { id: d.jobId, jobType, status: 'pending', title: meta?.title, thumbnail: meta?.thumbnail }]);
      return d.jobId;
    } catch { return null; }
  }, [activeProjectId, authFetch]);

  // Poll active jobs every 2s. On done: stream → play; download → refresh library.
  // Keeps running regardless of which screen is open, so downloads appear instantly.
  const refreshTracksRef = useRef(refreshTracks);
  useEffect(() => { refreshTracksRef.current = refreshTracks; }, [refreshTracks]);
  const playStreamRef = useRef<((u: string, m: { title: string; artist?: string; artworkUrl?: string | null }) => void) | null>(null);
  useEffect(() => {
    const active = downloadJobs.filter(j => j.status !== 'done' && j.status !== 'failed');
    if (active.length === 0) return;
    const iv = setInterval(async () => {
      for (const job of active) {
        try {
          const r = await authFetch(`/api/youtube/jobs/${job.id}`);
          if (!r.ok) continue;
          const s = await r.json();
          if (s.status === 'done') {
            if (job.jobType === 'stream' && s.streamUrl) {
              playStreamRef.current?.(s.streamUrl, { title: s.title || job.title || 'YouTube', artworkUrl: job.thumbnail || null });
            } else {
              refreshTracksRef.current();
            }
            setDownloadJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'done', title: s.title || j.title } : j));
            // Drop completed jobs after a moment so the UI can show a brief "done".
            setTimeout(() => setDownloadJobs(prev => prev.filter(j => j.id !== job.id)), 4000);
          } else if (s.status === 'failed') {
            setDownloadJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'failed', error: s.error } : j));
            setTimeout(() => setDownloadJobs(prev => prev.filter(j => j.id !== job.id)), 6000);
          } else {
            setDownloadJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: s.status } : j));
          }
        } catch { /* keep polling */ }
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [downloadJobs, authFetch]);

  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;

  const playTrack = useCallback((track: MusicGeneration, preserveQueue = false) => {
    if (!track) return; // guard — never load an undefined track (crash safety)
    // A direct tap (Sounds list, etc.) seeds the queue from the project tracks so
    // next/prev + Up Next work everywhere; playlist playback passes preserveQueue.
    if (!preserveQueue) {
      const base = tracksRef.current;
      const q = base.some(t => t.id === track.id) ? base.slice() : [track];
      queueRef.current = q; setQueueState(q);
    }
    // If this exact track is already loaded, toggle play/pause instead of restarting
    if (persistentAudio && persistentTrack?.id === track.id && persistentAudio.src) {
      if (persistentAudio.paused) { persistentAudio.play().catch(() => {}); setPlayerIsPlaying(true); setPlaybackState('playing'); }
      else { persistentAudio.pause(); setPlayerIsPlaying(false); setPlaybackState('paused'); }
      setSelectedTrack(track);
      return;
    }
    if (persistentAudio) { persistentAudio.pause(); persistentAudio.src = ''; }
    const audio = createAudio(`${API_BASE}/api/music/${track.id}/file`, { title: track.title || `Track v${track.version}`, artist: track.artist || '', artworkUrl: nowPlayingArt(track) });
    audio.volume = playerVolume;
    persistentAudio = audio;
    audioRef.current = audio;
    persistentTrack = track;
    try { localStorage.setItem(PERSIST_KEY, JSON.stringify({ track, currentTime: 0 })); } catch (_) { /* quota */ }
    audio.play().catch(() => {});
    setPlayerTrack(track);
    setSelectedTrack(track);
    setPlayerIsPlaying(true);
    // On native iOS with AVQueuePlayer + preload, audio starts in <100ms so the
    // spinner is never visible. Show it only after a 400ms delay to avoid flash.
    setPlayerLoading(false);
    if (!isNativeApp()) {
      setPlayerLoading(true);
    } else {
      const t = setTimeout(() => setPlayerLoading(true), 400);
      // Cancel the timer as soon as timeupdate fires (audio has started).
      const cancelTimer = () => { clearTimeout(t); };
      audio.addEventListener('timeupdate', cancelTimer, { once: true } as EventListenerOptions);
    }
    setPlayerProgress(0);
    setPlayerCurrentTime(0);
    setNowPlaying({ title: track.title || `Track v${track.version}`, artist: track.artist || '', artworkUrl: nowPlayingArt(track) });
    const updateTime = () => {
      if (audio.currentTime > 0) setPlayerLoading(false);
      if (audio.duration && isFinite(audio.duration)) {
        setPlayerProgress(audio.currentTime / audio.duration);
        setPlayerCurrentTime(audio.currentTime);
        setPlayerDuration(audio.duration);
        setPosition(audio.duration, audio.currentTime); // lock-screen / Bluetooth scrubber
        persistResumePoint(track, audio.currentTime);   // throttled — not every 0.5s
      }
    };
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateTime);
    audio.addEventListener('ended', () => {
      if (isLoopingRef.current) { audio.currentTime = 0; audio.play().catch(() => {}); }
      else { setPlayerIsPlaying(false); playNextRef.current(); }
    });
    // Prebuffer the adjacent tracks so skip (either direction) / auto-advance is
    // instant — the warm player seeds the URL cache, the real skip plays from cache.
    const q = queueRef.current.length ? queueRef.current : tracksRef.current;
    const idx = q.findIndex(t => t.id === track.id);
    if (idx >= 0 && idx + 1 < q.length) preloadNext(`${API_BASE}/api/music/${q[idx + 1].id}/file`);
    // Warm the previous track too (web: hidden <audio preload>; native handled by the
    // warm player on demand). Cheap because responses are immutable-cached.
    if (idx > 0 && !isNativeApp()) {
      try { const a = new Audio(`${API_BASE}/api/music/${q[idx - 1].id}/file`); a.preload = 'auto'; a.volume = 0; } catch { /* ignore */ }
    }
    if (idx >= 0 && idx + 1 < q.length && !isNativeApp()) {
      try { const a = new Audio(`${API_BASE}/api/music/${q[idx + 1].id}/file`); a.preload = 'auto'; a.volume = 0; } catch { /* ignore */ }
    }
    // Recently played (most-recent first, de-duped, capped) for the Home screen.
    setRecentTracks(prev => {
      const next = [track, ...prev.filter(t => t.id !== track.id)].slice(0, 16);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, [playerVolume]);

  // Play a transient stream URL (YouTube preview) — bypasses the library.
  // The track is ephemeral: no musicId, no project attachment, just plays.
  const playStreamUrl = useCallback((streamUrl: string, meta: { title: string; artist?: string; artworkUrl?: string | null }) => {
    if (persistentAudio) { persistentAudio.pause(); persistentAudio.src = ''; }
    const fakeTrack = { id: `stream-${Date.now()}`, title: meta.title, artist: meta.artist || '', version: 1, project_id: '' } as unknown as MusicGeneration;
    const audio = createAudio(streamUrl, { title: meta.title, artist: meta.artist, artworkUrl: meta.artworkUrl });
    audio.volume = playerVolume;
    persistentAudio = audio; audioRef.current = audio; persistentTrack = fakeTrack;
    audio.play().catch(() => {});
    setPlayerTrack(fakeTrack); setSelectedTrack(fakeTrack);
    setPlayerIsPlaying(true); setPlayerLoading(true);
    setPlayerProgress(0); setPlayerCurrentTime(0); setPlayerDuration(0);
    setNowPlaying({ title: meta.title, artist: meta.artist || '', artworkUrl: meta.artworkUrl ?? null });
    setPlaybackState('playing');
    audio.addEventListener('timeupdate', () => {
      if ((audio as any).currentTime > 0) setPlayerLoading(false);
      if (audio.duration && isFinite(audio.duration)) {
        setPlayerProgress(audio.currentTime / audio.duration);
        setPlayerCurrentTime(audio.currentTime); setPlayerDuration(audio.duration);
        setPosition(audio.duration, audio.currentTime);
      }
    });
    audio.addEventListener('loadedmetadata', () => { if (isFinite(audio.duration)) setPlayerDuration(audio.duration); });
    audio.addEventListener('ended', () => { setPlayerIsPlaying(false); setPlaybackState('paused'); });
  }, [playerVolume]);

  // Let the global download-job poller trigger stream playback.
  useEffect(() => { playStreamRef.current = playStreamUrl; }, [playStreamUrl]);

  const togglePlay = useCallback(() => {
    if (!persistentAudio) return;
    // Read actual audio state (not React state) — avoids double-press bug where
    // playerIsPlaying can be stale vs real native AVPlayer state on iOS.
    const actuallyPlaying = !persistentAudio.paused && !persistentAudio.ended;
    if (actuallyPlaying) { persistentAudio.pause(); setPlayerIsPlaying(false); setPlaybackState('paused'); }
    else { persistentAudio.play().catch(() => {}); setPlayerIsPlaying(true); setPlaybackState('playing'); }
  }, []);

  const seekTo = useCallback((fraction: number) => {
    if (!persistentAudio || !isFinite(persistentAudio.duration)) return;
    persistentAudio.currentTime = fraction * persistentAudio.duration;
  }, []);

  const setPlayerVolume = useCallback((v: number) => {
    setPlayerVolumeState(v);
    if (persistentAudio) persistentAudio.volume = v;
  }, []);

  // Active play source: the playlist queue if one is set, else the project tracks.
  const playQueue = useCallback((list: MusicGeneration[], startIndex = 0) => {
    if (!list.length) return;
    setQueue(list.slice());
    playTrack(list[Math.max(0, Math.min(startIndex, list.length - 1))], true);
  }, [playTrack, setQueue]);

  // Base queue for add operations: the active queue, else the current playing track.
  const queueBase = useCallback(() => {
    if (queueRef.current.length) return queueRef.current.slice();
    return playerTrack ? [playerTrack] : [];
  }, [playerTrack]);

  const addToQueue = useCallback((track: MusicGeneration) => {
    const base = queueBase().filter(t => t.id !== track.id);
    setQueue([...base, track]);
  }, [queueBase, setQueue]);

  const playTrackNext = useCallback((track: MusicGeneration) => {
    const base = queueBase().filter(t => t.id !== track.id);
    const idx = playerTrack ? base.findIndex(t => t.id === playerTrack.id) : -1;
    base.splice(idx + 1, 0, track);
    setQueue(base);
  }, [queueBase, setQueue, playerTrack]);

  const playNext = useCallback(() => {
    const q = queueRef.current.length ? queueRef.current : tracksRef.current;
    if (!playerTrack || q.length === 0) return;
    if (isShuffledRef.current && q.length > 1) {
      const others = q.filter(t => t.id !== playerTrack.id);
      const pick = others[Math.floor(Math.random() * others.length)];
      if (pick) playTrack(pick, true);
      return;
    }
    const idx = q.findIndex(t => t.id === playerTrack.id);
    const isLast = idx === q.length - 1;
    if (isLast && !isLoopingRef.current) return;
    const next = q[(idx + 1) % q.length];
    if (next) playTrack(next, true);
  }, [playerTrack, playTrack]);

  // Keep playNextRef current so ended handlers can call it without stale closure
  useEffect(() => { playNextRef.current = playNext; }, [playNext]);

  const playPrev = useCallback(() => {
    const q = queueRef.current.length ? queueRef.current : tracksRef.current;
    if (!playerTrack || q.length === 0) return;
    const idx = q.findIndex(t => t.id === playerTrack.id);
    const prev = q[(idx - 1 + q.length) % q.length];
    if (prev) playTrack(prev, true);
  }, [playerTrack, playTrack]);

  useEffect(() => { playPrevRef.current = playPrev; }, [playPrev]);

  // Bind OS media-key / lock-screen controls once to the live player (via refs).
  useEffect(() => {
    bindMediaActions({
      play: () => { persistentAudio?.play().catch(() => {}); setPlayerIsPlaying(true); setPlaybackState('playing'); },
      pause: () => { persistentAudio?.pause(); setPlayerIsPlaying(false); setPlaybackState('paused'); },
      next: () => playNextRef.current(),
      prev: () => playPrevRef.current(),
      seekTo: (sec: number) => { if (persistentAudio && isFinite(persistentAudio.duration)) persistentAudio.currentTime = sec; },
    });
    // Native (iOS): lock-screen / AirPods / car hardware controls come through the
    // AudioPlayer plugin. next/prev advance the queue; statechange syncs play/pause UI.
    if (isNativeApp()) {
      setRemoteHandlers({
        next: () => playNextRef.current(),
        prev: () => playPrevRef.current(),
        state: (isPlaying: boolean) => setPlayerIsPlaying(isPlaying),
      });
      // When AVQueuePlayer begins loading the next track, hide any stale spinner.
      setLoadingStartHandler(() => setPlayerLoading(false));
    }
    return () => clearNowPlaying();
  }, []);

  const toggleLoop = useCallback(() => setIsLooping(v => !v), []);
  const toggleShuffle = useCallback(() => setIsShuffled(v => !v), []);

  // Sleep timer — pause playback after N minutes (null = off).
  const setSleepTimer = useCallback((minutes: number | null) => {
    if (sleepRef.current) { clearTimeout(sleepRef.current); sleepRef.current = null; }
    if (minutes && minutes > 0) {
      setSleepMinutes(minutes);
      sleepRef.current = setTimeout(() => {
        persistentAudio?.pause();
        setPlayerIsPlaying(false); setPlaybackState('paused'); setSleepMinutes(null); sleepRef.current = null;
      }, minutes * 60000);
    } else {
      setSleepMinutes(null);
    }
  }, []);

  // Keep refs in sync so ended handlers always see current values
  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);
  useEffect(() => { isShuffledRef.current = isShuffled; }, [isShuffled]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);

  return (
    <WorkspaceContext.Provider value={{
      projects, activeProjectId, activeProject, setActiveProjectId: setActiveProjectIdWrapped, refreshProjects,
      tracks, tracksLoading, selectedTrack, setSelectedTrack: setSelectedTrackWrapped, refreshTracks,
      likedIds, isLiked, toggleLike, addTrackToPlaylist, removeTrackFromPlaylist, createPlaylistNamed,
      playQueue, queue, addToQueue, playTrackNext, sleepMinutes, setSleepTimer, recentTracks, mobilePlaylistId, setMobilePlaylistId,
      downloadJobs, enqueueDownload,
      selectedLyrics, setSelectedLyrics,
      activeTab: activeTab, setActiveTab: setActiveTabWrapped,
      playlists, refreshPlaylists,
      playerTrack, playerIsPlaying, playerLoading, playerProgress, playerCurrentTime, playerDuration, playerVolume,
      playTrack, playStreamUrl, togglePlay, seekTo, setPlayerVolume, playNext, playPrev,
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
