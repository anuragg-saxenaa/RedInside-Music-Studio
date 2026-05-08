// frontend/src/components/Mastering/VUMeter.tsx
import { useEffect, useState, useRef } from 'react';

interface VUMeterProps {
  level: number; // 0-100
  isActive: boolean;
}

export default function VUMeter({ level, isActive }: VUMeterProps) {
  const segments = 20;
  const activeSegments = Math.round((level / 100) * segments);
  const [peakLevel, setPeakLevel] = useState(0);
  const peakHoldRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Peak hold logic
  useEffect(() => {
    if (isActive && level > peakLevel) {
      setPeakLevel(level);

      // Clear existing timeout
      if (peakHoldRef.current) {
        clearTimeout(peakHoldRef.current);
      }

      // Hold peak for ~1.5 seconds then decay
      peakHoldRef.current = setTimeout(() => {
        setPeakLevel(0);
      }, 1500);
    }

    return () => {
      if (peakHoldRef.current) {
        clearTimeout(peakHoldRef.current);
      }
    };
  }, [level, isActive]);

  // Scale markings (dB-like markers)
  const scaleMarkers = [
    { label: '0', position: 100 },
    { label: '-6', position: 80 },
    { label: '-12', position: 60 },
    { label: '-24', position: 30 },
    { label: '-48', position: 0 },
  ];

  const getSegmentColor = (index: number, isLit: boolean) => {
    if (!isLit) return '#1A1A1A';

    // Red zone: 80-100% (segments 16-19)
    if (index >= 16) return '#E63946';
    // Amber zone: 60-80% (segments 12-15)
    if (index >= 12) return '#FFB800';
    // Green zone: 0-60% (segments 0-11)
    return '#00FF00';
  };

  const getGlowIntensity = (index: number, isLit: boolean) => {
    if (!isLit) return 'none';
    return `0 0 ${4 + index * 0.5}px ${getSegmentColor(index, isLit)}`;
  };

  const peakSegmentIndex = Math.round((peakLevel / 100) * segments) - 1;

  return (
    <div
      data-testid="vu-meter"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        height: '100px',
        background: 'linear-gradient(180deg, #2A2A2A 0%, #1A1A1A 50%, #0D0D0D 100%)',
        borderRadius: '8px',
        border: '1px solid #333',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.5)',
        padding: '8px 12px',
        gap: '8px',
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {/* Scale markers */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingTop: '2px',
          paddingBottom: '18px',
          width: '28px',
        }}
      >
        {scaleMarkers.map((marker) => (
          <span
            key={marker.label}
            style={{
              fontSize: '7px',
              color: '#666',
              textAlign: 'right',
              lineHeight: '1',
            }}
          >
            {marker.label}
          </span>
        ))}
      </div>

      {/* Meter housing */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, #0D0D0D 0%, #151515 100%)',
          borderRadius: '4px',
          border: '1px solid #2A2A2A',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8)',
          padding: '6px 4px',
          gap: '2px',
        }}
      >
        {/* LED segments */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column-reverse',
            gap: '2px',
            flex: 1,
          }}
        >
          {Array.from({ length: segments }).map((_, i) => {
            const segmentIndex = segments - 1 - i;
            const isLit = isActive && segmentIndex < activeSegments;
            const color = getSegmentColor(segmentIndex, isLit);
            const isPeak = isActive && segmentIndex === peakSegmentIndex && peakLevel > 0;

            return (
              <div
                key={i}
                style={{
                  width: '100%',
                  height: '3px',
                  borderRadius: '1px',
                  background: isLit || isPeak
                    ? `linear-gradient(180deg, ${color} 0%, ${color} 40%, ${adjustBrightness(color, -30)} 60%, ${color} 100%)`
                    : '#0D0D0D',
                  boxShadow: isLit || isPeak
                    ? getGlowIntensity(segmentIndex, true)
                    : 'none',
                  transition: 'background 50ms ease, box-shadow 50ms ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* LED glass effect overlay */}
                {isLit && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '0',
                      left: '10%',
                      right: '10%',
                      height: '1px',
                      background: 'rgba(255,255,255,0.5)',
                      borderRadius: '50%',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Peak hold indicator */}
        {isActive && peakLevel > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: `${6 + 3 + ((peakSegmentIndex + 1) / segments) * (100 - 6 - 3 - 4)}px`,
              right: '6px',
              width: '3px',
              height: '3px',
              background: '#E63946',
              borderRadius: '50%',
              boxShadow: '0 0 4px #E63946, 0 0 8px #E63946',
            }}
          />
        )}

        {/* LUFS label */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: '4px',
            borderTop: '1px solid #222',
            marginTop: '2px',
          }}
        >
          <span
            style={{
              fontSize: '7px',
              color: '#888',
              letterSpacing: '0.5px',
            }}
          >
            LUFS -14
          </span>
        </div>
      </div>

      {/* Right side decorative bolts */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          paddingTop: '2px',
          paddingBottom: '18px',
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #444 0%, #222 100%)',
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Helper function to adjust LED brightness
function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}