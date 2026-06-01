import { useRef, type ReactNode } from 'react';
import { C } from '../shared/colors';
import { tapMedium } from '../../../lib/haptics';

interface Props {
  children: ReactNode;
  onDelete: () => void;
  deleteLabel?: string;
  enabled?: boolean;
}

const REVEAL = 84;   // resting reveal width
const TRIGGER = 150;  // full-swipe auto-delete threshold

// iOS-style swipe-left-to-delete row. Drag left to reveal a red Delete action;
// keep dragging past TRIGGER to delete immediately. Tap the revealed button to
// confirm. Direct DOM transforms keep it smooth.
export default function SwipeRow({ children, onDelete, deleteLabel = 'Delete', enabled = true }: Props) {
  const fg = useRef<HTMLDivElement>(null);
  const g = useRef({ x0: 0, dx: 0, open: false, axisLock: '' as '' | 'x' | 'y', y0: 0 });

  const setX = (x: number, animate: boolean) => {
    if (!fg.current) return;
    fg.current.style.transition = animate ? 'transform 240ms cubic-bezier(0.22,1,0.36,1)' : 'none';
    fg.current.style.transform = `translateX(${x}px)`;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    g.current.x0 = e.touches[0].clientX;
    g.current.y0 = e.touches[0].clientY;
    g.current.axisLock = '';
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - g.current.x0;
    const dy = e.touches[0].clientY - g.current.y0;
    if (g.current.axisLock === '') {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.current.axisLock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (g.current.axisLock !== 'x') return;
    const base = g.current.open ? -REVEAL : 0;
    let x = base + dx;
    if (x > 0) x = 0;
    g.current.dx = x;
    setX(x, false);
  };
  const onTouchEnd = () => {
    if (g.current.axisLock !== 'x') return;
    const x = g.current.dx;
    if (x <= -TRIGGER) { tapMedium(); setX(-window.innerWidth, true); setTimeout(onDelete, 180); return; }
    if (x <= -REVEAL / 2) { g.current.open = true; setX(-REVEAL, true); }
    else { g.current.open = false; setX(0, true); }
  };

  if (!enabled) return <>{children}</>;

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Delete action behind */}
      <button
        onClick={() => { tapMedium(); onDelete(); }}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: REVEAL,
          border: 'none', cursor: 'pointer', color: '#fff', fontSize: '13px', fontWeight: 600,
          background: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
        {deleteLabel}
      </button>
      {/* Foreground (swipeable) */}
      <div
        ref={fg}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ position: 'relative', background: C.bgApp, willChange: 'transform' }}
      >
        {children}
      </div>
    </div>
  );
}
