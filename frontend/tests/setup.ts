import { expect, test } from 'vitest';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock AudioContext
class MockAudioContext {
  decodeAudioData = vi.fn(() => Promise.resolve({
    getChannelData: () => new Float32Array(44100),
    length: 44100,
    sampleRate: 44100,
    numberOfChannels: 1,
    duration: 1,
  }));
  close = vi.fn();
}

global.AudioContext = MockAudioContext as any;
global.webkitAudioContext = MockAudioContext as any;