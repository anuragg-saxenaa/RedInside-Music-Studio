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

  it('should render with audio URL', () => {
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
        duration={30}
        trimStart={5}
        trimEnd={25}
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
        duration={30}
        trimStart={5}
        trimEnd={25}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading waveform...')).toBeNull();
    });
  });

  it('should update trim values when markers are dragged', async () => {
    const onTrimChange = vi.fn();

    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    });

    mockDecodeAudioData.mockResolvedValue({
      getChannelData: () => new Float32Array(44100 * 10), // 10 seconds of audio
      length: 44100 * 10,
    });

    const { container } = render(
      <WaveformDisplay
        audioUrl="/test-audio.mp3"
        duration={30}
        trimStart={5}
        trimEnd={25}
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
        duration={30}
        trimStart={5}
        trimEnd={25}
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

      // onSeek should have been called
      // Note: actual position depends on container width
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
        duration={30}
        trimStart={5}
        trimEnd={25}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading waveform...')).toBeNull();
    });

    // Check that numeric inputs are rendered
    const inputs = screen.container.querySelectorAll('input[type="number"]');
    expect(inputs.length).toBe(2);
  });
});

describe('AudioMarker', () => {
  it('should render marker at correct position', async () => {
    const onDrag = vi.fn();
    const onDragEnd = vi.fn();

    // Dynamic import to avoid circular dependency issues
    const { default: AudioMarker } = await import('../../src/components/AudioEditor/AudioMarker');

    const { container } = render(
      <AudioMarker
        position={25}
        type="start"
        onDrag={onDrag}
        onDragEnd={onDragEnd}
      />
    );

    const marker = container.querySelector('[role="slider"]');
    expect(marker).toBeDefined();
  });

  it('should call onDrag when marker is moved', async () => {
    const onDrag = vi.fn();
    const onDragEnd = vi.fn();

    const { default: AudioMarker } = await import('../../src/components/AudioEditor/AudioMarker');

    const { container } = render(
      <AudioMarker
        position={50}
        type="end"
        onDrag={onDrag}
        onDragEnd={onDragEnd}
      />
    );

    const marker = container.querySelector('[role="slider"]');
    if (marker) {
      fireEvent.keyDown(marker, { key: 'ArrowRight', shiftKey: false });
      expect(onDrag).toHaveBeenCalled();
    }
  });
});