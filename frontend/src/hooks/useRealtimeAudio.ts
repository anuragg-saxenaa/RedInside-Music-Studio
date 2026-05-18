import { useEffect, useRef, useCallback } from 'react';
import type { AudioOperations } from '../components/AudioEditor/ControlsSidebar';

interface UseRealtimeAudioOptions {
  audioUrl: string;
  operations: AudioOperations;
  isPlaying: boolean;
  onEnded?: () => void;
  onTimeUpdate?: (time: number) => void;
  onDurationDetected?: (duration: number) => void;
}

export function useRealtimeAudio({
  audioUrl,
  operations,
  isPlaying,
  onEnded,
  onTimeUpdate,
  onDurationDetected,
}: UseRealtimeAudioOptions) {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const startedAtRef = useRef<number>(0);
  const startOffsetRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const operationsRef = useRef(operations);

  // Keep refs in sync
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { operationsRef.current = operations; }, [operations]);

  // Load audio buffer once per audioUrl
  useEffect(() => {
    if (!audioUrl) return;
    let cancelled = false;

    const ctx = new AudioContext();
    ctxRef.current = ctx;

    (async () => {
      try {
        const resp = await fetch(audioUrl);
        const arrayBuf = await resp.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrayBuf);
        if (!cancelled) {
          bufferRef.current = decoded;
          onDurationDetected?.(decoded.duration);
        }
      } catch (e) {
        console.error('useRealtimeAudio: failed to decode audio', e);
      }
    })();

    return () => {
      cancelled = true;
      sourceRef.current?.stop();
      cancelAnimationFrame(rafRef.current);
      ctx.close();
      ctxRef.current = null;
      bufferRef.current = null;
    };
  }, [audioUrl]);

  const buildGraph = useCallback(() => {
    try {
    const ctx = ctxRef.current;
    const buffer = bufferRef.current;
    if (!ctx || !buffer) return;

    sourceRef.current?.stop();
    cancelAnimationFrame(rafRef.current);

    const ops = operationsRef.current;

    const source = ctx.createBufferSource();

    // Speed + pitch
    const speedFactor = ops.speed || 1.0;
    const pitchRatio = ops.pitchShiftEnabled
      ? Math.pow(2, (ops.pitchShiftSemitones || 0) / 12)
      : 1.0;
    source.playbackRate.value = speedFactor * pitchRatio;

    // Reverse: create reversed buffer copy
    if (ops.reverse) {
      const rev = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch).slice().reverse();
        rev.copyToChannel(data, ch);
      }
      source.buffer = rev;
    } else {
      source.buffer = buffer;
    }

    let node: AudioNode = source;

    // Bass boost — BiquadFilter lowshelf 80Hz
    if (ops.bassBoostEnabled) {
      const bass = ctx.createBiquadFilter();
      bass.type = 'lowshelf';
      bass.frequency.value = 80;
      bass.gain.value = ops.bassBoostGainDb || 6;
      node.connect(bass);
      node = bass;
    }

    // Reverb — ConvolverNode with procedural impulse
    if (ops.reverbEnabled) {
      const convolver = ctx.createConvolver();
      convolver.buffer = buildImpulse(ctx, ops.reverbRoomScale / 100, ops.reverbDamping / 100);
      const dryGain = ctx.createGain();
      const wetGain = ctx.createGain();
      const wetLevel = ops.reverbWetLevel || 0.3;
      dryGain.gain.value = 1 - wetLevel;
      wetGain.gain.value = wetLevel;
      const merger = ctx.createGain();
      merger.gain.value = 1;
      node.connect(dryGain);
      node.connect(convolver);
      convolver.connect(wetGain);
      dryGain.connect(merger);
      wetGain.connect(merger);
      node = merger;
    }

    // Echo — DelayNode + feedback GainNode
    if (ops.echoEnabled) {
      const delay = ctx.createDelay(3.0);
      delay.delayTime.value = ops.echoDelay || 0.3;
      const feedback = ctx.createGain();
      feedback.gain.value = Math.min(0.9, ops.echoDecay || 0.5);
      const echoOut = ctx.createGain();
      echoOut.gain.value = 1;
      node.connect(echoOut);
      node.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(echoOut);
      node = echoOut;
    }

    // Volume with fade envelope
    const gainNode = ctx.createGain();
    gainNode.gain.value = ops.volume || 1.0;
    node.connect(gainNode);
    node = gainNode;

    node.connect(ctx.destination);
    sourceRef.current = source;

    if (isPlayingRef.current) {
      const offset = Math.max(0, Math.min(startOffsetRef.current, buffer.duration - 0.01));
      ctx.resume().catch(() => {});
      source.start(0, offset);
      startedAtRef.current = ctx.currentTime - offset / speedFactor;

      const tick = () => {
        const elapsed = (ctx.currentTime - startedAtRef.current) * speedFactor;
        onTimeUpdate?.(elapsed);
        if (elapsed < buffer.duration) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          startOffsetRef.current = 0;
          onEnded?.();
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    }
    } catch (e) {
      console.error('useRealtimeAudio buildGraph error:', e);
    }
  }, [onEnded, onTimeUpdate]);

  // Debounced rebuild when ops change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(buildGraph, 50);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [operations, buildGraph]);

  // Play/pause
  useEffect(() => {
    if (!isPlaying) {
      sourceRef.current?.stop();
      cancelAnimationFrame(rafRef.current);
      const ctx = ctxRef.current;
      if (ctx) {
        const elapsed = (ctx.currentTime - startedAtRef.current) * (operationsRef.current.speed || 1.0);
        startOffsetRef.current = Math.max(0, elapsed);
      }
    } else {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      buildGraph();
    }
  }, [isPlaying, buildGraph]);

  const seek = useCallback((time: number) => {
    startOffsetRef.current = time;
    if (isPlayingRef.current) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      buildGraph();
    }
  }, [buildGraph]);

  return { seek };
}

function buildImpulse(ctx: AudioContext, roomScale: number, damping: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * (0.5 + roomScale * 3)));
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, damping * 10 + 1);
    }
  }
  return impulse;
}
