# Sub-project D: Release Flow Fixes Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three focused bugs in the Release flow: correct the artwork signal source in `ReadinessChecklist`, fix broken API fetches in `ReleaseTab`, and split the duplicate Master/Export quick actions in `RightPanel` so Export performs a real file download.

**Files touched:**
- `frontend/src/components/v4/release/ReadinessChecklist.tsx`
- `frontend/src/components/v4/workspace/ReleaseTab.tsx`
- `frontend/src/components/v4/layout/RightPanel.tsx`

**No backend changes required.** All fixes are purely frontend. No new dependencies.

---

## Task 1 — Fix ReadinessChecklist artwork check

**File:** `frontend/src/components/v4/release/ReadinessChecklist.tsx`

**Root cause:** The `artworkUrl` prop is sourced from `ReleaseTab` which fetches `/api/projects/:id/artwork` — a project-level endpoint that does not exist. The per-track artwork signal that does exist is `track.artwork_url` (a non-null string when artwork has been uploaded or generated).

**Before:**
```tsx
interface ReadinessChecklistProps {
  track: MusicGeneration | null;
  artworkUrl?: string | null;
  hasLyrics?: boolean;
}

export default function ReadinessChecklist({ track, artworkUrl, hasLyrics }: ReadinessChecklistProps) {
  if (!track) return null;

  const checks = [
    { label: 'Has artwork',        pass: !!artworkUrl },
```

**After:**
```tsx
interface ReadinessChecklistProps {
  track: MusicGeneration | null;
  hasLyrics?: boolean;
}

export default function ReadinessChecklist({ track, hasLyrics }: ReadinessChecklistProps) {
  if (!track) return null;

  const checks = [
    { label: 'Has artwork',        pass: !!track.artwork_url },
```

**Steps:**

- [ ] Open `frontend/src/components/v4/release/ReadinessChecklist.tsx`
- [ ] Remove `artworkUrl?: string | null` from the `ReadinessChecklistProps` interface
- [ ] Remove `artworkUrl` from the destructured function parameters
- [ ] Change `pass: !!artworkUrl` to `pass: !!track.artwork_url`
- [ ] Verify TypeScript reports no errors

---

## Task 2 — Fix ReleaseTab lyrics fetch and remove broken artwork fetch

**File:** `frontend/src/components/v4/workspace/ReleaseTab.tsx`

**Root cause:**
1. `fetch('/api/projects/${activeProjectId}/artwork')` — endpoint does not exist. Result was passed as `artworkUrl` to `ReadinessChecklist`, eliminated by Task 1.
2. `fetch('/api/projects/${activeProjectId}/lyrics')` — wrong path. Correct endpoint is `GET /api/lyrics?projectId=<id>`.

**Before:**
```tsx
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
```

```tsx
<ReadinessChecklist track={selectedTrack} artworkUrl={artworkUrl} hasLyrics={hasLyrics} />
```

**After:**
```tsx
const [hasLyrics, setHasLyrics] = useState(false);

useEffect(() => {
  if (!activeProjectId) return;
  fetch(`/api/lyrics?projectId=${activeProjectId}`)
    .then(r => r.json())
    .then((list: unknown[]) => setHasLyrics(Array.isArray(list) && list.length > 0))
    .catch(() => {});
}, [activeProjectId]);
```

```tsx
<ReadinessChecklist track={selectedTrack} hasLyrics={hasLyrics} />
```

**Steps:**

- [ ] Delete `const [artworkUrl, setArtworkUrl] = useState<string | null>(null);`
- [ ] Delete the entire artwork fetch block inside `useEffect`
- [ ] Change lyrics fetch URL to `` `/api/lyrics?projectId=${activeProjectId}` ``
- [ ] Remove `artworkUrl={artworkUrl}` from the `<ReadinessChecklist>` JSX call
- [ ] Verify TypeScript reports no errors

---

## Task 3 — Separate Master vs Export quick actions in RightPanel

**File:** `frontend/src/components/v4/layout/RightPanel.tsx`

**Root cause:** Both "Master" and "Export" call `setActiveTab('release')` — identical, confusing. Export should download the audio file.

**Add state** (after `const [showAddPlaylist, setShowAddPlaylist] = useState(false);`):
```tsx
const [exporting, setExporting] = useState(false);
```

**Add `downloadTrack` function** (after the `copyShare` function):
```tsx
const downloadTrack = async () => {
  if (!selectedTrack || exporting) return;
  setExporting(true);
  try {
    const res = await fetch(`/api/music/${selectedTrack.id}/file`);
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTrack.title || `track-v${selectedTrack.version}`}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    /* silently ignore */
  } finally {
    setExporting(false);
  }
};
```

**Replace Export entry in quick-actions array:**
```tsx
// Before:
{ label: '↗ Export', action: () => setActiveTab('release'),  testId: 'action-export', danger: false },

// After:
{ label: exporting ? '⏳ Downloading…' : '↗ Export', action: downloadTrack, testId: 'action-export', danger: false },
```

**Add `disabled` prop on the button** in the `.map()` callback:
```tsx
disabled={testId === 'action-export' && exporting}
```

**Steps:**

- [ ] Add `const [exporting, setExporting] = useState(false);` after the `showAddPlaylist` state
- [ ] Add the `downloadTrack` async function after `copyShare`
- [ ] Replace the Export quick-action entry with the dynamic label version
- [ ] Add `disabled={testId === 'action-export' && exporting}` prop to the `<button>` in the map
- [ ] Verify: "Master" → Release tab; "Export" → downloads file; button shows "Downloading…" during fetch

---

## Commit

- [ ] Stage all three files:
  ```bash
  git add frontend/src/components/v4/release/ReadinessChecklist.tsx \
          frontend/src/components/v4/workspace/ReleaseTab.tsx \
          frontend/src/components/v4/layout/RightPanel.tsx
  ```
- [ ] Commit:
  ```
  fix: release flow — checklist artwork from track.artwork_url, fix lyrics endpoint, export downloads file
  ```

---

## Dependency Order

Tasks 1 and 2 must be done together (removing `artworkUrl` prop from both interface and JSX call simultaneously). Task 3 is fully independent.
