// True when running inside a native webview (Tauri macOS desktop, or Capacitor
// iOS). Native shells must NOT use a service worker: the custom origin
// (tauri://localhost / capacitor://localhost) breaks Workbox navigation caching
// (stale cached index → blank screen).
export function isTauri(): boolean {
  if (import.meta.env.VITE_TAURI || import.meta.env.VITE_NATIVE) return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return !!(w.isTauri || w.__TAURI_INTERNALS__ || w.__TAURI__ || w.Capacitor?.isNativePlatform?.());
}

// Registers the service worker in production only. Disabled via ?nopwa or
// localStorage 'ris_pwa_disabled'. Emits 'ris-sw-update' when a new SW waits.
export function pwaDisabled(): boolean {
  if (new URLSearchParams(location.search).has('nopwa')) return true;
  return localStorage.getItem('ris_pwa_disabled') === '1';
}

// Tear down any SW + Cache API entries left over in this webview. Used by the
// Tauri build to recover from a stale service worker baked by an older build.
async function purgeServiceWorker(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* nothing to purge */
  }
}

export async function registerSW(): Promise<void> {
  // Native desktop app: never register; actively purge any stale SW/caches.
  if (isTauri()) {
    await purgeServiceWorker();
    return;
  }
  if (!import.meta.env.PROD || pwaDisabled() || !('serviceWorker' in navigator)) return;
  try {
    const mod = await import('virtual:pwa-register');
    mod.registerSW({
      immediate: true,
      onNeedRefresh() {
        window.dispatchEvent(new CustomEvent('ris-sw-update'));
      },
    });
  } catch {
    /* SW unavailable — app runs exactly as today */
  }
}

export async function unregisterSW(): Promise<void> {
  localStorage.setItem('ris_pwa_disabled', '1');
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }
  // Reload so the now-unregistered SW stops intercepting this session.
  location.reload();
}

export function enablePWA(): void {
  localStorage.removeItem('ris_pwa_disabled');
  // Strip ?nopwa so the reload actually re-enables registration.
  const url = new URL(location.href);
  if (url.searchParams.has('nopwa')) {
    url.searchParams.delete('nopwa');
    history.replaceState(null, '', url.toString());
  }
}
