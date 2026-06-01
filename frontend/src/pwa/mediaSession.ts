// Wires the player to the OS Now Playing (lock-screen / Bluetooth / media keys).
// - Web / macOS (Tauri): uses the standard navigator.mediaSession API.
// - iOS (Capacitor): uses the native NowPlayingPlugin (MPNowPlayingInfoCenter),
//   because WKWebView does not reliably surface Media Session artwork to the
//   iOS lock screen. All functions no-op safely when nothing is available.
import { NowPlayingNative, isNativeApp } from './nativeNowPlaying';

export interface NowPlaying {
  title: string;
  artist: string;
  artworkUrl: string | null;
}

export interface MediaActions {
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  seekTo: (fraction: number) => void;
}

function ms(): MediaSession | null {
  if (typeof navigator === 'undefined') return null;
  return navigator.mediaSession ?? null;
}

// Mirror of what's currently playing, so partial updates (position-only,
// state-only) can be pushed to the native plugin with full context.
const cur = { title: '', artist: 'RedInside Studio', album: 'RedInside Music Studio', artworkUrl: null as string | null, duration: 0, position: 0, isPlaying: true };

function pushNative() {
  if (!isNativeApp()) return;
  NowPlayingNative.update({ ...cur }).catch(() => {});
}

export function setNowPlaying(np: NowPlaying): void {
  cur.title = np.title || 'Untitled';
  cur.artist = np.artist || 'RedInside Studio';
  cur.artworkUrl = np.artworkUrl;
  cur.isPlaying = true;
  pushNative();

  const s = ms();
  if (!s || typeof MediaMetadata === 'undefined') return;
  try {
    s.metadata = new MediaMetadata({
      title: cur.title,
      artist: cur.artist,
      album: cur.album,
      artwork: np.artworkUrl
        ? [
            { src: np.artworkUrl, sizes: '256x256', type: 'image/png' },
            { src: np.artworkUrl, sizes: '512x512', type: 'image/png' },
          ]
        : [],
    });
    s.playbackState = 'playing';
  } catch { /* ignore */ }
}

export function setPlaybackState(state: 'playing' | 'paused' | 'none'): void {
  if (state !== 'none') {
    cur.isPlaying = state === 'playing';
    if (isNativeApp()) NowPlayingNative.setState({ isPlaying: cur.isPlaying, position: cur.position }).catch(() => {});
  }
  const s = ms();
  if (s) { try { s.playbackState = state; } catch { /* ignore */ } }
}

export function setPosition(durationSec: number, positionSec: number): void {
  cur.duration = durationSec;
  cur.position = positionSec;
  // Native: lightweight state update (avoids re-fetching artwork every tick).
  if (isNativeApp()) NowPlayingNative.setState({ isPlaying: cur.isPlaying, position: positionSec }).catch(() => {});

  const s = ms();
  if (s && typeof s.setPositionState === 'function' && durationSec > 0 && isFinite(durationSec)) {
    try { s.setPositionState({ duration: durationSec, position: Math.min(positionSec, durationSec) }); } catch { /* ignore */ }
  }
}

export function clearNowPlaying(): void {
  if (isNativeApp()) NowPlayingNative.clear().catch(() => {});
  const s = ms();
  if (s) { try { s.metadata = null; s.playbackState = 'none'; } catch { /* ignore */ } }
}

export function bindMediaActions(a: MediaActions): void {
  // Native lock-screen / Bluetooth command events.
  if (isNativeApp()) {
    NowPlayingNative.addListener('remotePlay', () => a.play()).catch(() => {});
    NowPlayingNative.addListener('remotePause', () => a.pause()).catch(() => {});
    NowPlayingNative.addListener('remoteToggle', () => (cur.isPlaying ? a.pause() : a.play())).catch(() => {});
    NowPlayingNative.addListener('remoteNext', () => a.next()).catch(() => {});
    NowPlayingNative.addListener('remotePrev', () => a.prev()).catch(() => {});
    NowPlayingNative.addListener('remoteSeek', (d) => { if (typeof d.position === 'number') a.seekTo(d.position); }).catch(() => {});
  }

  const s = ms();
  if (!s) return;
  const set = (action: MediaSessionAction, h: (() => void) | null) => {
    try { s.setActionHandler(action, h); } catch { /* unsupported action */ }
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
