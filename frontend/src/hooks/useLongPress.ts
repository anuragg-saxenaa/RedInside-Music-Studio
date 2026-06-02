import { useRef, useCallback } from 'react';
import { tapMedium } from '../lib/haptics';

// Fires onLongPress after a press-and-hold (~480ms) that doesn't move much.
// Returns touch handlers to spread onto an element. Cancels on move/scroll.
export function useLongPress(onLongPress: () => void, ms = 480) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef({ x: 0, y: 0 });
  const fired = useRef(false);

  const clear = useCallback(() => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    fired.current = false;
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    timer.current = setTimeout(() => { fired.current = true; tapMedium(); onLongPress(); }, ms);
  }, [onLongPress, ms]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = Math.abs(e.touches[0].clientX - start.current.x);
    const dy = Math.abs(e.touches[0].clientY - start.current.y);
    if (dx > 8 || dy > 8) clear();
  }, [clear]);

  const onTouchEnd = useCallback(() => clear(), [clear]);

  // Consumers can check this in their onClick to skip the tap action if a long-press fired.
  const didFire = useCallback(() => fired.current, []);

  return { handlers: { onTouchStart, onTouchMove, onTouchEnd }, didFire };
}
