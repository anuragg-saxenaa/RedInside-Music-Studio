// Unified audio stop registry — all audio players register here so stopping one stops all
const _stopCallbacks = new Set<() => void>();

export function registerAudioStop(fn: () => void): () => void {
  _stopCallbacks.add(fn);
  return () => _stopCallbacks.delete(fn);
}

export function stopAllRegisteredAudio() {
  _stopCallbacks.forEach(fn => {
    try { fn(); } catch (_) {}
  });
  // Also stop any DOM <audio> elements not in registry
  document.querySelectorAll<HTMLAudioElement>('audio').forEach(el => {
    try { el.pause(); el.currentTime = 0; } catch (_) {}
  });
}
