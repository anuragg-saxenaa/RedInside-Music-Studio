# RedInside Waveform Player UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build RedInsideWaveformPlayer component with waveform visualization, full playback controls, keyboard shortcuts

**Architecture:** New `SpotifyWaveformPlayer.tsx` component (named for historical reasons, but fully RedInside branded) replaces `<audio>` tag in MusicPlayer. Uses HTML5 Audio API with custom waveform rendering (fake bars, not real analysis). Playback state managed via React hooks.

**Tech Stack:** React, TypeScript, HTML5 Audio API, inline styles

---

## File Structure

```
frontend/src/
├── components/
│   └── MusicPlayer/
│       ├── SpotifyWaveformPlayer.tsx  (CREATE)
│       ├── MusicPlayer.tsx            (MODIFY)
├── pages/
│   └── Studio.tsx                     (MODIFY)
```

---

## Task 1: Create SpotifyWaveformPlayer Component Shell

**Files:**
- Create: `frontend/src/components/MusicPlayer/SpotifyWaveformPlayer.tsx`

- [ ] **Step 1: Write component skeleton with props interface**

```typescript
import { useState, useRef, useEffect } from 'react';

interface SpotifyWaveformPlayerProps {
  musicId: string;
  version: number;
  durationMs: number;
  audioUrl: string;
  title?: string;
  model?: string;
  onTimeUpdate?: (currentTime: number) => void;
}

export default function SpotifyWaveformPlayer({
  musicId,
  version,
  durationMs,
  audioUrl,
  title = 'Untitled',
  model = 'music-2.6',
  onTimeUpdate,
}: SpotifyWaveformPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="spotify-player">
      {/* Header */}
      <div className="player-header">
        <span className="song-title">{title}</span>
        <span className="meta">v{version} • {model} • {formatTime(durationMs)}</span>
      </div>

      {/* Placeholder - waveform to implement in Task 2 */}
      <div className="waveform-placeholder" style={{ height: 60, background: '#333' }} />

      {/* Time display */}
      <div className="time-display">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(durationMs)}</span>
      </div>

      {/* Placeholder - controls to implement in Task 3 */}
      <div className="controls-placeholder" style={{ height: 48, background: '#222' }} />
    </div>
  );
}
```

- [ ] **Step 2: Create component file**

Run: `cat > frontend/src/components/MusicPlayer/SpotifyWaveformPlayer.tsx << 'EOF'
... (paste code above)
EOF`

- [ ] **Step 3: Add CSS placeholder (temporary)**

Run: Add to MusicPlayer.css:
```css
.spotify-player {
  background: #1A1A1A;
  border-radius: 12px;
  padding: 20px;
  color: #fff;
}

.player-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.song-title {
  font-size: 18px;
  font-weight: 600;
}

.meta {
  font-size: 14px;
  color: #A0A0A0;
}

.time-display {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #808080;
  margin-top: 8px;
  font-family: monospace;
}
```

- [ ] **Step 4: Verify component renders**

Run: `curl -s http://localhost:5173 | grep -q "spotify-player" && echo "Component in bundle" || echo "Not found"`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/MusicPlayer/SpotifyWaveformPlayer.tsx frontend/src/components/MusicPlayer/MusicPlayer.css
git commit -m "feat: create SpotifyWaveformPlayer shell component"
```

---

## Task 2: Implement Fake Waveform Visualization

**Files:**
- Modify: `frontend/src/components/MusicPlayer/SpotifyWaveformPlayer.tsx`

**Waveform approach:** Generate 50 bars with random heights (seeded by musicId for consistency). Amber fill for played portion, gray for unplayed.

- [ ] **Step 1: Add waveform state and generation function**

Add inside component, after useState declarations:

```typescript
// Generate deterministic waveform bars from musicId
const generateWaveformBars = (id: string, barCount: number = 50): number[] => {
  const seed = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const bars: number[] = [];
  for (let i = 0; i < barCount; i++) {
    // Simple seeded random
    const value = Math.sin(seed * (i + 1) * 0.1) * 0.5 + 0.5;
    bars.push(Math.floor(value * 50) + 20); // 20-70 height
  }
  return bars;
};

const waveformBars = generateWaveformBars(musicId, 50);
const progressPercent = durationMs > 0 ? (currentTime / durationMs) * 100 : 0;
```

- [ ] **Step 2: Replace waveform placeholder with actual waveform**

Replace `<div className="waveform-placeholder" ... />` with:

```jsx
<div
  className="waveform"
  onClick={(e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * durationMs;
    if (audioRef.current) {
      audioRef.current.currentTime = newTime / 1000;
      setCurrentTime(newTime);
    }
  }}
  style={{ cursor: 'pointer' }}
>
  {waveformBars.map((height, index) => {
    const barPercent = (index / waveformBars.length) * 100;
    const isPlayed = barPercent < progressPercent;
    return (
      <div
        key={index}
        className="waveform-bar"
        style={{
          height: `${height}%`,
          backgroundColor: isPlayed ? '#E63946' : '#333333',
          transition: 'background-color 100ms linear',
        }}
      />
    );
  })}
</div>
```

- [ ] **Step 3: Add waveform CSS**

```css
.waveform {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 60px;
  padding: 0 4px;
}

.waveform-bar {
  flex: 1;
  min-width: 2px;
  max-width: 6px;
  border-radius: 2px;
}
```

- [ ] **Step 4: Connect audio element**

Add to component JSX (before closing div):
```jsx
<audio
  ref={audioRef}
  src={audioUrl}
  onTimeUpdate={() => {
    if (audioRef.current) {
      const timeMs = audioRef.current.currentTime * 1000;
      setCurrentTime(timeMs);
      onTimeUpdate?.(timeMs);
    }
  }}
  onEnded={() => setIsPlaying(false)}
  onPlay={() => setIsPlaying(true)}
  onPause={() => setIsPlaying(false)}
  preload="metadata"
/>
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/MusicPlayer/SpotifyWaveformPlayer.tsx
git commit -m "feat: add fake waveform visualization with click-to-seek"
```

---

## Task 3: Implement Playback Controls

**Files:**
- Modify: `frontend/src/components/MusicPlayer/SpotifyWaveformPlayer.tsx`

- [ ] **Step 1: Add control functions**

Add these handlers inside component:

```typescript
const togglePlay = () => {
  if (!audioRef.current) return;
  if (isPlaying) {
    audioRef.current.pause();
  } else {
    audioRef.current.play();
  }
};

const seekBy = (seconds: number) => {
  if (!audioRef.current) return;
  audioRef.current.currentTime += seconds;
};

const handleVolumeChange = (newVolume: number) => {
  if (!audioRef.current) return;
  audioRef.current.volume = newVolume;
  setVolume(newVolume);
  if (newVolume > 0 && isMuted) setIsMuted(false);
};

const toggleMute = () => {
  if (!audioRef.current) return;
  if (isMuted) {
    audioRef.current.volume = volume || 0.8;
    setIsMuted(false);
  } else {
    audioRef.current.volume = 0;
    setIsMuted(true);
  }
};
```

- [ ] **Step 2: Replace controls placeholder**

Replace `<div className="controls-placeholder" ... />` with:

```jsx
<div className="controls">
  <div className="main-controls">
    <button className="control-btn" onClick={() => seekBy(-10)} title="Rewind 10s">
      ⏪
    </button>
    <button
      className="control-btn play-btn"
      onClick={togglePlay}
      title={isPlaying ? 'Pause' : 'Play'}
    >
      {isPlaying ? '⏸' : '▶'}
    </button>
    <button className="control-btn" onClick={() => seekBy(10)} title="Forward 10s">
      ⏩
    </button>
  </div>

  <div className="volume-controls">
    <button className="control-btn" onClick={toggleMute} title="Mute">
      {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
    </button>
    <input
      type="range"
      className="volume-slider"
      min="0"
      max="1"
      step="0.01"
      value={isMuted ? 0 : volume}
      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
    />
  </div>
</div>
```

- [ ] **Step 3: Add controls CSS**

```css
.controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
}

.main-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.control-btn {
  background: none;
  border: none;
  color: #E8E8E8;
  font-size: 20px;
  cursor: pointer;
  padding: 8px;
  transition: transform 150ms ease-out, opacity 150ms ease-out;
}

.control-btn:hover {
  transform: scale(1.1);
}

.control-btn:active {
  transform: scale(0.95);
}

.play-btn {
  font-size: 28px;
  color: #000;
  background: '#E63946',
  border-radius: 50%;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-btn:hover {
  background: #FFA500;
}

.volume-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.volume-slider {
  width: 80px;
  height: 4px;
  -webkit-appearance: none;
  background: #333;
  border-radius: 2px;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: '#E63946',
  border-radius: 50%;
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/MusicPlayer/SpotifyWaveformPlayer.tsx
git commit -m "feat: add playback controls (play/pause/seek/volume)"
```

---

## Task 4: Add Keyboard Shortcuts

**Files:**
- Modify: `frontend/src/components/MusicPlayer/SpotifyWaveformPlayer.tsx`

- [ ] **Step 1: Add keyboard event listener**

Add useEffect after audioRef declaration:

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Don't trigger if typing in input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        seekBy(-5);
        break;
      case 'ArrowRight':
        e.preventDefault();
        seekBy(5);
        break;
      case 'ArrowUp':
        e.preventDefault();
        handleVolumeChange(Math.min(1, volume + 0.05));
        break;
      case 'ArrowDown':
        e.preventDefault();
        handleVolumeChange(Math.max(0, volume - 0.05));
        break;
      case 'KeyM':
        e.preventDefault();
        toggleMute();
        break;
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isPlaying, volume, isMuted]);
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/MusicPlayer/SpotifyWaveformPlayer.tsx
git commit -m "feat: add keyboard shortcuts (space, arrows, m)"
```

---

## Task 5: Add Download Options & Polish

**Files:**
- Modify: `frontend/src/components/MusicPlayer/SpotifyWaveformPlayer.tsx`

- [ ] **Step 1: Add download buttons after controls**

Add inside component JSX (after controls div):

```jsx
<div className="download-options" style={{ marginTop: 16, display: 'flex', gap: 12 }}>
  <a
    href={`/api/music/${musicId}/file`}
    download
    className="download-btn"
    style={{
      color: '#F59200',
      textDecoration: 'none',
      fontSize: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    }}
  >
    Download MP3
  </a>
  {version > 1 && (
    <span style={{ color: '#666', fontSize: 12 }}>
      • Processed version available
    </span>
  )}
</div>
```

- [ ] **Step 2: Add polish CSS**

```css
.download-btn:hover {
  text-decoration: underline;
}

.download-btn:active {
  opacity: 0.8;
}
```

- [ ] **Step 3: Clean up and verify all imports**

Verify no unused imports:
```typescript
// Should have:
import { useState, useRef, useEffect } from 'react';
// Should NOT have unused:
import { useEffect } from 'react'; // if only using useState and useRef
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/MusicPlayer/SpotifyWaveformPlayer.tsx
git commit -m "feat: add download buttons and polish"
```

---

## Task 6: Integrate into MusicPlayer

**Files:**
- Modify: `frontend/src/components/MusicPlayer/MusicPlayer.tsx`

- [ ] **Step 1: Read current MusicPlayer implementation**

Run: `head -60 frontend/src/components/MusicPlayer/MusicPlayer.tsx`

- [ ] **Step 2: Add import for SpotifyWaveformPlayer**

Add at top:
```typescript
import SpotifyWaveformPlayer from './SpotifyWaveformPlayer';
```

- [ ] **Step 3: Replace audio element usage**

Find where audio element is rendered and replace with:
```jsx
{selectedMusic && (
  <SpotifyWaveformPlayer
    musicId={selectedMusic.id}
    version={selectedMusic.version}
    durationMs={(selectedMusic.duration_seconds || 0) * 1000}
    audioUrl={`/api/music/${selectedMusic.id}/file`}
    title={selectedMusic.title || `Version ${selectedMusic.version}`}
    model={selectedMusic.model}
  />
)}
```

- [ ] **Step 4: Keep history list below player**

Ensure the music history list still displays below the new player.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/MusicPlayer/MusicPlayer.tsx
git commit -m "feat: integrate SpotifyWaveformPlayer into MusicPlayer"
```

---

## Task 7: Verify and Test

- [ ] **Step 1: Health check**

Run: `curl -s http://localhost:5173 | grep -o "spotify-player" | head -1`
Expected: "spotify-player"

- [ ] **Step 2: Test waveform rendering**

Open browser devtools, check waveform bars render (50 bars, amber + gray)

- [ ] **Step 3: Test playback controls**

Click play → audio should play
Click pause → audio should pause
Click waveform → should seek

- [ ] **Step 4: Test keyboard shortcuts**

Space → play/pause
Arrows → seek/volume
M → mute

- [ ] **Step 5: Test download links**

Right-click download → should download MP3

- [ ] **Step 6: Verify no console errors**

Open browser console, check for red errors

---

## Verification Checklist

- [ ] Waveform displays with 50 bars
- [ ] Amber progress indicator moves as song plays
- [ ] Click waveform to seek works
- [ ] Play/pause button toggles playback
- [ ] Volume slider adjusts volume
- [ ] Mute button works
- [ ] Keyboard shortcuts work (space, arrows, m)
- [ ] Download MP3 link works
- [ ] No console errors
- [ ] Responsive on mobile (test at 375px width)

---

## Spec Coverage Check

| Spec Requirement | Task |
|-----------------|------|
| Waveform visualization | Task 2 |
| Click to seek | Task 2 |
| Play/pause controls | Task 3 |
| Seek forward/back | Task 3 |
| Volume control | Task 3 |
| Mute toggle | Task 3 |
| Keyboard shortcuts | Task 4 |
| Download options | Task 5 |
| States (loading, error) | Not covered - add if time |
| Responsive design | CSS already supports |