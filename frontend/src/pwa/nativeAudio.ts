import { registerPlugin } from '@capacitor/core';

interface AudioPlayerPlugin {
  loadTrack(o: { url: string; title: string; artist: string; album: string; artworkUrl: string; volume: number; position?: number }): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(o: { position: number }): Promise<void>;
  setVolume(o: { volume: number }): Promise<void>;
  preload(o: { url: string }): Promise<void>;
  addListener(event: string, cb: (data: { currentTime?: number; duration?: number; isPlaying?: boolean }) => void): Promise<{ remove: () => void }>;
}

const AudioPlayer = registerPlugin<AudioPlayerPlugin>('AudioPlayer');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isNativeApp = (): boolean => !!(window as any).Capacitor?.isNativePlatform?.();

// Prebuffer the next track (native) so skip/auto-advance is instant.
export function preloadNext(url: string): void {
  if (isNativeApp() && url) AudioPlayer.preload({ url }).catch(() => {});
}

export interface AudioMeta { title?: string; artist?: string; album?: string; artworkUrl?: string | null }

type Handler = () => void;

// Remote (lock-screen / AirPods / car) handlers — wired once by the player context.
const remote: { next?: Handler; prev?: Handler; state?: (isPlaying: boolean) => void } = {};
export function setRemoteHandlers(h: { next: Handler; prev: Handler; state: (isPlaying: boolean) => void }) {
  remote.next = h.next; remote.prev = h.prev; remote.state = h.state;
}

// The currently-active shim receives time/ended events from the singleton player.
let active: NativeAudioShim | null = null;

if (isNativeApp()) {
  AudioPlayer.addListener('timeupdate', (d) => active?._onTime(d.currentTime ?? 0, d.duration ?? 0));
  AudioPlayer.addListener('ended', () => active?._onEnded());
  AudioPlayer.addListener('statechange', (d) => { active?._onState(!!d.isPlaying); remote.state?.(!!d.isPlaying); });
  AudioPlayer.addListener('remoteNext', () => remote.next?.());
  AudioPlayer.addListener('remotePrev', () => remote.prev?.());
}

// Minimal HTMLAudioElement-compatible shim backed by the native AVPlayer plugin.
// Implements only what WorkspaceContext uses: play/pause, currentTime, duration,
// volume, paused, ended, src, addEventListener('timeupdate'|'ended'|'loadedmetadata').
export class NativeAudioShim {
  private _src = '';
  private _meta: AudioMeta;
  private _vol = 1;
  private _cur = 0;
  private _dur = 0;
  private _paused = true;
  private _ended = false;
  private _loaded = false;
  private _metaFired = false;
  private _l: Record<string, Handler[]> = { timeupdate: [], ended: [], loadedmetadata: [] };

  constructor(url: string, meta: AudioMeta = {}) { this._src = url; this._meta = meta; }

  set src(v: string) { this._src = v; if (!v) { this._loaded = false; AudioPlayer.pause().catch(() => {}); } }
  get src() { return this._src; }
  set volume(v: number) { this._vol = v; AudioPlayer.setVolume({ volume: v }).catch(() => {}); }
  get volume() { return this._vol; }
  get currentTime() { return this._cur; }
  set currentTime(v: number) { this._cur = v; AudioPlayer.seek({ position: v }).catch(() => {}); }
  get duration() { return this._dur; }
  get paused() { return this._paused; }
  get ended() { return this._ended; }

  play(): Promise<void> {
    active = this;
    this._paused = false; this._ended = false;
    if (!this._loaded) {
      this._loaded = true;
      return AudioPlayer.loadTrack({
        url: this._src,
        title: this._meta.title ?? '',
        artist: this._meta.artist ?? 'RedInside Studio',
        album: this._meta.album ?? 'RedInside Music Studio',
        artworkUrl: this._meta.artworkUrl ?? '',
        volume: this._vol,
      }).catch(() => {});
    }
    return AudioPlayer.play().catch(() => {});
  }
  pause() { this._paused = true; AudioPlayer.pause().catch(() => {}); }

  addEventListener(type: string, cb: Handler) { (this._l[type] ||= []).push(cb); }
  removeEventListener(type: string, cb: Handler) { this._l[type] = (this._l[type] || []).filter((f) => f !== cb); }

  _onTime(cur: number, dur: number) {
    if (active !== this) return;
    this._cur = cur; this._dur = dur;
    if (!this._metaFired && dur > 0) { this._metaFired = true; this._l.loadedmetadata.forEach((f) => f()); }
    this._l.timeupdate.forEach((f) => f());
  }
  _onEnded() { if (active !== this) return; this._ended = true; this._paused = true; this._l.ended.forEach((f) => f()); }
  _onState(isPlaying: boolean) { if (active !== this) return; this._paused = !isPlaying; }
}

// Factory: native shim on iOS, real <audio> elsewhere. Returned object satisfies
// the subset of HTMLAudioElement the player uses.
export function createAudio(url: string, meta: AudioMeta = {}): HTMLAudioElement {
  if (isNativeApp()) return new NativeAudioShim(url, meta) as unknown as HTMLAudioElement;
  const a = new Audio(url);
  return a;
}
