import { useState, useEffect } from 'react';
import { isNativeApp } from '../pwa/nativeAudio';

export function useMobile(breakpoint = 768) {
  // A native iOS/Android app (Capacitor) ALWAYS uses the single-panel mobile layout,
  // regardless of what the webview reports for innerWidth — otherwise it can fall back
  // to the wide 3-column desktop grid and overflow horizontally on the phone.
  const [isMobile, setIsMobile] = useState(() => isNativeApp() || window.innerWidth <= breakpoint);
  useEffect(() => {
    if (isNativeApp()) { setIsMobile(true); return; }
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handle = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handle);
    return () => mq.removeEventListener('change', handle);
  }, [breakpoint]);
  return isMobile;
}
