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
- Container: centered, max-width 1200px
- Header: project name left, back button left

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
| Blue-600 generate button | --accent-primary green button |
| Basic select dropdown | Custom styled dropdown |

### MusicPlayer (`MusicPlayer.tsx`)

| Current | New |
|---------|-----|
| Mixed inline + Tailwind styles | Consistent --bg-secondary cards |
| Blue accent buttons | --accent-primary green |
| Basic border styling | Subtle borders, rounded --radius-lg |

### SpotifyWaveformPlayer

- Update accent color: #1DB954 → #E63946 (RedInside red)
- Use brand red for play button, progress, links

### Global

- Scrollbar: dark themed
- Focus states: green outline
- Selection: green background

---

## Implementation Tasks

1. Create `frontend/src/index.css` with CSS variables, global styles
2. Update `Studio.tsx` with design system classes
3. Update `WorkflowStepper.tsx` to match design
4. Update `LyricsEditor.tsx` with design system
5. Update `MusicPlayer.tsx` with design system
6. Add Google Fonts (Outfit, DM Sans, JetBrains Mono)
7. Update `index.html` for fonts

---

## Files to Modify

- `frontend/index.html` — Add Google Fonts
- `frontend/src/index.css` — Create with CSS variables + global styles
- `frontend/src/pages/Studio.tsx` — Update styling
- `frontend/src/components/WorkflowControl/WorkflowStepper.tsx` — Full redesign
- `frontend/src/components/LyricsEditor/LyricsEditor.tsx` — Consistent styling
- `frontend/src/components/MusicPlayer/MusicPlayer.tsx` — Consistent styling

---

## Implementation Notes

All components use inline styles (not Tailwind) per project convention. Google Fonts loaded via `index.html`: Outfit (headings), DM Sans (body), JetBrains Mono (monospace).

### Components Implemented

| Component | File | Status |
|-----------|------|--------|
| Studio Page | `Studio.tsx` | ✅ Dark themed |
| WorkflowStepper | `WorkflowStepper.tsx` | ✅ Red active, green completed, dark pending |
| LyricsEditor | `LyricsEditor.tsx` | ✅ Full redesign with history cards |
| App (ProjectSelector) | `App.tsx` | ✅ RedInside branded header, styled project cards |

## Success Criteria

1. ✅ All components use inline styles (no Tailwind)
2. ✅ Consistent dark theme (#0A0A0A background) across all pages
3. ✅ Typography hierarchy clear (Outfit headings, DM Sans body)
4. ✅ Red accent (#E63946) as primary action color (not green)
5. ✅ No generic blue/gray utility classes for colors
6. ✅ Smooth hover transitions on interactive elements
7. ✅ Loading states with subtle pulse animation