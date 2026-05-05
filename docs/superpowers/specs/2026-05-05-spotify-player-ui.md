# RedInside Music Studio - Spotify-Level Music Player UI

**Date**: 2026-05-05
**Status**: Approved
**Type**: UI Enhancement Specification

---

## Overview

Elevate the music player component from basic `<audio>` tag to Spotify-class experience with waveform visualization and full playback controls. Phase 1 focus: playback quality without synchronized lyrics (Phase 2).

---

## Design Direction

**Aesthetic:** "Urban Studio Dark" — professional music production feel
- **Background:** Deep charcoal (#0D0D0D) with subtle noise texture
- **Surface:** Elevated cards (#1A1A1A) with soft glow on focus
- **Accent:** Warm amber (#F59200) for waveform, progress, active states
- **Secondary accent:** Cool white (#E8E8E8) for text/icons
- **Font:** Space Grotesk (headings), Inter (body) — or custom pairing

**Typography:**
- Song title: 18px, semibold, #FFFFFF
- Artist/Version: 14px, regular, #A0A0A0
- Time codes: 12px, monospace, #808080

**Motion:**
- Waveform progress: CSS transition 100ms linear
- Button hover: scale 1.05, 150ms ease-out
- Volume slider: real-time, no transition

---

## Component: SpotifyWaveformPlayer

**Location:** `frontend/src/components/MusicPlayer/SpotifyWaveformPlayer.tsx`

### Props Interface

```typescript
interface SpotifyWaveformPlayerProps {
  musicId: string;
  version: number;
  durationMs: number;
  audioUrl: string;        // `/api/music/${id}/file`
  title?: string;
  model?: string;
}
```

### Visual Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  SONG TITLE                              v2  •  music-2.6  •  2:32  │
│                                                                     │
│  ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇  │
│  └─────────────────────────────────────────────────────────────────┘│
│  0:47                                                         2:32 │
│                                                                     │
│       ⏮     ⏪     ▶     ⏩     ⏭        🔀     🔁        🔊 ▁▂▃▄▅▆  │
│                                                                     │
│  Download MP3  •  Download 320kbps                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Waveform Specifications

- **Container:** 100% width, 60px height
- **Generated:** Generate fake waveform bars (40-60 bars) server-side or client-side from audio duration
- **Played portion:** Amber fill (#F59200)
- **Unplayed portion:** Dark gray (#333333)
- **Scrubbing:** Click/drag on waveform repositions playhead
- **Hover state:** Vertical line cursor, time tooltip

### Playback Controls

| Control | Icon | Action |
|---------|------|--------|
| Previous | ⏮ | Restart song (if >3s in, restart; else go to previous) |
| Rewind 10s | ⏪ | Seek backward 10 seconds |
| Play/Pause | ▶/⏸ | Toggle playback, space bar shortcut |
| Forward 10s | ⏩ | Seek forward 10 seconds |
| Next | ⏭ | Go to next track (if in playlist) |
| Shuffle | 🔀 | Toggle shuffle mode |
| Repeat | 🔁 | Cycle: off → all → one |
| Volume | 🔊 + slider | 0-100%, mute on click |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play/Pause |
| ← | Seek -5s |
| → | Seek +5s |
| ↑ | Volume +5% |
| ↓ | Volume -5% |
| M | Mute toggle |
| F | Toggle fullscreen (future) |

### Download Options

- **Download MP3** — links to original (256kbps)
- **Download 320kbps** — links to processed file (disabled if not processed)

### States

| State | Visual |
|-------|--------|
| Loading | Pulsing waveform placeholder |
| Playing | Animated playhead, pause icon |
| Paused | Static waveform, play icon |
| Buffering | Spinner overlay on play button |
| Error | Red tint, error message below |
| No audio | Disabled controls, "Processing..." text |

---

## Data Flow

```
Frontend                        Backend                         Storage
   │                               │                               │
   │  GET /api/music/:id          │                               │
   │ ─────────────────────────────▶ │                               │
   │                               │  Find music record            │
   │                               │                               │
   │  { id, version,              │  ←── music.original_file_path  │
   │    duration_seconds,         │                               │
   │    processed_file_path }     │                               │
   │ ◀──────────────────────────── │                               │
   │                               │                               │
   │  audioUrl = /api/music/:id/file                                   │
   │                               │                               │
   │  GET /api/music/:id/file      │                               │
   │ ───────────────────────────────────────────────────────────────▶│
   │                               │                               │
   │  [audio stream]              │                               │
   │ ◀───────────────────────────────────────────────────────────────│
```

---

## File Changes

### Create
- `frontend/src/components/MusicPlayer/SpotifyWaveformPlayer.tsx`

### Modify
- `frontend/src/components/MusicPlayer/MusicPlayer.tsx` — replace `<audio>` with `<SpotifyWaveformPlayer>`
- `frontend/src/pages/Studio.tsx` — pass full music object to enable all features

### Future (Phase 2)
- `frontend/src/components/MusicPlayer/SynchronizedLyrics.tsx`
- `frontend/src/components/MusicPlayer/QueuePanel.tsx`

---

## Dependencies

- No new npm packages for Phase 1
- Use native HTML5 Audio API
- CSS animations (no framer-motion needed yet)
- Optional: `wavesurfer.js` for real waveform generation (can add later)

---

## Success Criteria

1. Waveform displays with amber progress indicator
2. Click waveform to seek
3. All playback controls functional
4. Keyboard shortcuts work
5. Volume control works with mute toggle
6. Download links serve correct files
7. Responsive: works on mobile (320px+) and desktop
8. No layout shift during playback
9. Error state displays gracefully when audio unavailable

---

## Out of Scope (Phase 2)

- Synchronized lyrics highlighting
- Playlist/queue management
- Real waveform from audio analysis
- Fullscreen mode
- Share/embed functionality
- Dark/light theme toggle