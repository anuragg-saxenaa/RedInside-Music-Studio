# Phase 4 — Frontend DAW Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 7-step linear wizard with a DAW-style 3-column workspace (LeftSidebar + 5-tab centre + RightPanel + PlayerBar) using the red-black liquid glass aesthetic, wired to all Phase 4 backend endpoints.

**Architecture:** New `frontend/src/pages/StudioV4.tsx` page backed by `WorkspaceContext` for shared state. All UI in `frontend/src/components/v4/`. Existing components (LyricsEditor, AudioEditorPanel, MedleyPanel, AudioMasteringPanel, ArtworkGenerator, VideoPreview, VoiceDesign, YoutubeDownloader) are imported and wrapped — not rewritten. `App.tsx` routes to StudioV4 as the default workspace. Old `Studio.tsx` remains untouched.

**Tech Stack:** React 18, TypeScript, Vite, inline styles only (no CSS modules), Playwright for E2E tests.

---

## Color Constants (used across all components)

```typescript
// frontend/src/components/v4/shared/colors.ts
export const C = {
  bg:           '#040102',
  bgApp:        'radial-gradient(ellipse at 10% 0%, rgba(230,57,70,0.40) 0%, transparent 45%), radial-gradient(ellipse at 90% 90%, rgba(180,30,40,0.30) 0%, transparent 45%), radial-gradient(ellipse at 55% 45%, rgba(80,5,10,0.50) 0%, transparent 70%), #040102',
  red:          '#E63946',
  redDark:      '#a01828',
  gold:         '#FFB800',
  glass:        'rgba(0,0,0,0.55)',
  glassActive:  'rgba(230,57,70,0.10)',
  border:       'rgba(230,57,70,0.16)',
  borderActive: 'rgba(230,57,70,0.36)',
  text:         '#fff',
  textDim:      'rgba(255,255,255,0.28)',
  textLabel:    'rgba(230,57,70,0.45)',
  panel: {
    background:      'rgba(0,0,0,0.55)',
    backdropFilter:  'blur(18px) saturate(1.2)',
    border:          '1px solid rgba(230,57,70,0.16)',
    borderRadius:    '10px',
  },
};
```

---

## File Map

| Action | File |
|--------|------|
| Create | `frontend/src/components/v4/shared/colors.ts` |
| Create | `frontend/src/components/v4/shared/GlassPanel.tsx` |
| Create | `frontend/src/contexts/WorkspaceContext.tsx` |
| Create | `frontend/src/pages/StudioV4.tsx` |
| Create | `frontend/src/pages/ShareView.tsx` |
| Create | `frontend/src/components/v4/layout/AppShell.tsx` |
| Create | `frontend/src/components/v4/layout/Titlebar.tsx` |
| Create | `frontend/src/components/v4/layout/LeftSidebar.tsx` |
| Create | `frontend/src/components/v4/layout/RightPanel.tsx` |
| Create | `frontend/src/components/v4/layout/PlayerBar.tsx` |
| Create | `frontend/src/components/v4/workspace/TabBar.tsx` |
| Create | `frontend/src/components/v4/workspace/SoundsTab.tsx` |
| Create | `frontend/src/components/v4/workspace/WriteTab.tsx` |
| Create | `frontend/src/components/v4/workspace/CreateTab.tsx` |
| Create | `frontend/src/components/v4/workspace/CraftTab.tsx` |
| Create | `frontend/src/components/v4/workspace/ReleaseTab.tsx` |
| Create | `frontend/src/components/v4/tracks/TrackRow.tsx` |
| Create | `frontend/src/components/v4/tracks/ABComparator.tsx` |
| Create | `frontend/src/components/v4/release/ReadinessChecklist.tsx` |
| Create | `frontend/src/components/v4/release/SocialExportPanel.tsx` |
| Create | `frontend/src/components/v4/shared/RemixSuggestions.tsx` |
| Modify | `frontend/src/App.tsx` — route to StudioV4, add ShareView hash route |
| Modify | `frontend/src/types.ts` — add Playlist, MusicNote, MusicTags, ShareToken |
| Create | `frontend/tests/e2e/v4-workspace.spec.ts` |
| Create | `frontend/tests/e2e/v4-sounds.spec.ts` |
| Create | `frontend/tests/e2e/v4-playlists.spec.ts` |
| Create | `frontend/tests/e2e/v4-release.spec.ts` |
| Create | `frontend/tests/e2e/v4-share.spec.ts` |

---

### Task 1: New types + WorkspaceContext

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/contexts/WorkspaceContext.tsx`
- Create: `frontend/src/components/v4/shared/colors.ts`

- [ ] **Step 1: Add new types to `frontend/src/types.ts`**

Append to the end of the file (after existing types):

```typescript
export interface Playlist {
  id: string;
  name: string;
  track_count: number;
  created_at: string;
  updated_at: string;
}

export interface PlaylistTrack extends MusicGeneration {
  position: number;
  added_at: string;
}

export interface MusicNote {
  id: string;
  music_id: string;
  timestamp_sec: number;
  text: string;
  created_at: string;
}

export interface MusicTags {
  bpm: number | null;
  key: string | null;
  mood: string | null;
}

export interface ShareToken {
  token: string;
  url: string;
  expiresAt: string;
}

export type V4Tab = 'sounds' | 'write' | 'create' | 'craft' | 'release';
```

- [ ] **Step 2: Create `frontend/src/components/v4/shared/colors.ts`**

```typescript
export const C = {
  bg:           '#040102',
  bgApp:        'radial-gradient(ellipse at 10% 0%, rgba(230,57,70,0.40) 0%, transparent 45%), radial-gradient(ellipse at 90% 90%, rgba(180,30,40,0.30) 0%, transparent 45%), radial-gradient(ellipse at 55% 45%, rgba(80,5,10,0.50) 0%, transparent 70%), #040102',
  red:          '#E63946',
  redDark:      '#a01828',
  gold:         '#FFB800',
  glass:        'rgba(0,0,0,0.55)',
  glassActive:  'rgba(230,57,70,0.10)',
  border:       'rgba(230,57,70,0.16)',
  borderActive: 'rgba(230,57,70,0.36)',
  text:         '#fff',
  textDim:      'rgba(255,255,255,0.28)',
  textLabel:    'rgba(230,57,70,0.45)',
};

export const glassStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.55)',
  backdropFilter: 'blur(18px) saturate(1.2)',
  border: '1px solid rgba(230,57,70,0.16)',
  borderRadius: '10px',
};
```

- [ ] **Step 3: Create `frontend/src/contexts/WorkspaceContext.tsx`**

```typescript
import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import type { Project, MusicGeneration, LyricsGeneration, Playlist, V4Tab } from '../types';

interface WorkspaceContextType {
  // Projects
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  setActiveProjectId: (id: string | null) => void;
  refreshProjects: () => void;

  // Tracks
  tracks: MusicGeneration[];
  selectedTrack: MusicGeneration | null;
  setSelectedTrack: (t: MusicGeneration | null) => void;
  refreshTracks: () => void;

  // Lyrics
  selectedLyrics: LyricsGeneration | null;
  setSelectedLyrics: (l: LyricsGeneration | null) => void;

  // Tabs
  activeTab: V4Tab;
  setActiveTab: (tab: V4Tab) => void;

  // Playlists
  playlists: Playlist[];
  refreshPlaylists: () => void;

  // Player
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

  // Mock mode
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
    audio.addEventListener('ended', () => setPlayerIsPlaying(false));
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
  }, [playerVolume]);

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
    const idx = tracks.findIndex(t => t.id === playerTrack.id);
    const next = tracks[(idx + 1) % tracks.length];
    playTrack(next);
  }, [playerTrack, tracks, playTrack]);

  const playPrev = useCallback(() => {
    if (!playerTrack || tracks.length === 0) return;
    const idx = tracks.findIndex(t => t.id === playerTrack.id);
    const prev = tracks[(idx - 1 + tracks.length) % tracks.length];
    playTrack(prev);
  }, [playerTrack, tracks, playTrack]);

  return (
    <WorkspaceContext.Provider value={{
      projects, activeProjectId, activeProject, setActiveProjectId, refreshProjects,
      tracks, selectedTrack, setSelectedTrack, refreshTracks,
      selectedLyrics, setSelectedLyrics,
      activeTab, setActiveTab,
      playlists, refreshPlaylists,
      playerTrack, playerIsPlaying, playerProgress, playerCurrentTime, playerDuration, playerVolume,
      playTrack, togglePlay, seekTo, setPlayerVolume, playNext, playPrev,
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
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: zero errors for new files (existing TS errors in old files are pre-existing, ignore them if unchanged).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types.ts frontend/src/contexts/WorkspaceContext.tsx frontend/src/components/v4/shared/colors.ts
git commit -m "feat: v4 types, WorkspaceContext, color constants"
```

---

### Task 2: GlassPanel + AppShell layout skeleton

**Files:**
- Create: `frontend/src/components/v4/shared/GlassPanel.tsx`
- Create: `frontend/src/components/v4/layout/AppShell.tsx`
- Create: `frontend/src/pages/StudioV4.tsx`

- [ ] **Step 1: Create `frontend/src/components/v4/shared/GlassPanel.tsx`**

```typescript
import type { CSSProperties, ReactNode } from 'react';
import { C } from './colors';

interface GlassPanelProps {
  children: ReactNode;
  style?: CSSProperties;
  active?: boolean;
  'data-testid'?: string;
}

export default function GlassPanel({ children, style, active, 'data-testid': testId }: GlassPanelProps) {
  return (
    <div
      data-testid={testId}
      style={{
        background: active ? C.glassActive : C.glass,
        backdropFilter: 'blur(18px) saturate(1.2)',
        border: `1px solid ${active ? C.borderActive : C.border}`,
        borderRadius: '10px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/v4/layout/AppShell.tsx`**

```typescript
import type { ReactNode } from 'react';
import { C } from '../shared/colors';

interface AppShellProps {
  titlebar: ReactNode;
  sidebar: ReactNode;
  centre: ReactNode;
  rightPanel: ReactNode;
  playerBar: ReactNode;
  mockBanner?: ReactNode;
}

export default function AppShell({ titlebar, sidebar, centre, rightPanel, playerBar, mockBanner }: AppShellProps) {
  return (
    <div style={{ background: C.bgApp, minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'SF Pro Text', Inter, system-ui, sans-serif", color: C.text }}>
      {mockBanner}
      {titlebar}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr 260px', gap: '8px', padding: '8px', minHeight: 0, paddingBottom: '0' }}>
        <div style={{ overflow: 'hidden auto', paddingBottom: '8px' }} data-testid="left-sidebar">
          {sidebar}
        </div>
        <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }} data-testid="centre-panel">
          {centre}
        </div>
        <div style={{ overflow: 'hidden auto', paddingBottom: '8px' }} data-testid="right-panel">
          {rightPanel}
        </div>
      </div>
      <div style={{ position: 'sticky', bottom: 0, zIndex: 200 }} data-testid="player-bar">
        {playerBar}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/pages/StudioV4.tsx`** (skeleton — filled in as tasks complete)

```typescript
import { WorkspaceProvider } from '../contexts/WorkspaceContext';
import AppShell from '../components/v4/layout/AppShell';
import Titlebar from '../components/v4/layout/Titlebar';
import LeftSidebar from '../components/v4/layout/LeftSidebar';
import RightPanel from '../components/v4/layout/RightPanel';
import PlayerBar from '../components/v4/layout/PlayerBar';
import CentreWorkspace from '../components/v4/workspace/CentreWorkspace';
import { useWorkspace } from '../contexts/WorkspaceContext';

function StudioV4Inner() {
  const { isMockMode } = useWorkspace();
  return (
    <AppShell
      titlebar={<Titlebar />}
      sidebar={<LeftSidebar />}
      centre={<CentreWorkspace />}
      rightPanel={<RightPanel />}
      playerBar={<PlayerBar />}
      mockBanner={isMockMode ? (
        <div style={{ background: '#FFB800', color: '#000', textAlign: 'center', padding: '6px 12px', fontSize: '13px', fontWeight: 600, zIndex: 9999 }}>
          TEST MODE — MiniMax mock active
        </div>
      ) : undefined}
    />
  );
}

export default function StudioV4() {
  return (
    <WorkspaceProvider>
      <StudioV4Inner />
    </WorkspaceProvider>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/v4/workspace/CentreWorkspace.tsx`** (stub — tabs filled in later tasks)

```typescript
import { C } from '../shared/colors';
import GlassPanel from '../shared/GlassPanel';
import TabBar from './TabBar';
import SoundsTab from './SoundsTab';
import WriteTab from './WriteTab';
import CreateTab from './CreateTab';
import CraftTab from './CraftTab';
import ReleaseTab from './ReleaseTab';
import { useWorkspace } from '../../../contexts/WorkspaceContext';

export default function CentreWorkspace() {
  const { activeTab } = useWorkspace();
  return (
    <GlassPanel style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TabBar />
      <div style={{ flex: 1, overflow: 'hidden auto', padding: '16px' }}>
        {activeTab === 'sounds'  && <SoundsTab />}
        {activeTab === 'write'   && <WriteTab />}
        {activeTab === 'create'  && <CreateTab />}
        {activeTab === 'craft'   && <CraftTab />}
        {activeTab === 'release' && <ReleaseTab />}
      </div>
    </GlassPanel>
  );
}
```

- [ ] **Step 5: Verify TS**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "v4\|WorkspaceContext\|StudioV4" | head -20
```
Expected: no errors in v4 files (stub components referenced will error until Task 3+, that's fine — check only the files created in this task).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/v4/shared/GlassPanel.tsx frontend/src/components/v4/layout/AppShell.tsx frontend/src/pages/StudioV4.tsx frontend/src/components/v4/workspace/CentreWorkspace.tsx
git commit -m "feat: v4 AppShell layout skeleton + GlassPanel"
```

---

### Task 3: Titlebar + LeftSidebar (projects section)

**Files:**
- Create: `frontend/src/components/v4/layout/Titlebar.tsx`
- Create: `frontend/src/components/v4/layout/LeftSidebar.tsx`

- [ ] **Step 1: Create `frontend/src/components/v4/layout/Titlebar.tsx`**

```typescript
import { C } from '../shared/colors';

export default function Titlebar() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 20px',
      borderBottom: `1px solid ${C.border}`,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(20px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }} data-testid="titlebar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="13" stroke={C.red} strokeWidth="2"/>
          <path d="M10 8L20 14L10 20V8Z" fill={C.red}/>
        </svg>
        <span style={{ color: C.red, fontWeight: 700, fontSize: '16px', fontFamily: "'SF Pro Display', Inter, sans-serif", letterSpacing: '-0.3px' }}>
          RedInside <span style={{ color: C.text }}>Studio</span>
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/v4/layout/LeftSidebar.tsx`**

```typescript
import { useState, useEffect } from 'react';
import { C, glassStyle } from '../shared/colors';
import GlassPanel from '../shared/GlassPanel';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import type { Project } from '../../../types';
import PlaylistSection from '../playlist/PlaylistSection';

export default function LeftSidebar() {
  const { projects, activeProjectId, setActiveProjectId, refreshProjects } = useWorkspace();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const createProject = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const p: Project = await res.json();
      refreshProjects();
      setActiveProjectId(p.id);
      setNewName('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
      {/* Projects */}
      <GlassPanel style={{ padding: '12px' }}>
        <div style={{ color: C.textLabel, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '8px' }}>
          Projects
        </div>

        {/* New project input */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createProject()}
            placeholder="New project…"
            data-testid="new-project-input"
            style={{
              flex: 1, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
              borderRadius: '6px', padding: '6px 8px', color: C.text, fontSize: '12px', outline: 'none',
            }}
          />
          <button
            onClick={createProject}
            disabled={creating || !newName.trim()}
            data-testid="create-project-btn"
            style={{
              background: C.red, border: 'none', borderRadius: '6px', color: '#fff',
              padding: '6px 10px', fontSize: '14px', cursor: 'pointer', lineHeight: 1,
            }}
          >+</button>
        </div>

        {/* Project list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {projects.slice().sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).map(p => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => setActiveProjectId(p.id)}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setActiveProjectId(p.id)}
              data-testid={`project-item-${p.id}`}
              style={{
                padding: '8px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                background: activeProjectId === p.id ? C.glassActive : 'transparent',
                border: `1px solid ${activeProjectId === p.id ? C.borderActive : 'transparent'}`,
                borderLeft: `3px solid ${activeProjectId === p.id ? C.red : 'transparent'}`,
                color: activeProjectId === p.id ? C.text : C.textDim,
                fontSize: '12px',
                transition: 'all 120ms',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {p.name}
            </div>
          ))}
          {projects.length === 0 && (
            <div style={{ color: C.textDim, fontSize: '11px', padding: '8px 0' }}>No projects yet</div>
          )}
        </div>
      </GlassPanel>

      {/* Playlists */}
      <PlaylistSection />

      {/* More */}
      <GlassPanel style={{ padding: '12px' }}>
        <div style={{ color: C.textLabel, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '8px' }}>
          More
        </div>
        {[
          { label: 'History', href: '#/history' },
          { label: 'Viral Toolkit', href: '#/viral' },
          { label: 'Settings', href: '#/settings' },
        ].map(({ label, href }) => (
          <a key={href} href={href} style={{ display: 'block', color: C.textDim, fontSize: '12px', padding: '6px 0', textDecoration: 'none' }}
            onMouseOver={e => (e.currentTarget as HTMLElement).style.color = C.text}
            onMouseOut={e => (e.currentTarget as HTMLElement).style.color = C.textDim}
          >{label}</a>
        ))}
      </GlassPanel>
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/v4/playlist/PlaylistSection.tsx`** (stub — playlists wired in Task 4)

```typescript
import { C } from '../shared/colors';
import GlassPanel from '../shared/GlassPanel';
import { useWorkspace } from '../../../contexts/WorkspaceContext';

export default function PlaylistSection() {
  const { playlists } = useWorkspace();
  return (
    <GlassPanel style={{ padding: '12px' }} data-testid="playlist-section">
      <div style={{ color: C.textLabel, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '8px' }}>
        Playlists
      </div>
      {playlists.length === 0 && (
        <div style={{ color: C.textDim, fontSize: '11px' }}>No playlists yet</div>
      )}
    </GlassPanel>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/v4/layout/Titlebar.tsx frontend/src/components/v4/layout/LeftSidebar.tsx frontend/src/components/v4/playlist/PlaylistSection.tsx
git commit -m "feat: v4 Titlebar + LeftSidebar with projects"
```

---

### Task 4: PlaylistSection — full implementation

**Files:**
- Modify: `frontend/src/components/v4/playlist/PlaylistSection.tsx`

Replace the stub with full implementation:

- [ ] **Step 1: Rewrite `frontend/src/components/v4/playlist/PlaylistSection.tsx`**

```typescript
import { useState } from 'react';
import { C } from '../shared/colors';
import GlassPanel from '../shared/GlassPanel';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import type { Playlist } from '../../../types';

const SMART_PLAYLISTS = [
  { id: '__all_mastered', name: 'All Mastered' },
  { id: '__instrumentals', name: 'Instrumentals' },
  { id: '__unmastered', name: 'Unmastered' },
];

export default function PlaylistSection() {
  const { playlists, refreshPlaylists, tracks } = useWorkspace();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);

  const createPlaylist = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      refreshPlaylists();
      setNewName('');
    } finally {
      setCreating(false);
    }
  };

  const deletePlaylist = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/playlists/${id}`, { method: 'DELETE' });
    refreshPlaylists();
    if (activePlaylistId === id) setActivePlaylistId(null);
  };

  return (
    <GlassPanel style={{ padding: '12px' }} data-testid="playlist-section">
      <div style={{ color: C.textLabel, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '8px' }}>
        Playlists
      </div>

      {/* Create */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createPlaylist()}
          placeholder="New playlist…"
          data-testid="new-playlist-input"
          style={{
            flex: 1, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
            borderRadius: '6px', padding: '6px 8px', color: C.text, fontSize: '12px', outline: 'none',
          }}
        />
        <button
          onClick={createPlaylist}
          disabled={creating || !newName.trim()}
          data-testid="create-playlist-btn"
          style={{ background: C.red, border: 'none', borderRadius: '6px', color: '#fff', padding: '6px 10px', fontSize: '14px', cursor: 'pointer' }}
        >+</button>
      </div>

      {/* Smart playlists */}
      <div style={{ color: C.textDim, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Smart</div>
      {SMART_PLAYLISTS.map(sp => (
        <div
          key={sp.id}
          role="button"
          tabIndex={0}
          onClick={() => setActivePlaylistId(activePlaylistId === sp.id ? null : sp.id)}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setActivePlaylistId(activePlaylistId === sp.id ? null : sp.id)}
          data-testid={`smart-playlist-${sp.id}`}
          style={{
            padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
            color: activePlaylistId === sp.id ? C.text : C.textDim,
            background: activePlaylistId === sp.id ? C.glassActive : 'transparent',
          }}
        >
          {sp.name}
        </div>
      ))}

      {/* Manual playlists */}
      {playlists.length > 0 && (
        <>
          <div style={{ color: C.textDim, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '8px 0 4px' }}>My Playlists</div>
          {playlists.map(pl => (
            <div
              key={pl.id}
              role="button"
              tabIndex={0}
              onClick={() => setActivePlaylistId(activePlaylistId === pl.id ? null : pl.id)}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setActivePlaylistId(activePlaylistId === pl.id ? null : pl.id)}
              data-testid={`playlist-item-${pl.id}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
                color: activePlaylistId === pl.id ? C.text : C.textDim,
                background: activePlaylistId === pl.id ? C.glassActive : 'transparent',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pl.name} <span style={{ color: C.textDim }}>({pl.track_count})</span>
              </span>
              <button
                onClick={e => deletePlaylist(pl.id, e)}
                style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: '12px', padding: '0 2px', lineHeight: 1 }}
              >×</button>
            </div>
          ))}
        </>
      )}
    </GlassPanel>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/v4/playlist/PlaylistSection.tsx
git commit -m "feat: v4 PlaylistSection — manual + smart playlists"
```

---

### Task 5: TabBar + TrackRow + SoundsTab

**Files:**
- Create: `frontend/src/components/v4/workspace/TabBar.tsx`
- Create: `frontend/src/components/v4/tracks/TrackRow.tsx`
- Create: `frontend/src/components/v4/workspace/SoundsTab.tsx`

- [ ] **Step 1: Create `frontend/src/components/v4/workspace/TabBar.tsx`**

```typescript
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import type { V4Tab } from '../../../types';

const TABS: { id: V4Tab; label: string }[] = [
  { id: 'sounds',  label: 'SOUNDS'  },
  { id: 'write',   label: 'WRITE'   },
  { id: 'create',  label: 'CREATE'  },
  { id: 'craft',   label: 'CRAFT'   },
  { id: 'release', label: 'RELEASE' },
];

export default function TabBar() {
  const { activeTab, setActiveTab } = useWorkspace();
  return (
    <div style={{
      display: 'flex', borderBottom: `1px solid ${C.border}`,
      padding: '0 16px', gap: '0', flexShrink: 0,
    }} data-testid="tab-bar">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          data-testid={`tab-${tab.id}`}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '14px 16px', fontSize: '11px', fontWeight: 700,
            letterSpacing: '1.2px', color: activeTab === tab.id ? C.red : C.textDim,
            borderBottom: `2px solid ${activeTab === tab.id ? C.red : 'transparent'}`,
            marginBottom: '-1px', transition: 'all 150ms',
          }}
          onMouseOver={e => { if (activeTab !== tab.id) (e.currentTarget as HTMLElement).style.color = C.text; }}
          onMouseOut={e => { if (activeTab !== tab.id) (e.currentTarget as HTMLElement).style.color = C.textDim; }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/v4/tracks/TrackRow.tsx`**

```typescript
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import type { MusicGeneration } from '../../../types';

interface TrackRowProps {
  track: MusicGeneration;
  onDoubleClick?: () => void;
}

function fmtDuration(s?: number) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function TrackRow({ track, onDoubleClick }: TrackRowProps) {
  const { selectedTrack, setSelectedTrack, playTrack, playerTrack, playerIsPlaying } = useWorkspace();
  const isSelected = selectedTrack?.id === track.id;
  const isPlaying = playerTrack?.id === track.id && playerIsPlaying;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setSelectedTrack(track)}
      onDoubleClick={onDoubleClick}
      onKeyDown={e => e.key === 'Enter' && setSelectedTrack(track)}
      data-testid={`track-row-${track.id}`}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
        background: isSelected ? C.glassActive : 'transparent',
        border: `1px solid ${isSelected ? C.borderActive : 'transparent'}`,
        transition: 'all 120ms',
      }}
      onMouseOver={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseOut={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {/* Play indicator */}
      <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isPlaying ? (
          <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '14px' }}>
            {[1,2,3].map(i => <div key={i} style={{ width: '3px', background: C.red, borderRadius: '1px', height: `${8 + i * 2}px`, animation: `barPulse${i} 0.8s ease-in-out infinite alternate` }} />)}
          </div>
        ) : (
          <svg width="10" height="12" viewBox="0 0 10 12" fill={isSelected ? C.red : C.textDim}>
            <path d="M0 0L10 6L0 12V0Z"/>
          </svg>
        )}
      </div>

      {/* Title + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.text, fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {track.title || `Track v${track.version}`}
        </div>
        <div style={{ color: C.textDim, fontSize: '11px', marginTop: '2px' }}>
          {fmtDuration(track.duration_seconds)} {track.bitrate ? `· ${track.bitrate}kbps` : ''}
        </div>
      </div>

      {/* Play button */}
      <button
        onClick={e => { e.stopPropagation(); playTrack(track); }}
        data-testid={`play-btn-${track.id}`}
        style={{ background: 'none', border: 'none', color: isSelected ? C.red : C.textDim, cursor: 'pointer', padding: '4px', fontSize: '12px' }}
      >▶</button>

      <style>{`
        @keyframes barPulse1 { from { height: 6px } to { height: 14px } }
        @keyframes barPulse2 { from { height: 10px } to { height: 4px } }
        @keyframes barPulse3 { from { height: 8px } to { height: 12px } }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/v4/workspace/SoundsTab.tsx`**

```typescript
import { useState } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import TrackRow from '../tracks/TrackRow';
import ABComparator from '../tracks/ABComparator';
import YoutubeDownloader from '../../Downloader/YoutubeDownloader';
import MusicPlayer from '../../MusicPlayer/MusicPlayer';

export default function SoundsTab() {
  const { tracks, activeProjectId, selectedLyrics, setSelectedTrack, setActiveTab, refreshTracks } = useWorkspace();
  const [showYoutube, setShowYoutube] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

  if (!activeProjectId) {
    return (
      <div style={{ color: C.textDim, textAlign: 'center', padding: '48px 0', fontSize: '14px' }}>
        Select a project from the sidebar to view tracks
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setShowGenerate(v => !v)}
          data-testid="generate-btn"
          style={{
            background: showGenerate ? C.glassActive : 'rgba(255,255,255,0.06)',
            border: `1px solid ${showGenerate ? C.borderActive : C.border}`,
            borderRadius: '8px', color: C.text, padding: '8px 16px', fontSize: '12px',
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          <span style={{ color: C.red }}>⚡</span> Generate New
        </button>
        <button
          onClick={() => setShowYoutube(v => !v)}
          data-testid="youtube-btn"
          style={{
            background: showYoutube ? C.glassActive : 'rgba(255,255,255,0.06)',
            border: `1px solid ${showYoutube ? C.borderActive : C.border}`,
            borderRadius: '8px', color: C.text, padding: '8px 16px', fontSize: '12px',
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          ▼ YouTube Import
        </button>
      </div>

      {/* Generate panel */}
      {showGenerate && (
        <div style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${C.border}`, borderRadius: '10px', padding: '16px' }}>
          <MusicPlayer
            projectId={activeProjectId}
            selectedLyrics={selectedLyrics}
            onMusicGenerated={music => { refreshTracks(); setSelectedTrack(music); setShowGenerate(false); }}
          />
        </div>
      )}

      {/* YouTube panel */}
      {showYoutube && (
        <div style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${C.border}`, borderRadius: '10px', padding: '16px' }}>
          <YoutubeDownloader projectId={activeProjectId} onDownloaded={() => { refreshTracks(); setShowYoutube(false); }} />
        </div>
      )}

      {/* Track list */}
      <div data-testid="track-list">
        {tracks.length === 0 ? (
          <div style={{ color: C.textDim, textAlign: 'center', padding: '32px 0', fontSize: '13px' }}>
            No tracks yet — generate or import one above
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {tracks.map(track => (
              <TrackRow
                key={track.id}
                track={track}
                onDoubleClick={() => { setSelectedTrack(track); setActiveTab('craft'); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* A/B Comparator */}
      <ABComparator />
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/v4/tracks/ABComparator.tsx`** (stub for now)

```typescript
import { useState } from 'react';
import { C } from '../shared/colors';
import GlassPanel from '../shared/GlassPanel';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import type { MusicGeneration } from '../../../types';

export default function ABComparator() {
  const { tracks, playerTrack } = useWorkspace();
  const [slotA, setSlotA] = useState<MusicGeneration | null>(null);
  const [slotB, setSlotB] = useState<MusicGeneration | null>(null);
  const [activeSlot, setActiveSlot] = useState<'A' | 'B' | null>(null);
  const audioA = useState<HTMLAudioElement | null>(null)[0];
  const audioB = useState<HTMLAudioElement | null>(null)[0];

  const playSlot = (slot: 'A' | 'B') => {
    const track = slot === 'A' ? slotA : slotB;
    if (!track) return;
    const audio = new Audio(`/api/music/${track.id}/file`);
    audio.play().catch(() => {});
    setActiveSlot(slot);
  };

  const swap = () => {
    const tmp = slotA;
    setSlotA(slotB);
    setSlotB(tmp);
  };

  return (
    <GlassPanel style={{ padding: '12px', marginTop: '8px' }} data-testid="ab-comparator">
      <div style={{ color: C.textLabel, fontSize: '10px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: '8px' }}>
        A/B Compare
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {(['A', 'B'] as const).map(slot => {
          const track = slot === 'A' ? slotA : slotB;
          const setter = slot === 'A' ? setSlotA : setSlotB;
          return (
            <div key={slot} style={{ flex: 1 }}>
              <select
                value={track?.id ?? ''}
                onChange={e => setter(tracks.find(t => t.id === e.target.value) ?? null)}
                data-testid={`ab-slot-${slot.toLowerCase()}`}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
                  borderRadius: '6px', color: C.text, padding: '6px 8px', fontSize: '11px', outline: 'none',
                }}
              >
                <option value="">Slot {slot}</option>
                {tracks.map(t => <option key={t.id} value={t.id}>{t.title || `v${t.version}`}</option>)}
              </select>
              <button
                onClick={() => playSlot(slot)}
                disabled={!track}
                style={{
                  marginTop: '4px', width: '100%', background: activeSlot === slot ? C.red : 'rgba(255,255,255,0.08)',
                  border: 'none', borderRadius: '6px', color: '#fff', padding: '6px', fontSize: '11px',
                  cursor: track ? 'pointer' : 'not-allowed', fontWeight: 600,
                }}
              >▶ Play {slot}</button>
            </div>
          );
        })}
        <button
          onClick={swap}
          style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, padding: '8px', cursor: 'pointer', fontSize: '14px' }}
          title="Swap slots"
        >⇄</button>
      </div>
    </GlassPanel>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/v4/workspace/TabBar.tsx frontend/src/components/v4/tracks/TrackRow.tsx frontend/src/components/v4/workspace/SoundsTab.tsx frontend/src/components/v4/tracks/ABComparator.tsx
git commit -m "feat: v4 TabBar, TrackRow, SoundsTab, ABComparator"
```

---

### Task 6: WriteTab + CreateTab + CraftTab + ReleaseTab stub components

**Files:**
- Create: `frontend/src/components/v4/workspace/WriteTab.tsx`
- Create: `frontend/src/components/v4/workspace/CreateTab.tsx`
- Create: `frontend/src/components/v4/workspace/CraftTab.tsx`
- Create: `frontend/src/components/v4/shared/RemixSuggestions.tsx`
- Create: `frontend/src/components/v4/workspace/ReleaseTab.tsx`
- Create: `frontend/src/components/v4/release/ReadinessChecklist.tsx`
- Create: `frontend/src/components/v4/release/SocialExportPanel.tsx`

- [ ] **Step 1: Create `frontend/src/components/v4/workspace/WriteTab.tsx`**

```typescript
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import LyricsEditor from '../../LyricsEditor/LyricsEditor';
import type { LyricsGeneration } from '../../../types';

export default function WriteTab() {
  const { activeProjectId, setSelectedLyrics } = useWorkspace();

  if (!activeProjectId) {
    return <div style={{ color: C.textDim, textAlign: 'center', padding: '48px 0' }}>Select a project first</div>;
  }

  return (
    <div data-testid="write-tab">
      <LyricsEditor
        projectId={activeProjectId}
        onLyricsGenerated={(lyrics: LyricsGeneration) => setSelectedLyrics(lyrics)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/v4/workspace/CreateTab.tsx`**

```typescript
import { useState } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import ArtworkGenerator from '../../ArtworkGenerator/ArtworkGenerator';
import VideoPreview from '../../VideoPreview/VideoPreview';
import VoiceDesign from '../../VoiceDesign/VoiceDesign';

function Section({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }} data-testid={testId}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.04)', border: 'none', borderBottom: open ? `1px solid ${C.border}` : 'none',
          color: C.text, padding: '12px 16px', textAlign: 'left', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: 600,
        }}
      >
        {title}
        <span style={{ color: C.textDim, fontSize: '10px' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ padding: '16px' }}>{children}</div>}
    </div>
  );
}

export default function CreateTab() {
  const { activeProjectId, selectedTrack } = useWorkspace();

  if (!activeProjectId) {
    return <div style={{ color: C.textDim, textAlign: 'center', padding: '48px 0' }}>Select a project first</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} data-testid="create-tab">
      <Section title="Artwork" testId="section-artwork">
        <ArtworkGenerator projectId={activeProjectId} musicId={selectedTrack?.id} />
      </Section>
      <Section title="Video" testId="section-video">
        <VideoPreview projectId={activeProjectId} selectedMusic={selectedTrack ?? null} />
      </Section>
      <Section title="Voice" testId="section-voice">
        <VoiceDesign projectId={activeProjectId} />
      </Section>
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/v4/shared/RemixSuggestions.tsx`**

```typescript
import { C } from './colors';
import type { MusicGeneration } from '../../../types';

interface AudioOperations {
  reverbEnabled?: boolean;
  reverbRoomScale?: number;
  reverbWetLevel?: number;
  bassBoostEnabled?: boolean;
  bassBoostGainDb?: number;
  pitchShiftEnabled?: boolean;
  pitchShiftSemitones?: number;
  normalizeEnabled?: boolean;
  normalizeTargetLUFS?: number;
}

const PRESETS: { label: string; description: string; ops: AudioOperations }[] = [
  {
    label: 'Lo-fi Chill',
    description: 'Warm reverb, soft bass',
    ops: { reverbEnabled: true, reverbRoomScale: 40, reverbWetLevel: 0.25, bassBoostEnabled: true, bassBoostGainDb: 3 },
  },
  {
    label: 'Stadium Reverb',
    description: 'Big hall sound',
    ops: { reverbEnabled: true, reverbRoomScale: 90, reverbWetLevel: 0.5 },
  },
  {
    label: 'Gym Energy',
    description: 'Punchy bass, normalized',
    ops: { bassBoostEnabled: true, bassBoostGainDb: 8, normalizeEnabled: true, normalizeTargetLUFS: -10 },
  },
];

interface RemixSuggestionsProps {
  onApply: (ops: AudioOperations) => void;
}

export default function RemixSuggestions({ onApply }: RemixSuggestionsProps) {
  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ color: C.textLabel, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '10px' }}>
        AI Remix Suggestions
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {PRESETS.map(preset => (
          <button
            key={preset.label}
            onClick={() => onApply(preset.ops)}
            data-testid={`remix-${preset.label.toLowerCase().replace(/ /g, '-')}`}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
              borderRadius: '8px', padding: '10px 8px', cursor: 'pointer', textAlign: 'left',
              transition: 'all 150ms',
            }}
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = C.borderActive; (e.currentTarget as HTMLElement).style.background = C.glassActive; }}
            onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
          >
            <div style={{ color: C.text, fontSize: '12px', fontWeight: 600 }}>{preset.label}</div>
            <div style={{ color: C.textDim, fontSize: '10px', marginTop: '2px' }}>{preset.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/v4/workspace/CraftTab.tsx`**

```typescript
import { useState } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import AudioEditorPanel from '../../AudioEditor/AudioEditorPanel';
import MedleyPanel from '../../Medley/MedleyPanel';
import RemixSuggestions from '../shared/RemixSuggestions';

type CraftSubTab = 'editor' | 'medley';

export default function CraftTab() {
  const { activeProjectId, selectedTrack, tracks } = useWorkspace();
  const [subTab, setSubTab] = useState<CraftSubTab>('editor');

  if (!activeProjectId) {
    return <div style={{ color: C.textDim, textAlign: 'center', padding: '48px 0' }}>Select a project first</div>;
  }

  return (
    <div data-testid="craft-tab">
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        {([['editor', 'Audio Editor'], ['medley', 'Medley Mixer']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            style={{
              background: subTab === id ? C.glassActive : 'transparent',
              border: `1px solid ${subTab === id ? C.borderActive : C.border}`,
              borderRadius: '6px', color: subTab === id ? C.text : C.textDim,
              padding: '6px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}
          >{label}</button>
        ))}
      </div>

      {subTab === 'editor' && selectedTrack && (
        <>
          <AudioEditorPanel
            projectId={activeProjectId}
            audioUrl={`/api/music/${selectedTrack.id}/file`}
            trackId={selectedTrack.id}
            musicId={selectedTrack.id}
          />
          <RemixSuggestions onApply={ops => console.log('Apply remix ops:', ops)} />
        </>
      )}

      {subTab === 'editor' && !selectedTrack && (
        <div style={{ color: C.textDim, textAlign: 'center', padding: '32px 0' }}>
          Select a track from SOUNDS to edit
        </div>
      )}

      {subTab === 'medley' && (
        <MedleyPanel projectId={activeProjectId} musicList={tracks} />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `frontend/src/components/v4/release/ReadinessChecklist.tsx`**

```typescript
import { C } from '../shared/colors';
import type { MusicGeneration } from '../../../types';

interface ReadinessChecklistProps {
  track: MusicGeneration | null;
  artworkUrl?: string | null;
  hasLyrics?: boolean;
}

export default function ReadinessChecklist({ track, artworkUrl, hasLyrics }: ReadinessChecklistProps) {
  if (!track) return null;

  const checks = [
    { label: 'Has artwork',       pass: !!artworkUrl },
    { label: 'Has lyrics',        pass: !!hasLyrics },
    { label: 'Duration > 60s',    pass: (track.duration_seconds ?? 0) > 60 },
    { label: 'Title is not generic', pass: !!(track.title && !/^(version|track|v)\s*\d*/i.test(track.title)) },
    { label: 'Audio file exists', pass: !!(track.original_file_path || track.processed_file_path) },
  ];

  const passed = checks.filter(c => c.pass).length;

  return (
    <div data-testid="readiness-checklist">
      <div style={{ color: C.textLabel, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '10px' }}>
        Release Readiness — {passed}/{checks.length}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {checks.map(c => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: c.pass ? '#4ade80' : C.textDim }}>
            <span>{c.pass ? '✅' : '⚠️'}</span>
            <span>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create `frontend/src/components/v4/release/SocialExportPanel.tsx`**

```typescript
import { useState } from 'react';
import { C } from '../shared/colors';
import type { MusicGeneration } from '../../../types';

const PRESETS = [
  { id: 'tiktok',  label: 'TikTok',           desc: '60s clip' },
  { id: 'reels',   label: 'Instagram Reels',   desc: '30s clip' },
  { id: 'shorts',  label: 'YouTube Shorts',    desc: '60s clip' },
  { id: 'full',    label: 'Full Track',         desc: 'No trim' },
];

interface SocialExportPanelProps {
  track: MusicGeneration | null;
}

export default function SocialExportPanel({ track }: SocialExportPanelProps) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportTrack = async (preset: string) => {
    if (!track) return;
    setExporting(preset);
    setError(null);
    try {
      const res = await fetch('/api/audio/social-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ musicId: track.id, preset }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? 'Export failed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(track.title || 'track').replace(/[^a-zA-Z0-9-_]/g, '_')}_${preset}.mp3`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div data-testid="social-export-panel">
      <div style={{ color: C.textLabel, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '10px' }}>
        Social Export Presets
      </div>
      {error && <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '8px' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => exportTrack(p.id)}
            disabled={!track || exporting === p.id}
            data-testid={`export-${p.id}`}
            style={{
              background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: '8px',
              padding: '12px', cursor: track ? 'pointer' : 'not-allowed', textAlign: 'left',
              opacity: !track ? 0.5 : 1,
            }}
          >
            <div style={{ color: exporting === p.id ? C.gold : C.text, fontSize: '12px', fontWeight: 600 }}>
              {exporting === p.id ? 'Exporting…' : p.label}
            </div>
            <div style={{ color: C.textDim, fontSize: '10px', marginTop: '2px' }}>{p.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create `frontend/src/components/v4/workspace/ReleaseTab.tsx`**

```typescript
import { useState, useEffect } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import AudioMasteringPanel from '../../Mastering/AudioMasteringPanel';
import ReadinessChecklist from '../release/ReadinessChecklist';
import SocialExportPanel from '../release/SocialExportPanel';

export default function ReleaseTab() {
  const { activeProjectId, selectedTrack, tracks } = useWorkspace();
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [hasLyrics, setHasLyrics] = useState(false);

  useEffect(() => {
    if (!activeProjectId) return;
    fetch(`/api/projects/${activeProjectId}/artwork`)
      .then(r => r.ok && r.status !== 204 ? r.blob() : null)
      .then(blob => setArtworkUrl(blob ? URL.createObjectURL(blob) : null))
      .catch(() => {});
    fetch(`/api/projects/${activeProjectId}/lyrics`)
      .then(r => r.json())
      .then((list: unknown[]) => setHasLyrics(Array.isArray(list) && list.length > 0))
      .catch(() => {});
  }, [activeProjectId]);

  if (!activeProjectId) {
    return <div style={{ color: C.textDim, textAlign: 'center', padding: '48px 0' }}>Select a project first</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} data-testid="release-tab">
      <ReadinessChecklist track={selectedTrack} artworkUrl={artworkUrl} hasLyrics={hasLyrics} />
      <hr style={{ border: 'none', borderTop: `1px solid ${C.border}` }} />
      <SocialExportPanel track={selectedTrack} />
      <hr style={{ border: 'none', borderTop: `1px solid ${C.border}` }} />
      <div>
        <div style={{ color: C.textLabel, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '12px' }}>
          Mastering
        </div>
        <AudioMasteringPanel projectId={activeProjectId} allMusic={tracks} />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/v4/workspace/WriteTab.tsx frontend/src/components/v4/workspace/CreateTab.tsx frontend/src/components/v4/shared/RemixSuggestions.tsx frontend/src/components/v4/workspace/CraftTab.tsx frontend/src/components/v4/release/ReadinessChecklist.tsx frontend/src/components/v4/release/SocialExportPanel.tsx frontend/src/components/v4/workspace/ReleaseTab.tsx
git commit -m "feat: v4 Write/Create/Craft/Release tabs + ReadinessChecklist + SocialExportPanel + RemixSuggestions"
```

---

### Task 7: RightPanel — track card + notes + quick actions

**Files:**
- Create: `frontend/src/components/v4/layout/RightPanel.tsx`

- [ ] **Step 1: Create `frontend/src/components/v4/layout/RightPanel.tsx`**

```typescript
import { useState, useEffect } from 'react';
import { C } from '../shared/colors';
import GlassPanel from '../shared/GlassPanel';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import type { MusicNote, MusicTags } from '../../../types';

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function RightPanel() {
  const { selectedTrack, playTrack, setActiveTab, playerCurrentTime } = useWorkspace();
  const [notes, setNotes] = useState<MusicNote[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [tags, setTags] = useState<MusicTags>({ bpm: null, key: null, mood: null });
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const { activeProjectId } = useWorkspace();

  useEffect(() => {
    if (!selectedTrack) return;
    setNotes([]);
    setTags({ bpm: null, key: null, mood: null });
    fetch(`/api/music/${selectedTrack.id}/notes`).then(r => r.json()).then(setNotes).catch(() => {});
    fetch(`/api/music/${selectedTrack.id}/tags`).then(r => r.json()).then(setTags).catch(() => {});
  }, [selectedTrack?.id]);

  const addNote = async () => {
    if (!selectedTrack || !newNoteText.trim()) return;
    const res = await fetch(`/api/music/${selectedTrack.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp_sec: playerCurrentTime, text: newNoteText.trim() }),
    });
    const note: MusicNote = await res.json();
    setNotes(prev => [...prev, note].sort((a, b) => a.timestamp_sec - b.timestamp_sec));
    setNewNoteText('');
  };

  const deleteNote = async (noteId: string) => {
    await fetch(`/api/music/${selectedTrack!.id}/notes/${noteId}`, { method: 'DELETE' });
    setNotes(prev => prev.filter(n => n.id !== noteId));
  };

  const generateShare = async () => {
    if (!activeProjectId) return;
    const res = await fetch(`/api/projects/${activeProjectId}/share`, { method: 'POST' });
    const data = await res.json();
    setShareUrl(`${window.location.origin}/#/share/${data.token}`);
  };

  if (!selectedTrack) {
    return (
      <GlassPanel style={{ padding: '16px', height: '100%' }}>
        <div style={{ color: C.textDim, fontSize: '12px', textAlign: 'center', marginTop: '48px' }}>
          Select a track to see details
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflow: 'auto' }} data-testid="right-panel-track">
      {/* Track card */}
      <div>
        {/* Artwork placeholder */}
        <div style={{
          width: '100%', aspectRatio: '1', background: `linear-gradient(135deg, ${C.redDark}, #0a0102)`,
          borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '12px', border: `1px solid ${C.border}`,
        }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="15" stroke={C.border} strokeWidth="2"/>
            <circle cx="20" cy="20" r="5" fill={C.red} opacity="0.5"/>
          </svg>
        </div>

        <div style={{ color: C.text, fontSize: '14px', fontWeight: 600, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedTrack.title || `Track v${selectedTrack.version}`}
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {tags.bpm && <span style={{ background: C.glassActive, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '2px 6px', fontSize: '10px', color: C.gold }}>{Math.round(tags.bpm)} BPM</span>}
          {tags.key && <span style={{ background: C.glassActive, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '2px 6px', fontSize: '10px', color: C.text }}>{tags.key}</span>}
          {selectedTrack.duration_seconds && <span style={{ background: C.glassActive, border: `1px solid ${C.border}`, borderRadius: '4px', padding: '2px 6px', fontSize: '10px', color: C.textDim }}>
            {fmtTime(selectedTrack.duration_seconds)}
          </span>}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {[
          { label: '▶ Play', action: () => playTrack(selectedTrack), testId: 'action-play' },
          { label: '✎ Edit', action: () => setActiveTab('craft'), testId: 'action-edit' },
          { label: '⬆ Master', action: () => setActiveTab('release'), testId: 'action-master' },
          { label: '📤 Export', action: () => setActiveTab('release'), testId: 'action-export' },
        ].map(({ label, action, testId }) => (
          <button
            key={testId}
            onClick={action}
            data-testid={testId}
            style={{
              background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: '6px',
              color: C.text, padding: '8px 6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            }}
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = C.borderActive; }}
            onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
          >{label}</button>
        ))}
      </div>

      {/* Share */}
      <div>
        <button
          onClick={generateShare}
          data-testid="action-share"
          style={{
            width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
            borderRadius: '6px', color: C.textDim, padding: '8px', fontSize: '11px', cursor: 'pointer',
          }}
        >🔗 Generate Share Link</button>
        {shareUrl && (
          <div
            onClick={() => navigator.clipboard.writeText(shareUrl).catch(() => {})}
            data-testid="share-url"
            style={{
              marginTop: '6px', padding: '6px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px',
              color: C.gold, fontSize: '10px', cursor: 'pointer', wordBreak: 'break-all',
            }}
            title="Click to copy"
          >{shareUrl}</div>
        )}
      </div>

      {/* Track notes */}
      <div>
        <div style={{ color: C.textLabel, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '8px' }}>
          Track Notes
        </div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <input
            value={newNoteText}
            onChange={e => setNewNoteText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addNote()}
            placeholder={`Note at ${fmtTime(playerCurrentTime)}…`}
            data-testid="note-input"
            style={{
              flex: 1, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
              borderRadius: '6px', padding: '6px 8px', color: C.text, fontSize: '11px', outline: 'none',
            }}
          />
          <button
            onClick={addNote}
            disabled={!newNoteText.trim()}
            data-testid="add-note-btn"
            style={{ background: C.red, border: 'none', borderRadius: '6px', color: '#fff', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}
          >+</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {notes.map(n => (
            <div key={n.id} data-testid={`note-${n.id}`}
              style={{ display: 'flex', gap: '6px', padding: '6px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', fontSize: '11px' }}>
              <span style={{ color: C.gold, fontFamily: 'monospace', flexShrink: 0 }}>{fmtTime(n.timestamp_sec)}</span>
              <span style={{ color: C.text, flex: 1 }}>{n.text}</span>
              <button onClick={() => deleteNote(n.id)} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', padding: '0', lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/v4/layout/RightPanel.tsx
git commit -m "feat: v4 RightPanel — track card, tags, notes, quick actions, share link"
```

---

### Task 8: PlayerBar

**Files:**
- Create: `frontend/src/components/v4/layout/PlayerBar.tsx`

- [ ] **Step 1: Create `frontend/src/components/v4/layout/PlayerBar.tsx`**

```typescript
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';

function fmtTime(s: number) {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function PlayerBar() {
  const { playerTrack, playerIsPlaying, playerProgress, playerCurrentTime, playerDuration, playerVolume,
          togglePlay, seekTo, setPlayerVolume, playNext, playPrev } = useWorkspace();

  return (
    <div style={{
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(20px)',
      borderTop: `1px solid ${C.border}`,
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
    }} data-testid="player-bar">
      {/* Track info */}
      <div style={{ width: '200px', flexShrink: 0 }}>
        {playerTrack ? (
          <>
            <div style={{ color: C.text, fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {playerTrack.title || `Track v${playerTrack.version}`}
            </div>
            <div style={{ color: C.textDim, fontSize: '10px', marginTop: '2px' }}>
              {fmtTime(playerCurrentTime)} / {fmtTime(playerDuration)}
            </div>
          </>
        ) : (
          <div style={{ color: C.textDim, fontSize: '11px' }}>No track selected</div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <button onClick={playPrev} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: '14px', padding: '4px' }}>⏮</button>
        <button
          onClick={togglePlay}
          data-testid="player-play-pause"
          style={{
            width: '36px', height: '36px', borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: playerIsPlaying ? C.red : 'rgba(255,255,255,0.15)',
            color: '#fff', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: playerIsPlaying ? `0 0 12px ${C.red}66` : 'none',
            transition: 'all 200ms',
          }}
        >
          {playerIsPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={playNext} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: '14px', padding: '4px' }}>⏭</button>
      </div>

      {/* Progress bar */}
      <div
        style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', cursor: 'pointer', position: 'relative' }}
        onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          seekTo((e.clientX - rect.left) / rect.width);
        }}
        data-testid="player-progress"
      >
        <div style={{
          height: '100%',
          width: `${playerProgress * 100}%`,
          background: `linear-gradient(to right, ${C.red}, ${C.gold})`,
          borderRadius: '2px',
          transition: 'width 0.1s linear',
        }} />
        {/* Scrubber dot */}
        <div style={{
          position: 'absolute', top: '50%', left: `${playerProgress * 100}%`,
          transform: 'translate(-50%, -50%)',
          width: '10px', height: '10px', borderRadius: '50%', background: C.text,
          boxShadow: '0 0 4px rgba(0,0,0,0.5)',
        }} />
      </div>

      {/* Volume */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <span style={{ color: C.textDim, fontSize: '12px' }}>🔊</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={playerVolume}
          onChange={e => setPlayerVolume(Number(e.target.value))}
          data-testid="volume-slider"
          style={{ width: '80px', accentColor: C.red, cursor: 'pointer' }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/v4/layout/PlayerBar.tsx
git commit -m "feat: v4 PlayerBar — play/pause/prev/next, progress scrubber, volume"
```

---

### Task 9: ShareView page + App.tsx wiring

**Files:**
- Create: `frontend/src/pages/ShareView.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/pages/ShareView.tsx`**

```typescript
import { useState, useEffect } from 'react';
import { C } from '../components/v4/shared/colors';
import type { Project, MusicGeneration } from '../types';

interface ShareData {
  project: Project;
  music: MusicGeneration[];
  expiresAt: string;
}

interface ShareViewProps {
  token: string;
}

export default function ShareView({ token }: ShareViewProps) {
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then(r => r.ok ? r.json() : r.json().then((e: { error?: string }) => { throw new Error(e.error ?? 'Not found'); }))
      .then(setData)
      .catch(err => setError(err.message));
  }, [token]);

  const playTrack = (id: string) => {
    const audio = new Audio(`/api/music/${id}/file`);
    audio.play().catch(() => {});
    setPlayingId(id);
    audio.addEventListener('ended', () => setPlayingId(null));
  };

  if (error) {
    return (
      <div style={{ background: C.bgApp, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.textDim, textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔗</div>
          <div style={{ color: C.text, fontSize: '18px', fontWeight: 600 }}>Share link not found or expired</div>
          <div style={{ color: C.textDim, fontSize: '13px', marginTop: '8px' }}>{error}</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ background: C.bgApp, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.textDim }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bgApp, minHeight: '100vh', padding: '40px 24px', fontFamily: "'SF Pro Text', Inter, sans-serif" }} data-testid="share-view">
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke={C.red} strokeWidth="2"/>
            <path d="M10 8L20 14L10 20V8Z" fill={C.red}/>
          </svg>
          <div>
            <div style={{ color: C.text, fontSize: '20px', fontWeight: 700 }}>{data.project.name}</div>
            <div style={{ color: C.textDim, fontSize: '12px' }}>Shared via RedInside Music Studio · Read-only</div>
          </div>
        </div>

        {/* Track list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {data.music.length === 0 && (
            <div style={{ color: C.textDim, textAlign: 'center', padding: '32px' }}>No tracks in this project</div>
          )}
          {data.music.map(track => (
            <div
              key={track.id}
              data-testid={`share-track-${track.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(18px)', border: `1px solid ${C.border}`,
                borderRadius: '10px', padding: '12px 16px',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ color: C.text, fontSize: '14px', fontWeight: 500 }}>{track.title || `Track v${track.version}`}</div>
                {track.duration_seconds && (
                  <div style={{ color: C.textDim, fontSize: '11px', marginTop: '2px' }}>
                    {Math.floor(track.duration_seconds / 60)}:{String(Math.floor(track.duration_seconds % 60)).padStart(2, '0')}
                  </div>
                )}
              </div>
              <button
                onClick={() => playTrack(track.id)}
                style={{
                  width: '36px', height: '36px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: playingId === track.id ? C.red : 'rgba(255,255,255,0.12)', color: '#fff', fontSize: '12px',
                }}
              >{playingId === track.id ? '⏸' : '▶'}</button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '24px', color: C.textDim, fontSize: '11px', textAlign: 'center' }}>
          Expires {new Date(data.expiresAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Modify `frontend/src/App.tsx`**

Read `frontend/src/App.tsx` first. Make these changes:

**a.** Add import at the top:
```typescript
import StudioV4 from './pages/StudioV4';
import ShareView from './pages/ShareView';
```

**b.** In the `currentView` state initialization, add a `share` case and extract the share token. Replace the existing `useState` for `currentView`:

```typescript
const [currentView, setCurrentView] = useState<'studio' | 'history' | 'viral' | 'settings' | 'share'>(() => {
  if (window.location.hash.startsWith('#/share/')) return 'share';
  if (window.location.hash === '#/history') return 'history';
  if (window.location.hash === '#/viral') return 'viral';
  if (window.location.hash === '#/settings') return 'settings';
  return 'studio';
});

const [shareToken, setShareToken] = useState<string>(() => {
  const match = window.location.hash.match(/^#\/share\/(.+)$/);
  return match ? match[1] : '';
});
```

**c.** In the `handleHashChange` listener, add:
```typescript
else if (window.location.hash.startsWith('#/share/')) {
  const match = window.location.hash.match(/^#\/share\/(.+)$/);
  if (match) { setShareToken(match[1]); setCurrentView('share'); }
}
```

**d.** Replace the main render block — change `<Studio ... />` to `<StudioV4 />` and add the share view. In the JSX where views are rendered, replace the studio branch:
```typescript
{currentView === 'share' ? (
  <ShareView token={shareToken} />
) : currentView === 'history' ? (
  <History />
) : currentView === 'viral' ? (
  <ViralToolkit />
) : currentView === 'settings' ? (
  <Settings />
) : (
  <StudioV4 />
)}
```

Note: The share view renders full-screen so remove the `<main>` wrapper for it. Wrap in a conditional:
```typescript
{currentView === 'share' ? (
  <ShareView token={shareToken} />
) : (
  <>
    <header ...>...</header>
    <main ...>
      {currentView === 'history' ? <History /> :
       currentView === 'viral' ? <ViralToolkit /> :
       currentView === 'settings' ? <Settings /> :
       <StudioV4 />}
    </main>
  </>
)}
```

- [ ] **Step 3: Verify TS**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```
Fix any errors before committing.

- [ ] **Step 4: Start dev server and verify renders**

```bash
cd frontend && npm run dev &
sleep 4
curl -s http://localhost:5173 | grep -o '<title>[^<]*</title>'
```
Expected: `<title>Vite + React + TS</title>` or similar (page served).

Open browser at `http://localhost:5173` and confirm:
- StudioV4 DAW layout renders with sidebar, centre tabs, right panel
- No console errors for missing components
- All 5 tabs clickable

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ShareView.tsx frontend/src/App.tsx
git commit -m "feat: ShareView page + App.tsx routes to StudioV4 as default"
```

---

### Task 10: Playwright E2E tests

**Files:**
- Create: `frontend/tests/e2e/v4-workspace.spec.ts`
- Create: `frontend/tests/e2e/v4-sounds.spec.ts`
- Create: `frontend/tests/e2e/v4-playlists.spec.ts`
- Create: `frontend/tests/e2e/v4-release.spec.ts`
- Create: `frontend/tests/e2e/v4-share.spec.ts`

> **Testing rules (from CLAUDE.md):** Tests must exercise real browser against real backend. No `page.route()` mocks. Use seed endpoint via `page.request.post`.

- [ ] **Step 1: Create `frontend/tests/e2e/v4-workspace.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test.describe('StudioV4 Workspace', () => {
  test('DAW layout renders — sidebar, centre, right panel, player bar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="left-sidebar"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="centre-panel"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="right-panel"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="player-bar"]')).toBeVisible({ timeout: 5000 });
  });

  test('all 5 tabs are clickable and switch content', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="tab-bar"]')).toBeVisible({ timeout: 5000 });

    for (const tab of ['sounds', 'write', 'create', 'craft', 'release']) {
      await page.locator(`[data-testid="tab-${tab}"]`).click();
      await expect(page.locator(`[data-testid="tab-${tab}"]`)).toHaveCSS('color', 'rgb(230, 57, 70)');
    }
  });

  test('creating a project loads it into the workspace', async ({ page }) => {
    const name = `WorkspaceTest-${Date.now()}`;
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('[data-testid="new-project-input"]').fill(name);
    await page.locator('[data-testid="create-project-btn"]').click();
    await page.waitForTimeout(1000);

    await expect(page.locator(`text=${name}`)).toBeVisible({ timeout: 5000 });

    // Cleanup
    await page.request.delete(`http://localhost:3000/api/projects/${
      await page.request.get('http://localhost:3000/api/projects')
        .then(r => r.json())
        .then((ps: { id: string; name: string }[]) => ps.find(p => p.name === name)?.id ?? '')
    }`).catch(() => {});
  });

  test('player bar shows no track when nothing selected', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="player-bar"]')).toContainText('No track selected');
  });
});
```

- [ ] **Step 2: Create `frontend/tests/e2e/v4-sounds.spec.ts`**

```typescript
import { test, expect, Page } from '@playwright/test';

async function seedAndOpen(page: Page) {
  const name = `SoundsTest-${Date.now()}`;
  const { project, music } = await page.request.post('http://localhost:3000/api/test/seed-project', {
    data: { name, music: true },
  }).then(r => r.json());

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.locator(`[data-testid="project-item-${project.id}"]`).click();
  await page.waitForTimeout(1000);

  return { project, music };
}

test.describe('SoundsTab', () => {
  test('track list shows seeded tracks', async ({ page }) => {
    const { project, music } = await seedAndOpen(page);

    await page.locator('[data-testid="tab-sounds"]').click();
    await expect(page.locator('[data-testid="track-list"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`[data-testid="track-row-${music[0].id}"]`)).toBeVisible({ timeout: 5000 });

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('clicking track selects it and shows in right panel', async ({ page }) => {
    const { project, music } = await seedAndOpen(page);

    await page.locator('[data-testid="tab-sounds"]').click();
    await page.locator(`[data-testid="track-row-${music[0].id}"]`).click();
    await page.waitForTimeout(500);

    await expect(page.locator('[data-testid="right-panel-track"]')).toBeVisible({ timeout: 5000 });

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('Generate New button expands inline panel', async ({ page }) => {
    const { project } = await seedAndOpen(page);

    await page.locator('[data-testid="tab-sounds"]').click();
    await page.locator('[data-testid="generate-btn"]').click();
    await expect(page.locator('text=Generate')).toBeVisible({ timeout: 3000 });

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('YouTube Import button expands YoutubeDownloader', async ({ page }) => {
    const { project } = await seedAndOpen(page);

    await page.locator('[data-testid="tab-sounds"]').click();
    await page.locator('[data-testid="youtube-btn"]').click();
    await expect(page.locator('text=YouTube').first()).toBeVisible({ timeout: 3000 });

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('play button starts player bar track', async ({ page }) => {
    const { project, music } = await seedAndOpen(page);

    await page.locator('[data-testid="tab-sounds"]').click();
    await page.locator(`[data-testid="play-btn-${music[0].id}"]`).click();
    await page.waitForTimeout(1000);

    // Player bar should now show the track title or version
    const playerBar = page.locator('[data-testid="player-bar"]');
    await expect(playerBar).not.toContainText('No track selected');

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });
});
```

- [ ] **Step 3: Create `frontend/tests/e2e/v4-playlists.spec.ts`**

```typescript
import { test, expect, Page } from '@playwright/test';

async function createAndSeedProject(page: Page) {
  return page.request.post('http://localhost:3000/api/test/seed-project', {
    data: { name: `PlaylistE2E-${Date.now()}`, music: true },
  }).then(r => r.json());
}

test.describe('Playlists', () => {
  test('create playlist appears in sidebar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const plName = `E2EPlaylist-${Date.now()}`;
    await page.locator('[data-testid="new-playlist-input"]').fill(plName);
    await page.locator('[data-testid="create-playlist-btn"]').click();
    await page.waitForTimeout(500);

    await expect(page.locator(`text=${plName}`)).toBeVisible({ timeout: 5000 });

    // Cleanup via API
    const playlists = await page.request.get('http://localhost:3000/api/playlists').then(r => r.json());
    const pl = playlists.find((p: { name: string; id: string }) => p.name === plName);
    if (pl) await page.request.delete(`http://localhost:3000/api/playlists/${pl.id}`).catch(() => {});
  });

  test('smart playlists are visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="smart-playlist-__all_mastered"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="smart-playlist-__instrumentals"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="smart-playlist-__unmastered"]')).toBeVisible({ timeout: 5000 });
  });

  test('delete playlist removes it from sidebar', async ({ page }) => {
    // Create via API then verify visible + delete via UI
    const { id: plId } = await page.request.post('http://localhost:3000/api/playlists', {
      data: { name: `ToDelete-${Date.now()}` },
    }).then(r => r.json());

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const item = page.locator(`[data-testid="playlist-item-${plId}"]`);
    await expect(item).toBeVisible({ timeout: 5000 });

    // Click the × delete button inside the item
    await item.locator('button').click();
    await page.waitForTimeout(500);

    await expect(page.locator(`[data-testid="playlist-item-${plId}"]`)).not.toBeVisible();
  });
});
```

- [ ] **Step 4: Create `frontend/tests/e2e/v4-release.spec.ts`**

```typescript
import { test, expect, Page } from '@playwright/test';

async function seedAndOpenRelease(page: Page) {
  const { project, music } = await page.request.post('http://localhost:3000/api/test/seed-project', {
    data: { name: `ReleaseTest-${Date.now()}`, music: true },
  }).then(r => r.json());

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.locator(`[data-testid="project-item-${project.id}"]`).click();
  await page.waitForTimeout(800);
  await page.locator(`[data-testid="track-row-${music[0].id}"]`).click();
  await page.waitForTimeout(500);
  await page.locator('[data-testid="tab-release"]').click();
  await page.waitForTimeout(500);

  return { project, music };
}

test.describe('Release Tab', () => {
  test('readiness checklist is visible', async ({ page }) => {
    const { project } = await seedAndOpenRelease(page);
    await expect(page.locator('[data-testid="readiness-checklist"]')).toBeVisible({ timeout: 5000 });
    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('social export panel shows preset buttons', async ({ page }) => {
    const { project } = await seedAndOpenRelease(page);
    await expect(page.locator('[data-testid="social-export-panel"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="export-tiktok"]')).toBeVisible();
    await expect(page.locator('[data-testid="export-reels"]')).toBeVisible();
    await expect(page.locator('[data-testid="export-full"]')).toBeVisible();
    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('social export full preset downloads MP3', async ({ page }) => {
    const { project, music } = await seedAndOpenRelease(page);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.locator('[data-testid="export-full"]').click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.mp3$/);

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });
});
```

- [ ] **Step 5: Create `frontend/tests/e2e/v4-share.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Share Links', () => {
  test('share button generates link displayed in right panel', async ({ page }) => {
    const { project, music } = await page.request.post('http://localhost:3000/api/test/seed-project', {
      data: { name: `ShareE2E-${Date.now()}`, music: true },
    }).then(r => r.json());

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator(`[data-testid="project-item-${project.id}"]`).click();
    await page.waitForTimeout(800);
    await page.locator(`[data-testid="track-row-${music[0].id}"]`).click();
    await page.waitForTimeout(500);

    await page.locator('[data-testid="action-share"]').click();
    await page.waitForTimeout(1000);

    const shareUrlEl = page.locator('[data-testid="share-url"]');
    await expect(shareUrlEl).toBeVisible({ timeout: 5000 });
    const shareUrl = await shareUrlEl.textContent();
    expect(shareUrl).toMatch(/\/share\//);

    // Extract token and verify share view
    const token = shareUrl!.split('/share/')[1];
    await page.goto(`/#/share/${token}`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="share-view"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator(`text=${project.name}`)).toBeVisible();

    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });

  test('invalid share token shows error page', async ({ page }) => {
    await page.goto('/#/share/totally-invalid-token-xyz');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Share link not found or expired')).toBeVisible({ timeout: 5000 });
  });
});
```

- [ ] **Step 6: Run all new E2E tests**

Ensure backend and mock server are running:
```bash
kill $(lsof -ti:3000) 2>/dev/null; kill $(lsof -ti:8999) 2>/dev/null; sleep 1
cd /Users/admin/Anurag/Development/Codebase/ai/RedInside-Music-Studio/backend
node tests/minimax-mock-server.js &
MINIMAX_BASE_URL=http://localhost:8999 node src/server.js &
sleep 3
```

Run new tests:
```bash
cd /Users/admin/Anurag/Development/Codebase/ai/RedInside-Music-Studio/frontend
npx playwright test tests/e2e/v4-workspace.spec.ts tests/e2e/v4-sounds.spec.ts tests/e2e/v4-playlists.spec.ts tests/e2e/v4-release.spec.ts tests/e2e/v4-share.spec.ts --reporter=list 2>&1 | tail -40
```

All tests must pass. If any fail, diagnose by reading the error and fix the IMPLEMENTATION (not the test). Re-run after each fix.

- [ ] **Step 7: Run full Playwright suite — confirm no regressions**

```bash
npx playwright test --reporter=list 2>&1 | tail -20
```
Zero failing tests allowed.

- [ ] **Step 8: Commit**

```bash
git add frontend/tests/e2e/v4-workspace.spec.ts frontend/tests/e2e/v4-sounds.spec.ts frontend/tests/e2e/v4-playlists.spec.ts frontend/tests/e2e/v4-release.spec.ts frontend/tests/e2e/v4-share.spec.ts
git commit -m "test: v4 Playwright E2E — workspace, sounds, playlists, release, share"
```

---

### Task 11: Push frontend branch

- [ ] **Step 1: Push**

```bash
git push origin feat/phase4-redesign
```

- [ ] **Step 2: Verify**

```bash
git log --oneline origin/feat/phase4-redesign | head -15
```

Expected: all Phase 4 backend + frontend commits visible.

---

## Self-Review Checklist

### Spec coverage

| Spec requirement | Task covering it |
|-----------------|-----------------|
| DAW 3-column layout | Task 2 (AppShell) |
| Red-black liquid glass aesthetic | Task 1 (colors.ts), all panels use GlassPanel |
| SOUNDS tab — track list, generate, YouTube, A/B | Task 5 |
| WRITE tab — LyricsEditor | Task 6 |
| CREATE tab — Artwork + Video + Voice | Task 6 |
| CRAFT tab — AudioEditor + Medley + Remix suggestions | Task 6 |
| RELEASE tab — Mastering + checklist + social export | Task 6 |
| Left sidebar — projects | Task 3 |
| Left sidebar — playlists (manual + smart) | Task 4 |
| Left sidebar — More (History/Viral/Settings) | Task 3 |
| Right panel — track card + tags + notes + share | Task 7 |
| Persistent PlayerBar | Task 8 |
| ShareView read-only page | Task 9 |
| App.tsx routing to StudioV4 | Task 9 |
| Playlist CRUD via `/api/playlists` | Task 4 |
| Music notes via `/api/music/:id/notes` | Task 7 |
| Music tags (BPM/key) via `/api/music/:id/tags` | Task 7 |
| Social export via `/api/audio/social-export` | Task 6 |
| Share tokens via `/api/projects/:id/share` | Task 7, 9 |
| Playwright E2E tests (5 spec files) | Task 10 |

### Type consistency check

- `V4Tab` defined in `types.ts` (Task 1) — used in `WorkspaceContext`, `TabBar`, `CentreWorkspace` ✓
- `Playlist` type has `track_count`, `id`, `name`, `created_at`, `updated_at` — matches API response ✓
- `MusicNote` has `id`, `music_id`, `timestamp_sec`, `text`, `created_at` — matches API response ✓
- `MusicTags` has `bpm`, `key`, `mood` (all nullable) — matches `/api/music/:id/tags` response ✓
- `AudioEditorPanel` needs `projectId`, `audioUrl`, `trackId` — provided in CraftTab ✓
- `MedleyPanel` needs `projectId`, `musicList: MusicGeneration[]` — provided in CraftTab ✓
- `AudioMasteringPanel` needs `projectId`, `allMusic: any[]` — provided in ReleaseTab ✓
- `LyricsEditor` needs `projectId`, `onLyricsGenerated` — provided in WriteTab ✓
- `ArtworkGenerator` needs `projectId`, `musicId?` — provided in CreateTab ✓
- `VideoPreview` needs `projectId`, `selectedMusic` — provided in CreateTab ✓
- `YoutubeDownloader` needs `projectId`, `onDownloaded?` — provided in SoundsTab ✓

### No placeholder check ✓

All steps contain actual working code. No "TODO" or "implement later" present.
