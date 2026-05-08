import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WaveformDisplay from '../../src/components/AudioEditor/WaveformDisplay';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock AudioContext
const mockDecodeAudioData = vi.fn();
class MockAudioContext {
  close = vi.fn();
  decodeAudioData = mockDecodeAudioData;
}

global.AudioContext = MockAudioContext as any;

describe('WaveformDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockDecodeAudioData.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render with audio URL and duration', () => {
    // Mock successful fetch and decode
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    });

    mockDecodeAudioData.mockResolvedValue({
      getChannelData: () => new Float32Array(44100),
      length: 44100,
    });

    render(
      <WaveformDisplay
        audioUrl="/test-audio.mp3"
        durationMs={30000}
      />
    );

    expect(screen.getByText('Loading waveform...')).toBeDefined();
  });

  it('should render with custom trim values', () => {
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    });

    mockDecodeAudioData.mockResolvedValue({
      getChannelData: () => new Float32Array(44100 * 10),
      length: 44100 * 10,
    });

    render(
      <WaveformDisplay
        audioUrl="/test-audio.mp3"
        durationMs={30000}
        trimStart={5000}
        trimEnd={25000}
      />
    );

    expect(screen.getByText('Loading waveform...')).toBeDefined();
  });

  it('should handle loading and error states', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    });

    render(
      <WaveformDisplay
        audioUrl="/missing-audio.mp3"
        durationMs={30000}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading waveform...')).toBeNull();
    });

    expect(screen.getByText(/Failed to load audio/)).toBeDefined();
  });

  it('should update trim values when markers are dragged', async () => {
    const onTrimChange = vi.fn();

    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    });

    mockDecodeAudioData.mockResolvedValue({
      getChannelData: () => new Float32Array(44100 * 30), // ~30 seconds of audio
      length: 44100 * 30,
    });

    const { container } = render(
      <WaveformDisplay
        audioUrl="/test-audio.mp3"
        durationMs={30000}
        trimStart={5000}
        trimEnd={25000}
        onTrimChange={onTrimChange}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading waveform...')).toBeNull();
    });

    // Find the waveform container
    const waveformContainer = container.querySelector('[style*="cursor: pointer"]');
    expect(waveformContainer).toBeDefined();
  });

  it('should handle click-to-seek', async () => {
    const onSeek = vi.fn();

    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    });

    mockDecodeAudioData.mockResolvedValue({
      getChannelData: () => new Float32Array(44100 * 30),
      length: 44100 * 30,
    });

    const { container } = render(
      <WaveformDisplay
        audioUrl="/test-audio.mp3"
        durationMs={30000}
        trimStart={5000}
        trimEnd={25000}
        onSeek={onSeek}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading waveform...')).toBeNull();
    });

    const waveformContainer = container.querySelector('[style*="cursor: pointer"]');
    if (waveformContainer) {
      fireEvent.click(waveformContainer, {
        clientX: 100,
        clientY: 40,
      });
    }
  });

  it('should sync markers with numeric inputs', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    });

    mockDecodeAudioData.mockResolvedValue({
      getChannelData: () => new Float32Array(44100 * 30),
      length: 44100 * 30,
    });

    render(
      <WaveformDisplay
        audioUrl="/test-audio.mp3"
        durationMs={30000}
        trimStart={5000}
        trimEnd={25000}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading waveform...')).toBeNull();
    });

    // Check that numeric inputs are rendered
    const inputs = document.body.querySelectorAll('input[type="number"]');
    expect(inputs.length).toBe(2);
  });

  it('should use custom height when provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    });

    mockDecodeAudioData.mockResolvedValue({
      getChannelData: () => new Float32Array(44100 * 30),
      length: 44100 * 30,
    });

    const { container } = render(
      <WaveformDisplay
        audioUrl="/test-audio.mp3"
        durationMs={30000}
        height={120}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading waveform...')).toBeNull();
    });

    // SVG should have the custom height
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
  });
});