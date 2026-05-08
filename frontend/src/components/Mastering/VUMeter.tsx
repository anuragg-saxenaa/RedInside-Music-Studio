// frontend/src/components/Mastering/VUMeter.tsx
import { useEffect, useState } from 'react';

interface VUMeterProps {
  level: number; // 0-100
  isActive: boolean;
}

export default function VUMeter({ level, isActive }: VUMeterProps) {
  const segments = 20;
  const activeSegments = Math.round((level / 100) * segments);

  return (
    <div data-testid="vu-meter" style={{ display: 'flex', gap: '2px', height: '100px' }}>
      {Array.from({ length: segments }).map((_, i) => {
        const segmentIndex = segments - 1 - i;
        const isLit = isActive && segmentIndex < activeSegments;

        let color = '#1A1A1A';
        if (isLit) {
          if (segmentIndex >= 16) color = '#E63946'; // Red
          else if (segmentIndex >= 12) color = '#FFB800'; // Amber
          else color = '#00FF00'; // Green
        }

        return (
          <div
            key={i}
            style={{
              width: '8px',
              height: '4px',
              background: color,
              borderRadius: '1px',
              boxShadow: isLit ? `0 0 4px ${color}` : 'none',
              transition: 'background 50ms ease',
            }}
          />
        );
      })}
    </div>
  );
}
