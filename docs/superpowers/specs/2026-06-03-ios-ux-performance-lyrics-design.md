# iOS UX Performance + Synced Lyrics Design

**Goal:** Spotify/Apple-Music-grade iOS experience — gapless transitions, synced lyrics, polished mobile UX — without touching YouTube integration.

**Architecture:** Three independent work streams: (A) Swift AVQueuePlayer + performance, (B) frontend synced-lyrics component, (C) cross-platform consistency + no regression.

**Tech Stack:** Swift AVFoundation (AVQueuePlayer), React/TypeScript (SyncedLyricsView), Capacitor bridge (nativeAudio.ts), Playwright E2E.

---

## A — iOS Native: Performance + Stability

### A1: AVQueuePlayer (gapless transitions)

Replace `AVPlayer` with `AVQueuePlayer` in `AudioPlayerPlugin.swift`.

- `loadTrack` → `queue.removeAllItems(); queue.insert(item, after: nil)` + append preloadItem if available
- `preload` → builds `AVPlayerItem(asset:)` and appends to queue (or stores for next loadTrack)
- `didEnd` fires → JS calls `playNext` → `loadTrack(next)` → already buffered in queue
- `AVQueuePlayer` handles the actual buffer handoff at frame level — zero gap

The `NativeAudioShim` (nativeAudio.ts) interface unchanged — only Swift internals change.

### A2: Zero spinner on native

`WorkspaceContext.playTrack` currently calls `setPlayerLoading(true)` immediately.

Fix: on native (`isNativeApp()`), delay the loading state by 400ms. If audio starts (timeupdate fires) before the timeout, cancel — spinner never shows. Preloaded tracks start in <100ms, so spinner is invisible in practice.

### A3: Swipe threshold + velocity

`MobilePlayerFull.tsx` `onTouchEnd`:
- Current: `|dx| > 70` → skip
- Fix: `|dx| > 100 || |vx| > 500 px/s` (velocity = `dx / elapsed_ms * 1000`)
- Record `touchStartTime` in `onTouchStart`

### A4: Mini player — add next + heart

Spotify mini player layout: `[artwork] [title/artist flex-1] [❤] [⏸/▶] [⏭]`

- Heart: calls `toggleLike(playerTrack)` from WorkspaceContext
- Next: calls `playNext()`
- All buttons: 44×44px minimum hit area

### A5: 44pt tap targets

All icon buttons in `MobilePlayerFull`, `MobileMiniPlayer`, `MobileNav`: minimum `width:44px; height:44px` on the touchable element (icon can be smaller inside).

---

## B — Synced Lyrics

### B1: `computeLyricTimings` (pure frontend utility)

`frontend/src/pwa/lyricTimings.ts`

```ts
export interface LyricLine {
  text: string;
  startTime: number;   // seconds
  endTime: number;     // seconds
  isSection: boolean;  // [Verse 1] etc
}

export function computeLyricTimings(text: string, durationSec: number): LyricLine[]
```

Algorithm:
1. Split `text` on `\n`, trim, filter empty
2. Mark section headers: `/^\[.+\]$/`
3. Count syllables per line: `line.toLowerCase().match(/[aeiouy]+/g)?.length ?? 1`, min 1
4. Section header weight = 0.5, regular line weight = syllableCount
5. `timePerUnit = durationSec / totalWeight`
6. Accumulate `startTime += prevDuration`

### B2: `SyncedLyricsView` component

`frontend/src/components/v4/mobile/SyncedLyricsView.tsx`

Props:
```ts
{ lines: LyricLine[]; currentTime: number; onSeek: (t: number) => void }
```

Behaviour:
- Scrollable `div`, `overflow-y: auto`, full height
- Each line has a `ref` — when active line index changes, call `ref.scrollIntoView({ behavior:'smooth', block:'center' })`
- Active = `startTime ≤ currentTime < endTime`
- Style: active → `color:#fff; opacity:1; fontSize:1.1em; fontWeight:700`; near (±1) → `opacity:0.65`; far → `opacity:0.35`
- Tap line → `onSeek(line.startTime)`
- Section headers: `opacity:0.45; fontSize:0.85em; letterSpacing:0.12em; textTransform:uppercase`

### B3: Integration in `MobilePlayerFull`

When `showLyrics && lyrics && playerDuration > 0`:
- Replace artwork area with `<SyncedLyricsView>`
- Pass `lines={computeLyricTimings(lyrics, playerDuration)}`
- Pass `currentTime={playerCurrentTime}`
- Pass `onSeek={(t) => seekTo(t / playerDuration)}`
- Memoize `computeLyricTimings` result with `useMemo([lyrics, playerDuration])`

---

## C — Cross-platform + No Regression

### C1: YouTube isolation

No files under `backend/src/modules/downloader/` or `backend/youtube-worker.mjs` are touched.

### C2: macOS desktop + Vercel

Rebuild + reinstall after iOS ships. Same frontend bundle, no Swift changes for desktop.

### C3: E2E tests

Add to `frontend/tests/e2e/v4-sounds.spec.ts`:
- Player loads + plays a track → no spinner visible after 1s
- Lyrics toggle shows lyrics container

Swift changes are tested on device only (Playwright cannot drive native iOS).

---

## Sequence

1. **A1+A2**: `AudioPlayerPlugin.swift` — AVQueuePlayer + spinner delay
2. **A3+A4+A5**: `MobilePlayerFull.tsx` + `AppShell.tsx` — swipe, mini player buttons, tap targets
3. **B1+B2+B3**: `lyricTimings.ts` + `SyncedLyricsView.tsx` + `MobilePlayerFull.tsx` integration
4. Build + install iOS, verify on device
5. Rebuild macOS + deploy Vercel
6. Commit everything

---

## Non-goals

- AVQueuePlayer crossfade (out of scope — adds complexity, not requested)
- LRC file import/export
- Server-side lyrics timing (auto-estimate is sufficient)
- Any change to the YouTube download/stream pipeline
