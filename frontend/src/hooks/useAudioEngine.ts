/**
 * useAudioEngine — Web Audio API equalizer chain for the persistent HTMLAudioElement.
 *
 * Wraps the single persistent audio element with an AudioContext source node and
 * a chain of BiquadFilters (8 bands). The chain is set up once on first call,
 * then reused for all subsequent tracks. No-op on SSR or if the browser doesn't
 * support Web Audio.
 *
 * Usage:
 *   const { eqGains, setBand, toggleEq } = useAudioEngine();
 */
import { useState, useCallback, useEffect } from 'react';

export interface EqState {
  /** 8 gain values in dB, one per frequency band */
  bands: number[];
  enabled: boolean;
}

const BANDS = [
  { type: 'lowshelf'  as BiquadFilterType, freq: 80  },
  { type: 'peaking'   as BiquadFilterType, freq: 250 },
  { type: 'peaking'   as BiquadFilterType, freq: 500 },
  { type: 'peaking'   as BiquadFilterType, freq: 1000 },
  { type: 'peaking'   as BiquadFilterType, freq: 2500 },
  { type: 'peaking'   as BiquadFilterType, freq: 5000 },
  { type: 'peaking'   as BiquadFilterType, freq: 8000 },
  { type: 'highshelf' as BiquadFilterType, freq: 16000 },
];

const STORAGE_KEY = 'ris-eq-state';

function loadState(): EqState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as EqState;
  } catch (_) {}
  return { bands: BANDS.map(() => 0), enabled: false };
}

function saveState(s: EqState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (_) {}
}

// Singleton chain — shared across all hook instances
let _ctx: AudioContext | null = null;
let _source: MediaElementAudioSourceNode | null = null;
let _gainNode: GainNode | null = null;
let _filters: BiquadFilterNode[] = [];
let _initialized = false;

function getOrCreateChain(audioEl: HTMLAudioElement): { ctx: AudioContext; filters: BiquadFilterNode[]; gainNode: GainNode } | null {
  if (typeof AudioContext === 'undefined' && typeof (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext === 'undefined') {
    return null;
  }
  try {
    if (!_initialized) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      _ctx = new Ctor();
      _gainNode = _ctx.createGain();
      _filters = BANDS.map((b) => {
        const f = _ctx!.createBiquadFilter();
        f.type = b.type;
        f.frequency.value = b.freq;
        f.gain.value = 0;
        f.Q.value = 1.4;
        return f;
      });
      // Chain: source → filters → gain → destination
      // source is connected lazily on first play (requires user gesture)
      let prev: AudioNode = _filters[0];
      for (let i = 1; i < _filters.length; i++) {
        prev.connect(_filters[i]);
        prev = _filters[i];
      }
      prev.connect(_gainNode);
      _gainNode.connect(_ctx.destination);
      _initialized = true;
    }

    if (!_source) {
      _source = _ctx!.createMediaElementSource(audioEl);
      _source.connect(_filters[0]);
    }

    return { ctx: _ctx!, filters: _filters, gainNode: _gainNode! };
  } catch (e) {
    console.warn('[AudioEngine] Web Audio setup failed:', e);
    return null;
  }
}

export function useAudioEngine() {
  const [eqState, setEqState] = useState<EqState>(loadState);

  // Lazily initialize the Web Audio chain using the persistent audio element.
  const ensureChain = useCallback(() => {
    // The persistent audio lives on window._risAudio
    const audioEl = (window as unknown as { _risAudio?: HTMLAudioElement })._risAudio;
    if (!audioEl) return null;
    return getOrCreateChain(audioEl);
  }, []);

  /** Set gain (dB) for one band, -12 to +12 */
  const setBand = useCallback((band: number, gainDb: number) => {
    const chain = ensureChain();
    setEqState(prev => {
      const bands = [...prev.bands];
      bands[band] = Math.max(-12, Math.min(12, gainDb));
      const next = { ...prev, bands };
      saveState(next);
      if (chain) {
        chain.filters[band].gain.value = bands[band];
      }
      return next;
    });
  }, [ensureChain]);

  /** Toggle EQ on/off */
  const toggleEq = useCallback(() => {
    setEqState(prev => {
      const next = { ...prev, enabled: !prev.enabled };
      saveState(next);
      if (_gainNode) {
        _gainNode.gain.setTargetAtTime(next.enabled ? 1 : 0, _ctx!.currentTime, 0.02);
      }
      return next;
    });
  }, []);

  // Apply persisted gains to filters whenever the chain is ready
  // and the enabled state changes.
  useEffect(() => {
    const apply = () => {
      const chain = ensureChain();
      if (!chain) return;
      eqState.bands.forEach((g, i) => { chain.filters[i].gain.value = g; });
      chain.gainNode.gain.value = eqState.enabled ? 1 : 0;
    };
    // Defer until next tick so audio element is available
    const id = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(id);
  }, [eqState, ensureChain]);

  return { eqState, setBand, toggleEq };
}
