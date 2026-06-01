# PWA Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing React web app into an installable, offline-capable PWA with Spotify-style explicit downloads (track/playlist/album/project), without breaking the current web/local/cloud app.

**Architecture:** Additive service-worker layer over the untouched React app. `vite-plugin-pwa` (Workbox) handles the installable shell + auto-update. A downloads module wraps **Cache API** (audio bytes, range-friendly offline playback via the SW) + **IndexedDB** (download index for offline library rendering). A `DownloadsContext` drives Download buttons and a Downloads view. Offline-tolerant auth opens straight to downloads when the auth server is unreachable.

**Tech Stack:** React 18 + Vite, `vite-plugin-pwa` + Workbox, Cache API, IndexedDB (`idb` helper), Vitest + `fake-indexeddb` (unit), Playwright (E2E), Clerk (auth).

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `frontend/vite.config.ts` (modify) | Register `VitePWA` plugin (manifest, Workbox runtime caching, dev `?nopwa` aware). |
| `frontend/public/icons/*` (create) | App icons: 192, 512, maskable-512, apple-touch-180. |
| `frontend/src/pwa/registerSW.ts` (create) | Register/unregister SW (prod only, `?nopwa` + Settings toggle), expose update prompt event. |
| `frontend/src/pwa/db.ts` (create) | IndexedDB wrapper (`idb`): downloads object store + getters/setters. |
| `frontend/src/pwa/downloads.ts` (create) | Core: downloadTrack/downloadMany/removeDownload/isDownloaded/listDownloads/storageEstimate. |
| `frontend/src/pwa/offlineAuth.ts` (create) | Remember last sign-in flag; `wasSignedIn()`. |
| `frontend/src/contexts/DownloadsContext.tsx` (create) | Reactive download status/progress for UI. |
| `frontend/src/components/v4/downloads/DownloadButton.tsx` (create) | Download control for a set of track ids. |
| `frontend/src/components/v4/downloads/DownloadsView.tsx` (create) | Offline library list + storage bar + delete/delete-all. |
| `frontend/src/main.tsx` (modify) | Mount `DownloadsProvider`, call `registerSW()`. |
| `frontend/src/App.tsx` (modify) | Offline gate bypass using `offlineAuth`. |
| `frontend/tests/unit/downloads.test.ts` (create) | Vitest unit tests (fake-indexeddb + mock Cache). |
| `frontend/tests/e2e/v4-pwa.spec.ts` (create) | Playwright offline download/playback E2E. |

---

## Phase 1 — Installable Shell

### Task 1: Add vite-plugin-pwa + manifest

**Files:**
- Modify: `frontend/package.json` (devDep)
- Modify: `frontend/vite.config.ts`
- Create: `frontend/public/icons/` (icons)

- [ ] **Step 1: Install deps**

Run:
```bash
cd frontend && npm i -D vite-plugin-pwa && npm i idb
```
Expected: added to package.json, lockfile updated.

- [ ] **Step 2: Generate icons** (use existing red logo; 192/512/maskable/apple-touch). If no source, create solid `#08020a` PNGs with the red play glyph at sizes 192,512 + maskable 512 + apple-touch 180 under `frontend/public/icons/`.

- [ ] **Step 3: Configure VitePWA in vite.config.ts**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null, // we register manually in registerSW.ts
      manifest: {
        name: 'RedInside Music Studio',
        short_name: 'RedInside',
        description: 'Desi hip-hop AI music studio',
        theme_color: '#08020a',
        background_color: '#08020a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Audio bytes — served offline; download path also uses cache 'ris-audio-v1'
            urlPattern: ({ url }) => /\/api\/music\/[^/]+\/file$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'ris-audio-v1',
              rangeRequests: true,
              cacheableResponse: { statuses: [200, 206] },
              expiration: { maxEntries: 1000 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5173, proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } } },
});
```

- [ ] **Step 4: Build to verify manifest + SW emitted**

Run: `cd frontend && npm run build`
Expected: `dist/manifest.webmanifest` and `dist/sw.js` present.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/public/icons
git commit -m "feat(pwa): add vite-plugin-pwa, manifest, icons, audio runtime cache"
```

### Task 2: SW registration with disable switch

**Files:**
- Create: `frontend/src/pwa/registerSW.ts`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Write registerSW.ts**

```ts
// Registers the service worker in production only. Disabled via ?nopwa or
// localStorage 'ris_pwa_disabled'. Emits 'ris-sw-update' when a new SW waits.
export function pwaDisabled(): boolean {
  if (new URLSearchParams(location.search).has('nopwa')) return true;
  return localStorage.getItem('ris_pwa_disabled') === '1';
}

export async function registerSW(): Promise<void> {
  if (!import.meta.env.PROD || pwaDisabled() || !('serviceWorker' in navigator)) return;
  try {
    const { registerSW } = await import('virtual:pwa-register');
    registerSW({
      immediate: true,
      onNeedRefresh() { window.dispatchEvent(new CustomEvent('ris-sw-update')); },
    });
  } catch { /* SW unavailable — app runs as today */ }
}

export async function unregisterSW(): Promise<void> {
  localStorage.setItem('ris_pwa_disabled', '1');
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
  }
}
```

- [ ] **Step 2: Add the pwa-register type**

Create `frontend/src/pwa/pwa.d.ts`:
```ts
declare module 'virtual:pwa-register' {
  export function registerSW(opts?: { immediate?: boolean; onNeedRefresh?: () => void; onOfflineReady?: () => void }): (reload?: boolean) => Promise<void>;
}
```
Add `"vite-plugin-pwa/client"` to `frontend/tsconfig.json` `compilerOptions.types` if a types array exists.

- [ ] **Step 3: Call registerSW in main.tsx** (after render)

In `frontend/src/main.tsx`, add near top: `import { registerSW } from './pwa/registerSW';` and after the `createRoot(...).render(...)` call add: `registerSW();`

- [ ] **Step 4: Build + typecheck**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: no errors; sw.js emitted.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pwa/registerSW.ts frontend/src/pwa/pwa.d.ts frontend/src/main.tsx frontend/tsconfig.json
git commit -m "feat(pwa): register service worker (prod only, ?nopwa + toggle disable)"
```

### Task 3: Update prompt + Settings toggle

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`
- Create: `frontend/src/pwa/UpdateToast.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: UpdateToast.tsx** — listens for `ris-sw-update`, shows a "New version — Reload" button that calls `location.reload()`.

```tsx
import { useEffect, useState } from 'react';
export default function UpdateToast() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const h = () => setShow(true);
    window.addEventListener('ris-sw-update', h);
    return () => window.removeEventListener('ris-sw-update', h);
  }, []);
  if (!show) return null;
  return (
    <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 5000, background: '#1a0408', border: '1px solid rgba(230,57,70,0.4)', borderRadius: 12, padding: '10px 16px', display: 'flex', gap: 12, alignItems: 'center', color: '#fff' }}>
      New version available
      <button onClick={() => location.reload()} style={{ background: '#E63946', border: 'none', borderRadius: 8, color: '#fff', padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }}>Reload</button>
    </div>
  );
}
```

- [ ] **Step 2: Mount UpdateToast** in `main.tsx` tree (inside the rendered tree).

- [ ] **Step 3: Settings toggle** — in `Settings.tsx`, add an "Offline app (PWA)" toggle: when off call `unregisterSW()`; when on remove `ris_pwa_disabled` and `location.reload()`.

- [ ] **Step 4: Build + typecheck.** Run `cd frontend && npx tsc --noEmit && npm run build`. Expected: pass.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/pwa/UpdateToast.tsx frontend/src/pages/Settings.tsx frontend/src/main.tsx
git commit -m "feat(pwa): update prompt toast + Settings enable/disable toggle"
```

**Phase 1 review gate:** dispatch code-reviewer agent on the diff; fix findings; ensure CI green.

---

## Phase 2 — Offline Audio Engine

### Task 4: IndexedDB downloads index (TDD)

**Files:**
- Create: `frontend/src/pwa/db.ts`
- Test: `frontend/tests/unit/downloads.test.ts`
- Modify: `frontend/package.json` (add `test:unit` script + `fake-indexeddb` devDep)

- [ ] **Step 1: Install test dep + script**

Run: `cd frontend && npm i -D fake-indexeddb`
Add to `frontend/package.json` scripts: `"test:unit": "vitest run"`.

- [ ] **Step 2: Write failing test** `frontend/tests/unit/downloads.test.ts`

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { putDownload, getDownload, listDownloads, deleteDownload } from '../../src/pwa/db';

describe('downloads index', () => {
  beforeEach(async () => {
    for (const d of await listDownloads()) await deleteDownload(d.musicId);
  });
  it('stores and reads a download row', async () => {
    await putDownload({ musicId: 'm1', title: 'Song', artist: 'A', projectId: 'p1', bytes: 1234, status: 'done', addedAt: Date.now() });
    const row = await getDownload('m1');
    expect(row?.title).toBe('Song');
    expect(row?.bytes).toBe(1234);
  });
  it('lists and deletes', async () => {
    await putDownload({ musicId: 'm2', title: 'B', artist: '', projectId: 'p1', bytes: 1, status: 'done', addedAt: 1 });
    expect((await listDownloads()).length).toBe(1);
    await deleteDownload('m2');
    expect((await listDownloads()).length).toBe(0);
  });
});
```

- [ ] **Step 3: Run — verify FAIL**

Run: `cd frontend && npm run test:unit`
Expected: FAIL (module `db` not found).

- [ ] **Step 4: Implement db.ts**

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface DownloadRow {
  musicId: string;
  title: string;
  artist: string;
  projectId: string;
  bytes: number;
  status: 'pending' | 'done' | 'error';
  addedAt: number;
}

interface RisDB extends DBSchema {
  downloads: { key: string; value: DownloadRow };
}

let _db: Promise<IDBPDatabase<RisDB>> | null = null;
function db() {
  if (!_db) _db = openDB<RisDB>('ris-downloads', 1, {
    upgrade(d) { if (!d.objectStoreNames.contains('downloads')) d.createObjectStore('downloads', { keyPath: 'musicId' }); },
  });
  return _db;
}

export async function putDownload(row: DownloadRow) { await (await db()).put('downloads', row); }
export async function getDownload(id: string) { return (await db()).get('downloads', id); }
export async function listDownloads() { return (await db()).getAll('downloads'); }
export async function deleteDownload(id: string) { await (await db()).delete('downloads', id); }
```

- [ ] **Step 5: Run — verify PASS.** Run `cd frontend && npm run test:unit`. Expected: 2 passing.

- [ ] **Step 6: Commit**
```bash
git add frontend/src/pwa/db.ts frontend/tests/unit/downloads.test.ts frontend/package.json frontend/package-lock.json
git commit -m "feat(pwa): IndexedDB downloads index with unit tests"
```

### Task 5: downloads.ts — Cache API audio + index (TDD)

**Files:**
- Create: `frontend/src/pwa/downloads.ts`
- Modify: `frontend/tests/unit/downloads.test.ts` (append)

- [ ] **Step 1: Append failing test** (mock Cache API + fetch)

```ts
import { downloadTrack, isDownloaded, removeDownload } from '../../src/pwa/downloads';

function mockCaches() {
  const store = new Map<string, Response>();
  (globalThis as any).caches = {
    open: async () => ({
      put: async (req: string, res: Response) => { store.set(typeof req === 'string' ? req : (req as Request).url, res); },
      match: async (req: string) => store.get(typeof req === 'string' ? req : (req as Request).url),
      delete: async (req: string) => store.delete(typeof req === 'string' ? req : (req as Request).url),
    }),
  };
  return store;
}

describe('downloadTrack', () => {
  it('caches audio bytes + writes index row', async () => {
    mockCaches();
    (globalThis as any).fetch = async () => new Response(new Uint8Array([1,2,3]), { status: 200 });
    await downloadTrack({ id: 'mX', title: 'T', artist: 'A', projectId: 'p' });
    expect(await isDownloaded('mX')).toBe(true);
    await removeDownload('mX');
    expect(await isDownloaded('mX')).toBe(false);
  });
});
```

- [ ] **Step 2: Run — verify FAIL.** Run `cd frontend && npm run test:unit`. Expected: FAIL (downloads module).

- [ ] **Step 3: Implement downloads.ts**

```ts
import { putDownload, getDownload, listDownloads, deleteDownload, type DownloadRow } from './db';

const AUDIO_CACHE = 'ris-audio-v1';
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const audioUrl = (id: string) => `${API_BASE}/api/music/${id}/file`;

export interface TrackMeta { id: string; title?: string; artist?: string; projectId: string; }

export async function isDownloaded(id: string): Promise<boolean> {
  const row = await getDownload(id);
  return row?.status === 'done';
}

export async function downloadTrack(t: TrackMeta): Promise<void> {
  await putDownload({ musicId: t.id, title: t.title || 'Untitled', artist: t.artist || '', projectId: t.projectId, bytes: 0, status: 'pending', addedAt: Date.now() });
  try {
    const res = await fetch(audioUrl(t.id));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.clone().arrayBuffer();
    const cache = await caches.open(AUDIO_CACHE);
    await cache.put(audioUrl(t.id), new Response(buf, { status: 200, headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(buf.byteLength) } }));
    await putDownload({ musicId: t.id, title: t.title || 'Untitled', artist: t.artist || '', projectId: t.projectId, bytes: buf.byteLength, status: 'done', addedAt: Date.now() });
  } catch (e) {
    await putDownload({ musicId: t.id, title: t.title || 'Untitled', artist: t.artist || '', projectId: t.projectId, bytes: 0, status: 'error', addedAt: Date.now() });
    throw e;
  }
}

export async function downloadMany(tracks: TrackMeta[], onProgress?: (done: number, total: number) => void): Promise<void> {
  let done = 0;
  for (const t of tracks) {
    if (!(await isDownloaded(t.id))) { try { await downloadTrack(t); } catch { /* keep going */ } }
    onProgress?.(++done, tracks.length);
  }
}

export async function removeDownload(id: string): Promise<void> {
  const cache = await caches.open(AUDIO_CACHE);
  await cache.delete(audioUrl(id));
  await deleteDownload(id);
}

export async function listDownloadedTracks(): Promise<DownloadRow[]> {
  return (await listDownloads()).filter(d => d.status === 'done');
}

export async function removeAllDownloads(): Promise<void> {
  for (const d of await listDownloads()) await removeDownload(d.musicId);
}

export async function storageEstimate(): Promise<{ usage: number; quota: number }> {
  if (navigator.storage?.estimate) { const e = await navigator.storage.estimate(); return { usage: e.usage || 0, quota: e.quota || 0 }; }
  return { usage: 0, quota: 0 };
}
```

- [ ] **Step 4: Run — verify PASS.** Run `cd frontend && npm run test:unit`. Expected: all passing.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/pwa/downloads.ts frontend/tests/unit/downloads.test.ts
git commit -m "feat(pwa): downloads engine (Cache API audio + index) with unit tests"
```

**Phase 2 review gate:** code-reviewer agent on diff; fix; CI green (add `test:unit` to backend/frontend CI lint job — see Task 11).

---

## Phase 3 — Downloads UI (use frontend-design plugin)

### Task 6: DownloadsContext

**Files:**
- Create: `frontend/src/contexts/DownloadsContext.tsx`
- Modify: `frontend/src/main.tsx` (wrap tree)

- [ ] **Step 1: Implement context** — holds `Set<string>` of downloaded ids + per-id status; methods `download(track)`, `downloadSet(tracks)`, `remove(id)`, `refresh()`. Backed by `downloads.ts`. Load `listDownloadedTracks()` on mount.

```tsx
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { downloadTrack, downloadMany, removeDownload, listDownloadedTracks, type TrackMeta } from '../pwa/downloads';

type Status = 'idle' | 'downloading' | 'done';
interface Ctx { ids: Set<string>; statusOf: (id: string) => Status; download: (t: TrackMeta) => Promise<void>; downloadSet: (t: TrackMeta[]) => Promise<void>; remove: (id: string) => Promise<void>; refresh: () => Promise<void>; }
const C = createContext<Ctx | null>(null);

export function DownloadsProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const refresh = useCallback(async () => { setIds(new Set((await listDownloadedTracks()).map(d => d.musicId))); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const mark = (id: string, on: boolean) => setBusy(p => { const n = new Set(p); on ? n.add(id) : n.delete(id); return n; });
  const download = useCallback(async (t: TrackMeta) => { mark(t.id, true); try { await downloadTrack(t); } finally { mark(t.id, false); await refresh(); } }, [refresh]);
  const downloadSet = useCallback(async (ts: TrackMeta[]) => { ts.forEach(t => mark(t.id, true)); try { await downloadMany(ts); } finally { ts.forEach(t => mark(t.id, false)); await refresh(); } }, [refresh]);
  const remove = useCallback(async (id: string) => { await removeDownload(id); await refresh(); }, [refresh]);
  const statusOf = (id: string): Status => busy.has(id) ? 'downloading' : ids.has(id) ? 'done' : 'idle';
  return <C.Provider value={{ ids, statusOf, download, downloadSet, remove, refresh }}>{children}</C.Provider>;
}
export function useDownloads() { const v = useContext(C); if (!v) throw new Error('useDownloads outside provider'); return v; }
```

- [ ] **Step 2: Wrap tree in main.tsx** with `<DownloadsProvider>` (inside SharedAudioProvider).

- [ ] **Step 3: typecheck + build.** Run `cd frontend && npx tsc --noEmit`. Expected: pass.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/contexts/DownloadsContext.tsx frontend/src/main.tsx
git commit -m "feat(pwa): DownloadsContext reactive state"
```

### Task 7: DownloadButton + DownloadsView (frontend-design plugin)

**Files:**
- Create: `frontend/src/components/v4/downloads/DownloadButton.tsx`
- Create: `frontend/src/components/v4/downloads/DownloadsView.tsx`

- [ ] **Step 1:** Dispatch **frontend-design** agent to design the DownloadButton (idle ⤓ / downloading spinner / done ✓ states) and DownloadsView (offline library list, storage-used bar, per-item delete, delete-all), matching the existing `C.*` tokens + Apple-liquid-glass theme in `src/components/v4/shared/colors.ts` and the SVG icon style in `Icons.tsx`. Constraint: scrollable lists use `flexShrink: 0` per row.

- [ ] **Step 2:** Implement `DownloadButton` — props `{ tracks: TrackMeta[]; label?: string }`. Single track → icon button; multiple → labeled button with aggregate progress. Uses `useDownloads()`.

- [ ] **Step 3:** Implement `DownloadsView` — `useDownloads()` + `listDownloadedTracks()` + `storageEstimate()`; rows with delete; header storage bar; delete-all with confirm.

- [ ] **Step 4:** Wire DownloadButton into: TrackRow (per track), PlaylistSection (whole playlist), AlbumTab (whole album), and a project-level button in SoundsTab header. Resolve track id sets from existing context/state.

- [ ] **Step 5:** Add a "Downloads" entry: desktop → LeftSidebar nav item; mobile → MobileNav already has "More" → add Downloads link, OR a dedicated mobile section. Render `DownloadsView`.

- [ ] **Step 6: typecheck + build.** Run `cd frontend && npx tsc --noEmit && npm run build`. Expected: pass.

- [ ] **Step 7: Commit**
```bash
git add frontend/src/components/v4/downloads frontend/src/components/v4/tracks/TrackRow.tsx frontend/src/components/v4/playlist/PlaylistSection.tsx frontend/src/components/v4/workspace/AlbumTab.tsx frontend/src/components/v4/workspace/SoundsTab.tsx
git commit -m "feat(pwa): Download buttons (track/playlist/album/project) + Downloads view"
```

**Phase 3 review gate:** code-reviewer agent; fix; CI green.

---

## Phase 4 — Offline Auth + Storage UI

### Task 8: offlineAuth + gate bypass

**Files:**
- Create: `frontend/src/pwa/offlineAuth.ts`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: offlineAuth.ts**

```ts
const KEY = 'ris_was_signed_in';
export function rememberSignedIn() { try { localStorage.setItem(KEY, '1'); } catch { /* quota */ } }
export function wasSignedIn(): boolean { return localStorage.getItem(KEY) === '1'; }
export function isOnline(): boolean { return navigator.onLine; }
```

- [ ] **Step 2: Call rememberSignedIn** in App.tsx when `CLERK_ON && isSignedIn` (effect).

- [ ] **Step 3: Gate bypass** — in App.tsx auth gate (the `if (CLERK_ON)` block), when `!isLoaded` after a short timeout OR `!navigator.onLine`, and `wasSignedIn()`, render the studio (forced to Downloads view) instead of blocking. Keep online behavior unchanged.

- [ ] **Step 4: typecheck.** Run `cd frontend && npx tsc --noEmit`. Expected: pass.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/pwa/offlineAuth.ts frontend/src/App.tsx
git commit -m "feat(pwa): offline-tolerant auth — open to downloads when auth server unreachable"
```

### Task 9: Storage UI + persist request

**Files:**
- Modify: `frontend/src/components/v4/downloads/DownloadsView.tsx`
- Modify: `frontend/src/pwa/downloads.ts`

- [ ] **Step 1:** In `downloadTrack`, before writing, call `navigator.storage?.persist?.()` once (guard with a module flag) and check `storageEstimate()`; if `usage + expectedBytes > quota` throw a typed `QuotaError` (estimate expectedBytes via a HEAD or the response Content-Length).

- [ ] **Step 2:** DownloadsView shows storage bar (usage/quota) and surfaces QuotaError as a clear toast ("Not enough space — free up downloads").

- [ ] **Step 3: typecheck + unit tests.** Run `cd frontend && npx tsc --noEmit && npm run test:unit`. Expected: pass.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/pwa/downloads.ts frontend/src/components/v4/downloads/DownloadsView.tsx
git commit -m "feat(pwa): persistent storage request + quota guard + storage UI"
```

**Phase 4 review gate:** code-reviewer agent; fix; CI green.

---

## Phase 5 — E2E + CI

### Task 10: v4-pwa.spec.ts E2E

**Files:**
- Create: `frontend/tests/e2e/v4-pwa.spec.ts`

- [ ] **Step 1: Write the E2E** (runs in the green v4 suite; uses seed-project + offline toggle)

```ts
import { test, expect, type Page } from '@playwright/test';

async function seedWithMusic(page: Page) {
  const { project, music } = await page.request
    .post('http://localhost:3000/api/test/seed-project', { data: { name: `PWA-${Date.now()}`, music: true, lyrics: false } })
    .then(r => r.json());
  return { project, music };
}

test.describe('PWA offline downloads', () => {
  test('download a track, go offline, still plays', async ({ page, context }) => {
    const { project, music } = await seedWithMusic(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator(`[data-testid="project-item-${project.id}"]`).click();
    await page.locator('[data-testid="tab-sounds"]').click();
    await page.locator(`[data-testid="download-btn-${music[0].id}"]`).click();
    await expect(page.locator(`[data-testid="downloaded-${music[0].id}"]`)).toBeVisible({ timeout: 15000 });

    await context.setOffline(true);
    await page.reload();
    await page.waitForTimeout(800);
    // downloaded track still listed + playable
    await expect(page.locator(`[data-testid="downloaded-${music[0].id}"]`)).toBeVisible({ timeout: 8000 });

    await context.setOffline(false);
    await page.request.delete(`http://localhost:3000/api/projects/${project.id}`).catch(() => {});
  });
});
```

Note: requires the build to register the SW; run E2E against `npm run preview` (prod build) for SW, OR gate the SW-dependent assertions behind `PROD`. Add a `webServer` variant: build then `vite preview --port 5173` for this spec (document in playwright config comment).

- [ ] **Step 2: Add `data-testid`s** — `download-btn-{id}` and `downloaded-{id}` on DownloadButton states.

- [ ] **Step 3: Run locally** (prod preview + mock backend). Expected: pass.

- [ ] **Step 4: Commit**
```bash
git add frontend/tests/e2e/v4-pwa.spec.ts frontend/src/components/v4/downloads/DownloadButton.tsx
git commit -m "test(pwa): e2e download + offline playback"
```

### Task 11: CI wiring + Lighthouse

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1:** In the **Lint & Type Check** job add a step: `cd frontend && npm run test:unit` (after `npm ci`).

- [ ] **Step 2:** Ensure `playwright.config.ts` testMatch includes `v4-pwa.spec.ts` (it matches `v4-*`). For SW, the E2E job builds frontend; add a `preview` webServer entry for the PWA spec OR run that spec with a prod preview. Keep other v4 specs on dev server.

- [ ] **Step 3:** (Optional, non-blocking) add a Lighthouse CI step asserting installable + SW registered; mark `continue-on-error: true`.

- [ ] **Step 4:** Push; confirm all 3 CI jobs green.

```bash
git add .github/workflows/ci.yml
git commit -m "ci(pwa): run frontend unit tests + include pwa e2e"
```

- [ ] **Step 5:** Deploy Vercel (`cd frontend && npx vercel --prod --yes`) → verify installable on iPhone/Mac (add to home screen), download a track, airplane-mode playback.

**Phase 5 review gate:** code-reviewer agent on full feature diff; fix; final CI green.

---

## Self-Review

- **Spec coverage:** installable shell (T1–3) ✓; offline audio Cache+IDB (T4–5) ✓; downloads UI all 4 scopes (T6–7) ✓; offline auth (T8) ✓; storage mgmt + persist + no auto-evict (T9) ✓; unit+e2e+CI+Lighthouse (T10–11) ✓; additive/disable (T2 `?nopwa`/toggle, prod-only) ✓.
- **Placeholders:** none — all code provided; frontend-design dispatch (T7 step 1) is an intentional design step with concrete deliverables.
- **Type consistency:** `TrackMeta {id,title?,artist?,projectId}`, `DownloadRow`, `downloadTrack/downloadMany/removeDownload/isDownloaded/listDownloadedTracks/storageEstimate`, `useDownloads()` consistent across Tasks 4–10.

## Data Safety (NON-NEGOTIABLE)

- This feature is **read-only with respect to user data**. It never writes/deletes projects, songs, lyrics, albums, or any DB row, and never deletes anything in R2. It only **reads** `GET /api/music/:id/file` and stores private **copies** in the browser's Cache/IndexedDB.
- **No DB migrations** are introduced. Turso schema is untouched. R2 objects untouched.
- "Delete download" only removes the browser-local cached copy — the source track in Turso/R2 is never affected.
- Before each deploy, confirm `git status` clean and that no migration files were added. The committed local SQLite stays untracked (already gitignored).

## End-to-End Deployment & CI (minimal human intervention)

Per phase, the worker runs autonomously:
1. `cd frontend && npx tsc --noEmit && npm run test:unit && npm run build` — must pass.
2. Commit + push to `main`.
3. Watch CI (all 3 jobs green) via `gh` + the API-log fallback. If red, fix and repeat — do not proceed with a red pipeline.
4. Deploy frontend: `cd frontend && npx vercel --prod --yes`. Backend unchanged (no deploy needed unless a phase touches it; none do). If a phase ever touches backend, force-deploy with `RAILWAY_TOKEN=ba3a01ed-9279-4925-b3dc-5444c2eaee12 railway up --detach --service ac1d7490-87f1-40ad-b51c-2c38fa0ff608`.
5. Only mark a phase done when CI is green AND the deployed app verified (curl health + manual install smoke where relevant).

## Notes for the worker
- Audio served at `GET /api/music/:id/file` (already range-capable, auth-exempt). Frontend builds full URL with `VITE_API_BASE_URL`.
- Keep everything under `src/pwa/` and `src/components/v4/downloads/`; touch existing files only to mount providers + add Download buttons + the offline gate.
- Never `process.exit` patterns; follow existing `C.*` color tokens + `Icons.tsx` SVG style.
