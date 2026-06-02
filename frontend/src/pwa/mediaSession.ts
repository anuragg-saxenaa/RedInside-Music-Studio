// Wires the player to the OS Now Playing on WEB / macOS (Tauri) via the standard
// navigator.mediaSession API. On iOS (Capacitor) the native AudioPlayer plugin
// owns Now Playing + remote commands (it plays the audio), so these all no-op.
import { isNativeApp } from './nativeAudio';

export interface NowPlaying { title: string; artist: string; artworkUrl: string | null }
export interface MediaActions {
  play: () => void; pause: () => void; next: () => void; prev: () => void; seekTo: (fraction: number) => void;
}

function ms(): MediaSession | null {
  if (typeof navigator === 'undefined') return null;
  return navigator.mediaSession ?? null;
}

export function setNowPlaying(np: NowPlaying): void {
  if (isNativeApp()) return;
  const s = ms();
  if (!s || typeof MediaMetadata === 'undefined') return;
  try {
    s.metadata = new MediaMetadata({
      title: np.title || 'Untitled',
      artist: np.artist || 'RedInside Studio',
      album: 'RedInside Music Studio',
      artwork: np.artworkUrl
        ? [{ src: np.artworkUrl, sizes: '256x256', type: 'image/png' }, { src: np.artworkUrl, sizes: '512x512', type: 'image/png' }]
        : [],
    });
    s.playbackState = 'playing';
  } catch { /* ignore */ }
}

export function setPlaybackState(state: 'playing' | 'paused' | 'none'): void {
  if (isNativeApp()) return;
  const s = ms();
  if (s) { try { s.playbackState = state; } catch { /* ignore */ } }
}

export function setPosition(durationSec: number, positionSec: number): void {
  if (isNativeApp()) return;
  const s = ms();
  if (s && typeof s.setPositionState === 'function' && durationSec > 0 && isFinite(durationSec)) {
    try { s.setPositionState({ duration: durationSec, position: Math.min(positionSec, durationSec) }); } catch { /* ignore */ }
  }
}

export function clearNowPlaying(): void {
  if (isNativeApp()) return;
  const s = ms();
  if (s) { try { s.metadata = null; s.playbackState = 'none'; } catch { /* ignore */ } }
}

export function bindMediaActions(a: MediaActions): void {
  if (isNativeApp()) return; // native remote handled via nativeAudio.setRemoteHandlers
  const s = ms();
  if (!s) return;
  const set = (action: MediaSessionAction, h: (() => void) | null) => {
    try { s.setActionHandler(action, h); } catch { /* unsupported */ }
  };
  set('play', () => a.play());
  set('pause', () => a.pause());
  set('previoustrack', () => a.prev());
  set('nexttrack', () => a.next());
  set('seekto', (details?: unknown) => {
    const d = details as { seekTime?: number } | undefined;
    if (d && typeof d.seekTime === 'number') a.seekTo(d.seekTime);
  });
}
