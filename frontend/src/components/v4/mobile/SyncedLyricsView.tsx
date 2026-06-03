import { useEffect, useRef, useMemo } from 'react';
import { LyricLine } from '../../../pwa/lyricTimings';
import { C } from '../shared/colors';

interface Props {
  lines: LyricLine[];
  currentTime: number;
  onSeek: (t: number) => void;
}

export default function SyncedLyricsView({ lines, currentTime, onSeek }: Props) {
  const activeIndex = useMemo(() => {
    if (!lines.length) return -1;
    // Find last line whose startTime <= currentTime
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startTime <= currentTime) idx = i;
    }
    return idx;
  }, [lines, currentTime]);

  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastActiveRef = useRef(-1);

  useEffect(() => {
    if (activeIndex < 0 || activeIndex === lastActiveRef.current) return;
    lastActiveRef.current = activeIndex;
    lineRefs.current[activeIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIndex]);

  if (!lines.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>
        No lyrics available
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      style={{
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '20px 28px 60px',
        WebkitOverflowScrolling: 'touch' as any,
        scrollbarWidth: 'none' as any,
      }}
    >
      <style>{`div::-webkit-scrollbar{display:none}`}</style>
      {lines.map((line, i) => {
        const isActive = i === activeIndex;
        const isNear = Math.abs(i - activeIndex) <= 1;
        const opacity = isActive ? 1 : isNear ? 0.65 : 0.35;
        const scale = isActive ? 1.05 : 1;

        if (line.isSection) {
          return (
            <div
              key={i}
              ref={el => { lineRefs.current[i] = el; }}
              onClick={() => onSeek(line.startTime)}
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase' as const,
                color: C.red,
                opacity: isActive ? 0.9 : 0.45,
                margin: '20px 0 10px',
                cursor: 'pointer',
                userSelect: 'none' as const,
              }}
            >
              {line.text}
            </div>
          );
        }

        return (
          <div
            key={i}
            ref={el => { lineRefs.current[i] = el; }}
            onClick={() => onSeek(line.startTime)}
            style={{
              fontSize: isActive ? '22px' : '20px',
              fontWeight: isActive ? 700 : 500,
              lineHeight: 1.4,
              color: '#fff',
              opacity,
              marginBottom: '14px',
              cursor: 'pointer',
              transition: 'opacity 0.3s ease, font-size 0.2s ease, font-weight 0.2s ease',
              transform: `scale(${scale})`,
              transformOrigin: 'left center',
              userSelect: 'none' as const,
              WebkitUserSelect: 'none' as const,
            }}
          >
            {line.text}
          </div>
        );
      })}
    </div>
  );
}
