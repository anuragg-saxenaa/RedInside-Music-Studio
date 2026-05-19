# Phase 4 — Gap Fix & Test Suite Design

**Date:** 2026-05-19
**Branch:** `feat/phase4-redesign`
**Status:** Approved — Triage approach C

---

## Goal

Fix all P0 test breakages from the UI redesign, implement missing P1 spec features in the UI, and produce a comprehensive real Playwright E2E suite that finds bugs before the user does. No mocks. No `page.route()`. No `jest.mock()`.

---

## Scope (Approach C — Triage)

### P0: Fix test breakages from sidebar/playerbar redesign

The UI redesign today changed:
- `new-project-input` is now hidden behind a `+` button (must click to reveal)
- `create-project-btn` also hidden
- `player-bar` empty-state text changed from `"No track selected"` → `"Nothing playing"`
- `playlist-section` is now a collapsible accordion (click "Playlists" to expand)
- `new-playlist-input` and `create-playlist-btn` inside collapsible

**Fix:** Update v4-workspace.spec.ts and related specs to match new selectors/flow. Also restore `player-bar` text to `"No track selected"` since it's the natural phrasing and several tests depend on it.

### P1: Missing spec features to implement

#### 1. TrackRow badges
Spec: "Each track row: badges (MASTERED, BPM, INSTRUMENTAL, STEMS)"
- Add `mastered` and `is_instrumental` fields to `MusicGeneration` type (already in DB schema but not surfaced in API response — fix API to include them)
- Add badge rendering in `TrackRow.tsx`: small pill chips showing BPM (from tags API), MASTERED, INSTRUMENTAL
- BPM is fetched lazily per-track via `GET /api/music/:id/tags`

#### 2. Editable track title in RightPanel
Spec: "Track title editable on double-click → `PUT /api/music/:id`"
- Double-click on title text in RightPanel → shows inline `<input>` with current title
- Blur or Enter → calls `PUT /api/music/:id` with `{ title }` → updates context

#### 3. Playlist add/remove in RightPanel
Spec: "Playlist membership list with add/remove" and "＋ Add to Playlist — dropdown of playlists"
- Show which playlists the selected track belongs to
- "＋ Add to playlist" button with dropdown → `POST /api/playlists/:id/tracks`
- Remove track from playlist → `DELETE /api/playlists/:id/tracks/:musicId`
- Data: fetch `GET /api/playlists` (already in WorkspaceContext) + check membership via `playlist_tracks`

### P2: Out of scope this pass

- WaveformMini component (complex, requires Web Audio decode per track)
- PlayerBar shuffle toggle / playlist indicator
- CraftTab 3rd sub-tab A/B expanded view
- RemixSuggestions wired to AudioEditor (currently console.log)

---

## Test Strategy

### Principle
Every test must call the real backend. Tests are the QA layer. If a test passes, the feature works.

### What "real" means
- Backend tests: `fetch('http://localhost:3000/api/...')` direct HTTP — no mocks
- Frontend E2E: Playwright browser + real backend + real files via seed endpoint
- Seed endpoint `POST /api/test/seed-project` creates real DB records + copies real MP3 fixture

### Test files to fix/create

| File | Action | Why |
|------|--------|-----|
| `v4-workspace.spec.ts` | Fix | Hidden inputs, text changes |
| `v4-sounds.spec.ts` | Verify + extend | Seed flow, track select, play |
| `v4-playlists.spec.ts` | Fix + extend | Hidden accordion, add/remove track |
| `v4-release.spec.ts` | Verify + fix | Checklist, social export |
| `v4-share.spec.ts` | Verify + fix | Share token, read-only view |
| `v4-craft.spec.ts` | Create | Audio editor, medley, A/B |
| `v4-write.spec.ts` | Create | Lyrics editor in workspace |
| `v4-create.spec.ts` | Create | Artwork/video/voice sections |
| `v4-rightpanel.spec.ts` | Create | Editable title, notes, playlist add |

### Test patterns

```typescript
// Setup: always use seed endpoint
async function seedProject(page: Page, opts = { music: true, lyrics: true }) {
  return page.request.post('http://localhost:3000/api/test/seed-project', { data: { name: `Test-${Date.now()}`, ...opts } }).then(r => r.json());
}

// Teardown: always delete seeded project
async function cleanup(page: Page, projectId: string) {
  await page.request.delete(`http://localhost:3000/api/projects/${projectId}`).catch(() => {});
}
```

### Backend integration tests to verify
The existing tests in `backend/tests/integration/` cover the Phase 4 APIs. Run with `npm test` to confirm they pass with real DB.

---

## Implementation Order

1. **Fix PlayerBar empty text** — restore to `"No track selected"` (1 line)
2. **Fix v4-workspace tests** — update selectors for hidden inputs
3. **Fix v4-playlists tests** — update selectors for hidden accordion
4. **Add `mastered`/`is_instrumental` to music API response** — expose from DB
5. **TrackRow badges** — BPM chip (lazy), MASTERED chip, INSTRUMENTAL chip
6. **Editable title in RightPanel** — double-click inline edit
7. **Playlist add/remove in RightPanel** — membership list + add dropdown
8. **Fix/create remaining Playwright specs** — v4-craft, v4-write, v4-create, v4-rightpanel
9. **Full Playwright run** — all must pass green

---

## Contracts Verified

All backend endpoints called by the UI:

| Endpoint | Status |
|----------|--------|
| `GET /api/projects` | ✅ exists |
| `POST /api/projects` | ✅ exists |
| `DELETE /api/projects/:id` | ✅ exists |
| `GET /api/projects/:id/music` | ✅ exists |
| `GET /api/playlists` | ✅ exists |
| `POST /api/playlists` | ✅ exists |
| `DELETE /api/playlists/:id` | ✅ exists |
| `POST /api/playlists/:id/tracks` | ✅ exists |
| `DELETE /api/playlists/:id/tracks/:musicId` | ✅ exists |
| `GET /api/music/:id/tags` | ✅ exists |
| `GET /api/music/:id/notes` | ✅ exists |
| `POST /api/music/:id/notes` | ✅ exists |
| `DELETE /api/music/:id/notes/:noteId` | ✅ exists |
| `POST /api/audio/social-export` | ✅ exists |
| `POST /api/projects/:id/share` | ✅ exists |
| `GET /api/share/:token` | ✅ exists |
| `PUT /api/music/:id` | ⚠ need to verify exists |
| `GET /api/projects/:id/artwork` | ⚠ need to verify |
| `GET /api/projects/:id/lyrics` | ⚠ need to verify |
