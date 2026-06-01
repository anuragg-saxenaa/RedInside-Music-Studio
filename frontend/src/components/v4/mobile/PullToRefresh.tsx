import { useRef, useState, type ReactNode } from 'react';
import { C } from '../shared/colors';
import { tapLight, notifySuccess } from '../../../lib/haptics';

interface Props {
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
}

const THRESHOLD = 70;

// iOS-style pull-to-refresh. Wraps a vertically-scrollable area; when the user
// pulls down past THRESHOLD at scrollTop 0 and releases, fires onRefresh.
export default function PullToRefresh({ onRefresh, children }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const armed = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    if ((scrollRef.current?.scrollTop ?? 0) <= 0) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
      armed.current = false;
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0 && (scrollRef.current?.scrollTop ?? 0) <= 0) {
      const damped = Math.min(110, dy * 0.5);
      setPull(damped);
      if (damped >= THRESHOLD && !armed.current) { armed.current = true; tapLight(); }
      if (damped < THRESHOLD) armed.current = false;
    }
  };
  const onTouchEnd = async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pull >= THRESHOLD) {
      setRefreshing(true);
      setPull(44);
      try { await onRefresh(); notifySuccess(); } catch { /* ignore */ }
      finally { setRefreshing(false); setPull(0); }
    } else {
      setPull(0);
    }
  };

  const spin = refreshing;
  return (
    <div
      ref={scrollRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden auto' }}
    >
      {/* Pull indicator */}
      <div style={{
        height: pull, marginTop: refreshing ? 0 : -pull,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: pulling.current ? 'none' : 'height 200ms ease, margin-top 200ms ease',
        overflow: 'hidden',
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          border: `2px solid ${C.red}`, borderTopColor: 'transparent',
          opacity: Math.min(1, pull / THRESHOLD),
          transform: spin ? 'none' : `rotate(${pull * 4}deg)`,
          animation: spin ? 'ris-ptr-spin 0.7s linear infinite' : 'none',
        }} />
      </div>
      <style>{`@keyframes ris-ptr-spin { to { transform: rotate(360deg); } }`}</style>
      {children}
    </div>
  );
}
