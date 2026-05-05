# RedInside Music Studio - Frontend Design System

**Date**: 2026-05-05
**Status**: ✅ Implemented
**Type**: Design System / UI Overhaul

---

## Overview

Unified design system for entire frontend: dark theme, RedInside brand aesthetics, consistent typography and color. All components redesigned with inline styles per project convention.

---

## Design Direction: "RedInside Urban"

**Tone:** Desi hip-hop culture meets professional music studio — bold, urban, premium.

### Color Palette

```css
:root {
  /* Backgrounds */
  --bg-primary: #0A0A0A;      /* Main background - deep black */
  --bg-secondary: #141414;     /* Card/panel backgrounds */
  --bg-tertiary: #1E1E1E;      /* Elevated elements */
  --bg-hover: #282828;        /* Hover states */

  /* Accents - RedInside Brand */
  --accent-primary: #E63946;   /* Bold red - primary actions, progress */
  --accent-hover: #FF4757;      /* Red hover state */
  --accent-secondary: #FFB800; /* Gold - alternative accent, badges */

  /* Text */
  --text-primary: #FFFFFF;     /* Primary text */
  --text-secondary: #A0A0A0;  /* Secondary text */
  --text-tertiary: #666666;   /* Muted/disabled text */

  /* Borders */
  --border-default: #2A2A2A;
  --border-hover: #3A3A3A;

  /* States */
  --success: #00D26A;
  --error: #E63946;
  --warning: #FFB800;
}
```

### Typography

```css
/* Display/Headings */
font-family: 'Outfit', -apple-system, sans-serif;

/* Body text */
font-family: 'DM Sans', -apple-system, sans-serif;

/* Monospace (time codes, version numbers) */
font-family: 'JetBrains Mono', monospace;
```

### Spacing System

```css
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 32px;
--space-2xl: 48px;
```

### Border Radius

```css
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-full: 9999px;
```

---

## Component Updates

### Studio Page (`Studio.tsx`)

- Background: `--bg-primary`
- Container: centered, max-width 900px
- Header: project name + back button
- **New**: Persistent player bar at bottom (Spotify-style)

### WorkflowStepper (`WorkflowStepper.tsx`)

| Current | New |
|---------|-----|
| Gray stepper buttons | Dark pill buttons with green active indicator |
| Basic hover states | Scale + glow on hover |
| Text labels | Icon + text, bolder |

### LyricsEditor (`LyricsEditor.tsx`)

| Current | New |
|---------|-----|
| Gray-700 backgrounds | --bg-secondary cards |
| White text on gray | --text-primary / --text-secondary |
| Blue-600 generate button | --accent-primary red button |
| Basic select dropdown | Custom styled dropdown |
| **NEW** | Full lyrics modal on click |
| **NEW** | Click-to-expand with formatted text |

### MusicPlayer (`MusicPlayer.tsx`)

| Current | New |
|---------|-----|
| Mixed inline + Tailwind styles | Consistent --bg-secondary cards |
| Blue accent buttons | --accent-primary red |
| Basic border styling | Subtle borders, rounded --radius-lg |
| **NEW** | Quick 320kbps conversion button |
| **NEW** | "Play in Bar" for persistent player |

### SpotifyWaveformPlayer

- Full Spotify-style player with real playback functionality
- Fake waveform bars (seeded by musicId) - visible immediately, red progress
- Real-time progress tracking via requestAnimationFrame
- Play/pause, rewind 10s, forward 10s controls
- Volume slider with mute toggle
- Loading and error states
- Keyboard shortcuts (Space=play/pause, ←→=seek, ↑↓=volume, M=mute)
- Click waveform to seek
- **NEW**: Styled range slider for seeking

### FFmpegPanel / Export Panel

| Current | New |
|---------|-----|
| "Process" step name | "Export for Release" step |
| Generic conversion UI | Radio selector per version |
| No bitrate info | Shows "256kbps → 320kbps" progression |
| **NEW** | Per-track Export 320kbps button |
| **NEW** | Green Download button when ready |
| **NEW** | Info box explaining 320kbps quality |

### App (ProjectSelector)

| Current | New |
|---------|-----|
| Basic project list | Search bar to filter |
| All projects same section | Recent vs Older Projects sections |
| Basic cards | Progress indicators (lyrics/music versions) |
| Full timestamps | Relative timestamps ("2h ago") |
| No empty state | Welcome state with CTA |

---

## Key Features Implemented

### 1. Persistent Player Bar (Spotify-style)
- Fixed bottom bar across all workflow tabs
- "Play in Bar" button on each music version
- Audio continues when switching tabs
- Auto-launches when music auto-generated

### 2. Quick 320kbps Conversion
- "Get 320kbps" gold button on music version cards
- Direct conversion from Music step
- Shows processing spinner during conversion
- Green "320kbps MP3" button when ready

### 3. Centralized State
- Music list managed at Studio level (parent component)
- Both MusicPlayer and FFmpegPanel use same data source
- Conversion completes → triggers refresh → all views update

### 4. Lyrics Modal
- Click any lyrics card to open full-view modal
- Pre-formatted text preserving line breaks
- "Use This Version" action from modal

---

## Implementation Notes

All components use inline styles (not Tailwind) per project convention. Google Fonts loaded via `index.html`: Outfit (headings), DM Sans (body), JetBrains Mono (monospace).

### Components Implemented

| Component | File | Status |
|-----------|------|--------|
| Studio Page | `Studio.tsx` | ✅ Dark themed, persistent player bar |
| WorkflowStepper | `WorkflowStepper.tsx` | ✅ Red active, green completed, dark pending |
| LyricsEditor | `LyricsEditor.tsx` | ✅ Full redesign, click-to-expand modal |
| MusicPlayer | `MusicPlayer.tsx` | ✅ Dark themed, quick 320kbps conversion |
| SpotifyWaveformPlayer | `SpotifyWaveformPlayer.tsx` | ✅ Full player with waveform, controls, slider |
| FFmpegPanel | `Studio.tsx` (inline) | ✅ Export panel with per-track actions |
| App (ProjectSelector) | `App.tsx` | ✅ Search, Recent/Older, progress indicators |

---

## Success Criteria

1. ✅ All components use inline styles (no Tailwind)
2. ✅ Consistent dark theme (#0A0A0A background) across all pages
3. ✅ Typography hierarchy clear (Outfit headings, DM Sans body)
4. ✅ Red accent (#E63946) as primary action color
5. ✅ No generic blue/gray utility classes for colors
6. ✅ Smooth hover transitions on interactive elements
7. ✅ Loading states with subtle pulse animation
8. ✅ Persistent player bar like Spotify/Apple Music
9. ✅ Quick 320kbps conversion from Music step
10. ✅ Centralized state for sync across tabs

---

## MiniMax API Full Utilization

### Music Generation Parameters
- **Genre**: hip-hop, electronic, rock, indie, classical, etc.
- **Mood**: energetic, melancholic, chill, aggressive, etc.
- **Vocal Style**: auto-tune, raw, soft, aggressive, etc.
- **Instruments**: drums, bass, piano, guitar, synth, etc.
- **BPM**: 60-200 tempo setting
- **Key**: C major, A minor, etc.

### Cover Mode
- Reference audio URL input
- Style prompt for transformation
- Seed for reproducible results
- Model: `music-cover-free`

### Image Generation (Artwork)
- **Model**: `image-01` or `image-01-live`
- **Aspect Ratios**: 1:1, 16:9, 4:3, 3:2, 2:3, 3:4, 9:16, 21:9
- **Count**: 1-9 images per request
- **Prompt**: Up to 1500 characters
- **Subject Reference**: Character-based image-to-image
- **Seed**: Reproducible results

### Voice Design
- Create custom voices from text descriptions
- Preview text up to 500 characters
- Custom voice ID for identification
- Trial audio generation
- Voice list and deletion

### Voice Cloning
- Upload reference audio (mp3, m4a, wav)
- Duration: 10 seconds minimum to 5 minutes maximum
- Size: Maximum 20 MB
- Auto-delete after 7 days unused

### FFmpeg Export Options
- **Format**: MP3, WAV, PCM
- **Bitrate**: 128/192/256/320 kbps (MP3 only)
- **Channels**: Mono (1) / Stereo (2)
- **Sample Rate**: 22.05/44.1/48/96 kHz

## Project Management
- Delete projects with confirmation
- Rename projects inline
- Context menu (⋮) on project cards

## New Workflow Tabs

### Artwork Tab
- Image generation with aspect ratio selection
- Count selector (1-9 images)
- Generated artwork grid with download
- Prompt input with character count

### Voice Tab
- Voice Design Studio
- Example voice prompts
- Preview text input
- Generated voices list with Voice ID

## Implementation Notes

### Backend Routes Added
- `POST /api/image/generate` - Image generation
- `POST /api/voice/design` - Voice design creation
- `GET /api/voices` - List available voices
- `DELETE /api/voice/:voiceId` - Delete a voice
- `POST /api/voice/clone` - Voice cloning

### Components Added
- `ArtworkGenerator.tsx` - Image generation UI
- `VoiceDesign.tsx` - Voice design UI
- `CompactPlayer.tsx` - Compact player for persistent bar
