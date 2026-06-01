import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setNowPlaying, clearNowPlaying, bindMediaActions } from '../../src/pwa/mediaSession';

function mockMediaSession() {
  const handlers: Record<string, (() => void) | null> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis.navigator as any).mediaSession = {
    metadata: null,
    setActionHandler: (a: string, h: (() => void) | null) => { handlers[a] = h; },
    setPositionState: vi.fn(),
    playbackState: 'none',
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).MediaMetadata = class { title: string; artist: string; artwork: unknown; constructor(i: { title: string; artist: string; artwork: unknown }) { this.title = i.title; this.artist = i.artist; this.artwork = i.artwork; } };
  return handlers;
}

describe('mediaSession', () => {
  beforeEach(() => { mockMediaSession(); });

  it('sets now-playing metadata', () => {
    setNowPlaying({ title: 'Waalian', artist: 'Karan', artworkUrl: 'http://x/art.png' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const md = (navigator as any).mediaSession.metadata;
    expect(md.title).toBe('Waalian');
    expect(md.artist).toBe('Karan');
  });

  it('clears metadata', () => {
    setNowPlaying({ title: 'X', artist: '', artworkUrl: null });
    clearNowPlaying();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((navigator as any).mediaSession.metadata).toBeNull();
  });

  it('binds action handlers that call the player callbacks', () => {
    const handlers = mockMediaSession();
    const play = vi.fn();
    bindMediaActions({ play, pause: vi.fn(), next: vi.fn(), prev: vi.fn(), seekTo: vi.fn() });
    handlers['play']?.();
    expect(play).toHaveBeenCalled();
  });

  it('no-ops safely when mediaSession is absent', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis.navigator as any).mediaSession;
    expect(() => setNowPlaying({ title: 'A', artist: '', artworkUrl: null })).not.toThrow();
    expect(() => clearNowPlaying()).not.toThrow();
    expect(() => bindMediaActions({ play: () => {}, pause: () => {}, next: () => {}, prev: () => {}, seekTo: () => {} })).not.toThrow();
  });
});
