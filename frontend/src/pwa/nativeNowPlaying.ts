import { registerPlugin } from '@capacitor/core';

export interface NowPlayingNativePlugin {
  update(o: { title: string; artist: string; album: string; artworkUrl: string | null; duration: number; position: number; isPlaying: boolean }): Promise<void>;
  setState(o: { isPlaying: boolean; position?: number }): Promise<void>;
  clear(): Promise<void>;
  addListener(event: string, cb: (data: { position?: number }) => void): Promise<{ remove: () => void }>;
}

export const NowPlayingNative = registerPlugin<NowPlayingNativePlugin>('NowPlaying');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isNativeApp = (): boolean => !!(window as any).Capacitor?.isNativePlatform?.();
