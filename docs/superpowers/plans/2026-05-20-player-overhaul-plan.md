# Player Overhaul Plan — 2026-05-20

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the PlayerBar with drag-to-seek, loop/shuffle toggles, keyboard shortcuts, mute button, and an Up Next queue popover — all wired to WorkspaceContext state.

**Files:**
- `frontend/src/contexts/WorkspaceContext.tsx` — Tasks 1
- `frontend/src/components/v4/layout/PlayerBar.tsx` — Tasks 2-6

---

## Task 1: WorkspaceContext — loop/shuffle state + playNext shuffle logic

**File:** `frontend/src/contexts/WorkspaceContext.tsx`

### 1a. Extend `WorkspaceContextType` interface
After `playPrev: () => void;`, add:
```ts
  isLooping: boolean;
  isShuffled: boolean;
  toggleLoop: () => void;
  toggleShuffle: () => void;
```

### 1b. Add state after `isMockMode`
```ts
const [isLooping, setIsLooping] = useState(false);
const [isShuffled, setIsShuffled] = useState(false);
```

### 1c. Add toggles after setPlayerVolume
```ts
const toggleLoop = useCallback(() => setIsLooping(v => !v), []);
const toggleShuffle = useCallback(() => setIsShuffled(v => !v), []);
```

### 1d. Update playNext
```ts
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
```

### 1e. Update ended listener in playTrack
```ts
audio.addEventListener('ended', () => {
  if (isLooping) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } else {
    setPlayerIsPlaying(false);
  }
});
```
Also add `isLooping` to `playTrack`'s dependency array.

### 1f. Add to provider value
```ts
isLooping, isShuffled, toggleLoop, toggleShuffle,
```

- [ ] Add interface fields, state, toggles, updated playNext + ended listener, provider exports
- [ ] Commit: `feat(context): add loop/shuffle state and playNext shuffle logic`

---

## Task 2: PlayerBar — drag-to-seek

**File:** `frontend/src/components/v4/layout/PlayerBar.tsx`

Update import: `import { useState, useRef, useEffect, useCallback } from 'react';`

Add state after titleDraft:
```ts
const isDragging = useRef(false);
const [dragProgress, setDragProgress] = useState<number | null>(null);
const progressBarRef = useRef<HTMLDivElement>(null);
```

Add helpers after saveTitle:
```ts
const getFractionFromMouseEvent = useCallback((clientX: number): number => {
  if (!progressBarRef.current) return 0;
  const rect = progressBarRef.current.getBoundingClientRect();
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
}, []);

useEffect(() => {
  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    setDragProgress(getFractionFromMouseEvent(e.clientX));
  };
  const onMouseUp = (e: MouseEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const fraction = getFractionFromMouseEvent(e.clientX);
    setDragProgress(null);
    seekTo(fraction);
  };
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  return () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
}, [getFractionFromMouseEvent, seekTo]);
```

Replace the scrubber div with:
```tsx
<div
  ref={progressBarRef}
  onMouseDown={e => {
    isDragging.current = true;
    setDragProgress(getFractionFromMouseEvent(e.clientX));
  }}
  onClick={e => {
    if (!isDragging.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      seekTo((e.clientX - rect.left) / rect.width);
    }
  }}
  data-testid="player-progress"
  style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '2px', cursor: 'pointer', position: 'relative', userSelect: 'none' }}
>
  {(() => {
    const display = dragProgress !== null ? dragProgress : playerProgress;
    return (
      <>
        <div style={{ height: '100%', width: `${display * 100}%`, background: `linear-gradient(to right, ${C.red}, ${C.gold})`, borderRadius: '2px', transition: dragProgress !== null ? 'none' : 'width 0.1s linear' }} />
        <div style={{ position: 'absolute', top: '50%', left: `${display * 100}%`, transform: 'translate(-50%, -50%)', width: dragProgress !== null ? '14px' : '12px', height: dragProgress !== null ? '14px' : '12px', borderRadius: '50%', background: '#fff', boxShadow: dragProgress !== null ? `0 0 8px ${C.red}88, 0 0 4px rgba(0,0,0,0.6)` : '0 0 4px rgba(0,0,0,0.6)', opacity: playerTrack ? 1 : 0, transition: dragProgress !== null ? 'none' : 'opacity 200ms' }} />
      </>
    );
  })()}
</div>
```

- [ ] Add imports, drag state/refs, getFractionFromMouseEvent, document mouse listener, updated scrubber
- [ ] Commit: `feat(player): drag-to-seek on progress bar`

---

## Task 3: PlayerBar — loop/shuffle buttons

Add to useWorkspace destructure: `isLooping, isShuffled, toggleLoop, toggleShuffle,`

Insert Shuffle button as first child of transport row:
```tsx
<button onClick={toggleShuffle} title="Shuffle" style={{ ...btnBase, fontSize: '12px', color: isShuffled ? C.red : 'rgba(255,255,255,0.35)', background: isShuffled ? `${C.red}18` : 'none' }}>⇌</button>
```

Insert Loop button after the Next (⏭) button:
```tsx
<button onClick={toggleLoop} title="Loop" style={{ ...btnBase, fontSize: '12px', color: isLooping ? C.red : 'rgba(255,255,255,0.35)', background: isLooping ? `${C.red}18` : 'none' }}>↺</button>
```

- [ ] Add to destructure, insert Shuffle + Loop buttons with C.red active state
- [ ] Commit: `feat(player): loop and shuffle toggle buttons`

---

## Task 4: PlayerBar — keyboard shortcuts

Add before the return statement:
```ts
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    const tag = (e.target as Element).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); seekTo(Math.min(1, playerProgress + 0.05)); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); seekTo(Math.max(0, playerProgress - 0.05)); }
    else if (e.key === 'm' || e.key === 'M') { setPlayerVolume(playerVolume === 0 ? 0.8 : 0); }
    else if (e.code === 'KeyN') playNext();
    else if (e.code === 'KeyP') playPrev();
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [togglePlay, seekTo, playerProgress, playerVolume, setPlayerVolume, playNext, playPrev]);
```

- [ ] Add keyboard shortcut useEffect with Space/arrows/M/N/P
- [ ] Commit: `feat(player): keyboard shortcuts (Space, arrows, M, N, P)`

---

## Task 5: PlayerBar — mute toggle button

Add ref after drag state:
```ts
const preMuteVolume = useRef(0.8);
```

Add callback:
```ts
const handleMuteToggle = useCallback(() => {
  if (playerVolume === 0) {
    setPlayerVolume(preMuteVolume.current > 0 ? preMuteVolume.current : 0.8);
  } else {
    preMuteVolume.current = playerVolume;
    setPlayerVolume(0);
  }
}, [playerVolume, setPlayerVolume]);
```

Replace the volume icon span with:
```tsx
<button onClick={handleMuteToggle} title={playerVolume === 0 ? 'Unmute' : 'Mute'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: playerVolume === 0 ? C.red : 'rgba(255,255,255,0.3)', fontSize: '14px', padding: '4px', lineHeight: 1, transition: 'color 150ms', flexShrink: 0 }}>
  {playerVolume === 0 ? '🔇' : playerVolume < 0.4 ? '🔈' : playerVolume < 0.8 ? '🔉' : '🔊'}
</button>
```

- [ ] Add preMuteVolume ref, handleMuteToggle, replace span with button
- [ ] Commit: `feat(player): mute toggle button with pre-mute volume restore`

---

## Task 6: PlayerBar — Up Next queue popover

Add to destructure: `playTrack, tracks,`

Add state:
```ts
const [showQueue, setShowQueue] = useState(false);
```

Add queue computation before return:
```ts
const queueTracks = (() => {
  if (!playerTrack || tracks.length === 0) return [];
  if (isShuffled) {
    return tracks.filter(t => t.id !== playerTrack.id).slice(0, 5);
  }
  const idx = tracks.findIndex(t => t.id === playerTrack.id);
  const next: typeof tracks = [];
  for (let i = 1; i <= 5; i++) {
    const candidate = tracks[(idx + i) % tracks.length];
    if (candidate && candidate.id !== playerTrack.id) next.push(candidate);
  }
  return next;
})();
```

Add outside-click dismiss:
```ts
useEffect(() => {
  if (!showQueue) return;
  const dismiss = (e: MouseEvent) => {
    if (!(e.target as Element).closest('[data-queue-popover]')) setShowQueue(false);
  };
  document.addEventListener('mousedown', dismiss);
  return () => document.removeEventListener('mousedown', dismiss);
}, [showQueue]);
```

Add after volume slider in Right section (wrap with position:relative div):
```tsx
<div style={{ position: 'relative' }} data-queue-popover>
  <button onClick={() => setShowQueue(v => !v)} title="Up Next" style={{ ...btnBase, fontSize: '11px', fontWeight: 600, letterSpacing: '0.3px', color: showQueue ? C.red : 'rgba(255,255,255,0.35)', background: showQueue ? `${C.red}18` : 'none', borderRadius: '6px', padding: '4px 8px', whiteSpace: 'nowrap' }}>
    ≡ UP NEXT
  </button>
  {showQueue && (
    <div style={{ position: 'absolute', bottom: '52px', right: 0, width: '260px', background: 'rgba(8,2,4,0.97)', backdropFilter: 'blur(28px) saturate(1.6)', border: `1px solid rgba(230,57,70,0.22)`, borderRadius: '10px', padding: '8px 0', boxShadow: '0 -8px 40px rgba(0,0,0,0.7)', zIndex: 200 }}>
      <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px', padding: '4px 14px 8px', textTransform: 'uppercase' }}>
        {isShuffled ? 'Shuffle Queue' : 'Up Next'}
      </div>
      {queueTracks.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: '12px', padding: '4px 14px 8px' }}>No tracks queued</div>
      ) : queueTracks.map((t, i) => (
        <button key={t.id} onClick={() => { playTrack(t); setShowQueue(false); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '7px 14px', textAlign: 'left' }}
          onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(230,57,70,0.10)'; }}
          onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontVariantNumeric: 'tabular-nums', width: '14px', flexShrink: 0 }}>{i + 1}</span>
          <span style={{ flex: 1, color: '#fff', fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title || `Track v${t.version}`}</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmtTime(t.duration_seconds ?? 0)}</span>
        </button>
      ))}
    </div>
  )}
</div>
```

- [ ] Add playTrack/tracks to destructure, showQueue state, queueTracks computation, dismiss useEffect, Up Next button + popover
- [ ] Commit: `feat(player): Up Next queue popover`