declare module 'virtual:pwa-register' {
  export function registerSW(opts?: {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisteredSW?: (swUrl: string, r: ServiceWorkerRegistration | undefined) => void;
  }): (reload?: boolean) => Promise<void>;
}
