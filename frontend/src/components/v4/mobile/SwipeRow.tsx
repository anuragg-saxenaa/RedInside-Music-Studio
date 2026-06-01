import { useRef, useState, type ReactNode } from 'react';
import { C } from '../shared/colors';
import { tapMedium } from '../../../lib/haptics';

interface Props {
  children: ReactNode;
  onDelete: () => void;
  enabled?: boolean;
}

const REVEAL = 88; // width of the revealed delete action

// iOS Mail–style swipe-left-to-delete. Drag left to reveal a glass delete
// action; tap it to delete. Clamped so it never takes the whole screen.
// Direct-DOM transform during drag = smooth; React state only tracks open/closed.
export default function SwipeRow({ children, onDelete, enabled = true }: Props) {
  const fg = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const g = useRef({ x0: 0, y0: 0, axis: '' as '' | 'x' | 'y', x: 0 });

  if (!enabled) return <>{children}</>;

  const setX = (x: number, animate: boolean) => {
    if (!fg.current) return;
    fg.current.style.transition = animate ? 'transform 260ms cubic-bezier(0.22,1,0.36,1)' : 'none';
    fg.current.style.transform = `translateX(${x}px)`;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    g.current = { x0: e.touches[0].clientX, y0: e.touches[0].clientY, axis: '', x: open ? -REVEAL : 0 };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - g.current.x0;
    const dy = e.touches[0].clientY - g.current.y0;
    if (g.current.axis === '') {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (g.current.axis !== 'x') return;
    const base = open ? -REVEAL : 0;
    let x = base + dx;
    if (x > 0) x = 0;
    if (x < -REVEAL) x = -REVEAL - (x + REVEAL) * 0.4; // rubber-band past reveal
    g.current.x = Math.max(-REVEAL, base + dx);
    setX(x, false);
  };
  const onTouchEnd = () => {
    if (g.current.axis !== 'x') return;
    const shouldOpen = g.current.x < -REVEAL / 2;
    setOpen(shouldOpen);
    setX(shouldOpen ? -REVEAL : 0, true);
  };

  // Tapping the foreground while open just closes it (don't trigger row action).
  const onFgClickCapture = (e: React.MouseEvent) => {
    if (open) { e.stopPropagation(); e.preventDefault(); setOpen(false); setX(0, true); }
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Delete action (glass) */}
      <button
        onClick={() => { tapMedium(); onDelete(); }}
        aria-label="Delete"
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: REVEAL,
          border: 'none', cursor: 'pointer', color: '#fff',
          background: 'linear-gradient(90deg, rgba(230,57,70,0.85), rgba(200,30,45,0.95))',
          backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
          fontSize: '11px', fontWeight: 600,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
        Delete
      </button>
      {/* Foreground (swipeable) */}
      <div
        ref={fg}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClickCapture={onFgClickCapture}
        style={{ position: 'relative', background: C.bgApp, willChange: 'transform' }}
      >
        {children}
      </div>
    </div>
  );
}
