# SoundsTab Polish — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the SoundsTab UX with three targeted improvements: per-track artwork thumbnails in TrackRow, a search + sort control bar in SoundsTab, and a track count + total duration summary header.

**Architecture:** All changes are purely frontend. No new API endpoints required. Artwork fetched from existing `GET /api/projects/:projectId/artwork/:musicId` using `track.artwork_url` as presence signal.

**Files to modify:**
- `frontend/src/components/v4/tracks/TrackRow.tsx` — Task 1
- `frontend/src/components/v4/workspace/SoundsTab.tsx` — Tasks 2 + 3

---

## Task 1 — TrackRow artwork thumbnail

**File:** `frontend/src/components/v4/tracks/TrackRow.tsx`

Replace the existing 32×32 icon div with a 40×40 artwork thumbnail:

```tsx
<div style={{
  width: '40px', height: '40px', borderRadius: '6px',
  background: track.artwork_url
    ? 'transparent'
    : `linear-gradient(135deg, rgba(230,57,70,0.3) 0%, rgba(8,2,4,0.8) 100%)`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, overflow: 'hidden', position: 'relative',
  border: `1px solid ${isSelected ? C.borderActive : C.border}`,
}}>
  {track.artwork_url ? (
    <img
      src={`/api/projects/${track.project_id}/artwork/${track.id}`}
      alt=""
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  ) : isPlaying ? (
    <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '14px' }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ width: '3px', background: C.red, borderRadius: '1px', height: `${8 + i * 2}px`, animation: `barPulse${i} 0.8s ease-in-out infinite alternate` }} />
      ))}
    </div>
  ) : (
    <svg width="10" height="12" viewBox="0 0 10 12" fill={isSelected ? C.red : C.textDim}>
      <path d="M0 0L10 6L0 12V0Z"/>
    </svg>
  )}
  {isPlaying && track.artwork_url && (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '14px' }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ width: '3px', background: C.red, borderRadius: '1px', height: `${8 + i * 2}px`, animation: `barPulse${i} 0.8s ease-in-out infinite alternate` }} />
        ))}
      </div>
    </div>
  )}
</div>
```

- [ ] Read `frontend/src/components/v4/tracks/TrackRow.tsx`
- [ ] Find the existing 32×32 icon div (the div with `width: '32px', height: '32px'`) and replace it entirely with the 40×40 block above
- [ ] Run `cd frontend && npx tsc --noEmit` — verify zero errors
- [ ] Commit: `git add frontend/src/components/v4/tracks/TrackRow.tsx && git commit -m "feat: TrackRow 40x40 artwork thumbnail with playing overlay"`

---

## Task 2 — Search + Sort controls in SoundsTab

**File:** `frontend/src/components/v4/workspace/SoundsTab.tsx`

- [ ] Read `frontend/src/components/v4/workspace/SoundsTab.tsx`
- [ ] Change `import { useState } from 'react';` to `import { useState, useMemo } from 'react';`
- [ ] Add state after existing useState declarations:
  ```ts
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'duration' | 'bpm'>('date');
  ```
- [ ] Add `displayTracks` derivation after the new state (before the `if (!activeProjectId)` guard):
  ```ts
  const displayTracks = useMemo(() => {
    let list = tracks.filter(t =>
      !search || (t.title || `Track v${t.version}`).toLowerCase().includes(search.toLowerCase())
    );
    if (sortBy === 'title') list = [...list].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    if (sortBy === 'duration') list = [...list].sort((a, b) => (b.duration_seconds ?? 0) - (a.duration_seconds ?? 0));
    return list;
  }, [tracks, search, sortBy]);
  ```
- [ ] Add search + sort bar JSX between the action buttons div and the generate panel:
  ```tsx
  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
    <input
      value={search}
      onChange={e => setSearch(e.target.value)}
      placeholder="Search tracks…"
      data-testid="track-search"
      style={{
        flex: 1, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`,
        borderRadius: '8px', padding: '7px 12px', color: C.text,
        fontSize: '12px', outline: 'none',
      }}
    />
    <select
      value={sortBy}
      onChange={e => setSortBy(e.target.value as typeof sortBy)}
      data-testid="track-sort"
      style={{
        background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`,
        borderRadius: '8px', padding: '7px 10px', color: C.text, fontSize: '12px',
        cursor: 'pointer', outline: 'none',
      }}
    >
      <option value="date">Newest</option>
      <option value="title">A–Z</option>
      <option value="duration">Duration</option>
      <option value="bpm">BPM</option>
    </select>
  </div>
  ```
- [ ] Change `tracks.map(track =>` to `displayTracks.map(track =>` in the track list
- [ ] Update the empty-state guard:
  ```tsx
  {displayTracks.length === 0 && (
    <div style={{ color: C.textDim, textAlign: 'center', padding: '32px 0', fontSize: '13px' }}>
      {tracks.length === 0
        ? 'No tracks yet — generate or import one above'
        : 'No tracks match your search'}
    </div>
  )}
  ```
- [ ] Run `cd frontend && npx tsc --noEmit` — verify zero errors
- [ ] Commit: `git add frontend/src/components/v4/workspace/SoundsTab.tsx && git commit -m "feat: SoundsTab search + sort controls"`

---

## Task 3 — Track count + total duration header

**File:** `frontend/src/components/v4/workspace/SoundsTab.tsx`

- [ ] Add helper before `export default function SoundsTab()`:
  ```ts
  function fmtTotalDuration(s: number) {
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }
  ```
- [ ] Add summary row as first child of `<div data-testid="sounds-tab">`:
  ```tsx
  {tracks.length > 0 && (
    <div style={{ color: C.textDim, fontSize: '11px', marginBottom: '8px', letterSpacing: '0.2px' }}>
      {tracks.length} track{tracks.length !== 1 ? 's' : ''}
      {tracks.reduce((s, t) => s + (t.duration_seconds ?? 0), 0) > 0 &&
        ` · ${fmtTotalDuration(tracks.reduce((s, t) => s + (t.duration_seconds ?? 0), 0))}`
      }
    </div>
  )}
  ```
- [ ] Run `cd frontend && npx tsc --noEmit` — verify zero errors
- [ ] Commit: `git add frontend/src/components/v4/workspace/SoundsTab.tsx && git commit -m "feat: SoundsTab track count + total duration header"`
