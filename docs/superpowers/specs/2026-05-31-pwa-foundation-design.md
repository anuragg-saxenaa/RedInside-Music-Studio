# PWA Foundation — Design Spec

**Date:** 2026-05-31
**Status:** Approved (brainstorming) → ready for implementation plan
**Sub-project:** A of the multi-platform expansion (PWA → macOS/Tauri → iOS/Capacitor → Google Drive storage → native polish)

## Context

RedInside Music Studio is a React (Vite) web app + Express backend, with **Turso (DB)** and **R2/S3 (files)** already shared between local dev and the Railway/Vercel cloud deployment. Any client hitting the backend is automatically in data-sync. The multi-platform goal therefore reduces to adding **client shells** (PWA, desktop, iOS) over the same React UI, plus an optional storage backend.

This spec covers **sub-project A: turn the existing web app into an installable, offline-capable PWA** with Spotify-style explicit downloads — the foundation the desktop (Tauri) and iOS (Capacitor) shells build on.

## Goals

- Installable to home screen / dock (iOS, macOS, Android, desktop browsers); fullscreen, app icon, splash.
- Fast launch via precached app shell + auto-update.
- **Explicit "Download for offline"** at four scopes: per-track, playlist, album, project.
- Downloaded tracks **play fully offline** (range/seek supported).
- Library/Downloads view renders **offline** (no network).
- Offline-tolerant auth: remembered sign-in opens straight to downloads when the auth server is unreachable.
- **Fully additive** — the current web/local/cloud app is never broken; PWA layer is isolated and disableable.

## Non-Goals

- Offline music *creation* (MiniMax AI requires the server — online only).
- Multi-user offline security hardening (single-user studio; permissive offline access is acceptable).
- Push notifications (deferred to native shells, sub-projects C/E).
- Silent/automatic cache eviction (user-managed only).

## Architecture

The current React app is untouched. A **service-worker layer** is added that is invisible when online and activates for install/offline. Three isolated concerns:

1. **PWA shell** — `vite-plugin-pwa` (Workbox): web manifest, icons, app-shell precache, auto-update prompt.
2. **Offline audio engine** — SW runtime route that serves `GET /api/music/:id/file` from Cache API when present; a download function that fetches + caches the bytes.
3. **Downloads index** — IndexedDB store of track metadata so the library renders offline.

### Chosen approach: Hybrid (Cache API + IndexedDB + Workbox)

- **Cache API** (`ris-audio-v1`) stores audio bytes — what `<audio>` + HTTP range requests want for reliable offline seeking, served via the SW.
- **IndexedDB** (`ris-downloads`) stores the *download index*: `{ musicId, title, artist, projectId, bytes, status, addedAt }` — lets the UI show what's downloaded, storage used, and per-item delete without network.
- **Workbox** (via `vite-plugin-pwa`) precaches the app shell, provides navigation fallback, and an update flow.

Rejected: Cache-API-only (weaker offline library list); IndexedDB-blob playback (poor seeking, manual object-URL lifecycle).

## New Modules (frontend)

| Path | Responsibility |
|------|----------------|
| `src/pwa/sw.ts` | Workbox service worker: precache shell, runtime `CacheFirst` for `/api/music/*/file`, SPA navigation fallback. |
| `src/pwa/downloads.ts` | Core API: `downloadTrack(id)`, `downloadMany(ids, onProgress)`, `removeDownload(id)`, `isDownloaded(id)`, `listDownloads()`, `storageEstimate()`. Wraps Cache API + IndexedDB. |
| `src/contexts/DownloadsContext.tsx` | Reactive download state (status + progress) for the UI. |
| `src/components/v4/downloads/DownloadButton.tsx` | Per-track/playlist/album/project download control (accepts a set of track ids). |
| `src/components/v4/downloads/DownloadsView.tsx` | List of downloaded tracks, storage-used bar, per-item delete, delete-all. |
| `public/manifest.webmanifest` + icons | 192/512/maskable + apple-touch icons, theme `#08020a`. |
| `src/pwa/offlineAuth.ts` | Cache last successful Clerk session flag; expose `wasSignedIn()` for offline gate bypass. |

Backend: **no changes required** (audio already served at `GET /api/music/:id/file` with range support; auth already exempts that route).

## Data Flow

**Download:** tap Download → `downloadTrack` fetches `${API_BASE}/api/music/:id/file` → stores bytes in Cache `ris-audio-v1` + metadata row in IndexedDB (`status: 'done'`) → `DownloadsContext` updates → UI shows ✓. Playlist/album/project call `downloadMany` over the resolved track ids with aggregate progress.

**Offline playback:** `<audio src="${API_BASE}/api/music/:id/file">` → request hits the SW → SW finds bytes in Cache → serves with range support → plays with no network. The library reads the IndexedDB index → renders downloaded songs even fully offline.

**Offline launch / auth:** on boot, if Clerk/network is unreachable and `offlineAuth.wasSignedIn()` is true → skip the sign-in gate and render the **Downloads** view (downloaded tracks only). Online → normal Clerk flow; refresh the remembered-session flag on each successful auth.

## Storage Management

- Display storage used vs quota via `navigator.storage.estimate()`.
- User-managed deletion only — per item and delete-all. **No silent auto-eviction.**
- If a download would exceed quota → warn and block with a clear message (do not partially write).
- Request persistent storage with `navigator.storage.persist()` on first download.

## Testing (production-grade, zero-bug bar)

- **Unit** (`backend`/`frontend` as appropriate): `downloads.ts` against `fake-indexeddb` + a mocked Cache API — download/remove/list/quota/duplicate handling.
- **E2E** (`frontend/tests/e2e/v4-pwa.spec.ts`, added to the green CI v4 suite):
  1. manifest + SW registered (installability signals present);
  2. seed a project with a track → Download it → assert ✓ + IndexedDB row;
  3. `context.setOffline(true)` → reload → track still listed and **plays** from cache;
  4. delete → removed from list and cache.
- **CI**: keep all three jobs green; optional Lighthouse PWA assertion (installable + SW) as a non-blocking check.

## Additive / Fallback Guarantee

- SW registered **only in production builds**; a Settings toggle + `?nopwa` query unregister it.
- If SW registration fails, the app behaves exactly as today.
- All new code isolated under `src/pwa/` and `src/components/v4/downloads/`; existing modules unchanged except a small mount of `DownloadsProvider` and Download buttons.
- The web app, Railway backend, Vercel deploy, and local dev are unaffected — the current version remains the guaranteed fallback.

## Build Order (within this sub-project)

1. `vite-plugin-pwa` + manifest + icons + SW registration (installable shell, update prompt).
2. `downloads.ts` + IndexedDB index + Cache API audio + SW route.
3. `DownloadsContext` + DownloadButton + DownloadsView, wired into track rows / playlist / album / project.
4. Offline auth bypass + storage UI.
5. Unit + E2E tests; CI green; Lighthouse check.

## Open Risks

- iOS Safari Cache API quotas are smaller than desktop — surface quota clearly; persistent-storage request mitigates eviction.
- Service-worker update races — use Workbox `autoUpdate` + an explicit "new version" prompt to avoid stale shells.
