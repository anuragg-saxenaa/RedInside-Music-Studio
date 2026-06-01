# Multi-Platform B/C/D/E — Design Spec

**Date:** 2026-06-01
**Status:** Approved (user: "all BCDE") → phased build
**Builds on:** sub-project A (PWA Foundation, shipped). Shared Turso DB + R2 storage already make every client data-synced.

All four are **fully additive** — the existing web/PWA/Railway/Vercel app is never broken; each is a new build target or env-gated module with a fallback.

---

## E — Native Polish (Media Session + deep links)  [most autonomous; build first]

**Goal:** lock-screen / now-playing controls + system media keys + deep links — works in the PWA today and carries into B/C.

- **Media Session API** (pure web): set `navigator.mediaSession.metadata` (title, artist, artwork) on play; wire action handlers (play/pause/next/prev/seek) to the existing `WorkspaceContext` player. Shows on macOS Now Playing, iOS lock screen, Android notification.
- `src/pwa/mediaSession.ts` — `setNowPlaying(track, artworkUrl)`, `bindMediaActions({togglePlay,playNext,playPrev,seekTo})`, `clearNowPlaying()`. Called from WorkspaceContext `playTrack`/`togglePlay`/`ended`.
- Artwork uses the same `${API_BASE}/api/projects/:pid/artwork/:id` URL.
- Deep links: hash routes already work (`#/share/:token`); add `#/downloads`. (Native deep-link registration handled in B/C.)
- **Tests:** unit — `mediaSession.ts` against a mocked `navigator.mediaSession`. E2E — assert `navigator.mediaSession.metadata.title` updates after play (Chromium supports it).
- **Deploy:** Vercel (web/PWA). No backend change.

## D — Google Drive Storage Backend (+ R2 sync)

**Goal:** optional `gdrive` storage driver; user connects Google Drive; files sync Drive ↔ R2. Env-gated; default stays `r2`.

- Backend `storage.util.js` gains a `gdrive` driver path (alongside `local`/`r2`) using `googleapis` Drive v3: `saveAudioFile`/`readBufferAnywhere`/`saveArtwork` read/write a `RedInside/` folder in the user's Drive.
- OAuth: `GET /api/gdrive/auth` → consent URL; `GET /api/gdrive/callback` → store refresh token in `settings`. Needs `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` env (user-provided) — driver disabled + endpoints return 503 when absent (additive, safe).
- **Sync:** `node backend/sync-gdrive.mjs` mirrors R2 ↔ Drive (idempotent, like `sync-storage.mjs`).
- `readBufferAnywhere` already tries local→R2; extend to local→R2→gdrive so playback works whichever holds the bytes.
- **Tests:** unit — driver against a mocked Drive client (no network). Integration gated on creds.
- **Human step:** create a Google Cloud OAuth client, provide ID/secret.

## B — macOS Desktop (Tauri)

**Goal:** native `.app`/`.dmg` wrapping the built web app; dock, native menu, media keys.

- `src-tauri/` (Rust shell) added under `frontend/`. `tauri.conf.json` points `build.frontendDist` at `../dist`; `beforeBuildCommand` = `npm run build`. Window 1200×800, title "RedInside Studio".
- App loads the bundled `dist` (offline-capable) with `VITE_API_BASE_URL` baked to Railway. Native menu (File/Edit/View/Window) + media-key support via Media Session (from E).
- Scripts: `npm run tauri:dev`, `npm run tauri:build` → `.dmg`.
- **Tests:** `cargo test` (default) + smoke: `tauri build` produces a bundle locally.
- **Human step:** Apple Developer ID for notarization (unsigned `.app` runs locally via right-click-open).

## C — iOS (Capacitor)

**Goal:** real iOS app wrapping the web UI; App Store-ready project.

- `@capacitor/core` + `@capacitor/ios`; `capacitor.config.ts` `webDir: dist`, `server.url` optional (load Railway or bundled). `npx cap add ios` generates `ios/` Xcode project.
- Native plugins: `@capacitor/app` (deep links), status-bar/safe-area (already handled via CSS env()), background audio via the existing `<audio>` + Media Session.
- Scripts: `npm run ios:sync` (`cap sync ios`), open in Xcode to run/archive.
- **Tests:** web build is the source of truth (already E2E-tested). `cap doctor` clean.
- **Human step:** Apple Developer account + Xcode to run on device / submit to App Store.

---

## Cross-cutting

- **Data safety:** B/C/E read-only on user data. D adds a storage backend but defaults off; `gdrive` writes go to the user's own Drive; R2/Turso untouched unless explicitly synced.
- **Additivity:** web app unchanged; B/C are separate build targets; D is env-gated (503 without creds); E degrades gracefully (no Media Session → today's behavior).
- **CI:** keep 3 jobs green. E adds unit+e2e. D adds unit. B/C native builds are local/manual (not in the web CI) — documented, not gating.
- **Deploy:** E → Vercel. D → Railway (backend). B/C → local native builds (+ user's signing).

## Build order
E → D → B → C. Each: TDD, code-review gate, CI green, commit/deploy.
