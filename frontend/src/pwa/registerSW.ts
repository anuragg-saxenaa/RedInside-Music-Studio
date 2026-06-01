// Registers the service worker in production only. Disabled via ?nopwa or
// localStorage 'ris_pwa_disabled'. Emits 'ris-sw-update' when a new SW waits.
export function pwaDisabled(): boolean {
  if (new URLSearchParams(location.search).has('nopwa')) return true;
  return localStorage.getItem('ris_pwa_disabled') === '1';
}

export async function registerSW(): Promise<void> {
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
}

export function enablePWA(): void {
  localStorage.removeItem('ris_pwa_disabled');
}
