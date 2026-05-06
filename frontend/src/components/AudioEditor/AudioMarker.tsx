import { useRef, useCallback } from 'react';

export interface AudioMarkerProps {
  position: number           // 0-100 percentage
  type: 'start' | 'end'
  onDrag: (position: number) => void
  onDragEnd?: (position: number) => void
  height?: number
  color?: string
}

export default function AudioMarker({
  position,
  type,
  onDrag,
  onDragEnd,
  height = 80,
  color = '#E63946',
}: AudioMarkerProps) {
  const isDragging = useRef(false);
  const markerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isDragging.current = true;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;

      // Get parent container to calculate relative position
      const parent = markerRef.current?.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));

      onDrag(percent);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        onDragEnd?.(position);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [onDrag, onDragEnd, position]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 1 : 0.1;
    let newPosition = position;

    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      newPosition = Math.max(0, position - step);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      newPosition = Math.min(100, position + step);
    }

    if (newPosition !== position) {
      e.preventDefault();
      onDrag(newPosition);
    }
  }, [position, onDrag]);

  // Triangle indicator pointing up or down based on marker type
  const triangleStyle: React.CSSProperties = type === 'start'
    ? {
        position: 'absolute',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderBottom: `8px solid ${color}`,
      }
    : {
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: `8px solid ${color}`,
      };

  return (
    <div
      ref={markerRef}
      role="slider"
      aria-label={`${type} trim marker`}
      aria-valuenow={position}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      style={{
        position: 'absolute',
        left: `${position}%`,
        top: 0,
        width: '2px',
        height: `${height}px`,
        backgroundColor: '#FFFFFF',
        cursor: 'ew-resize',
        transform: 'translateX(-50%)',
        zIndex: 10,
        userSelect: 'none',
      }}
    >
      {/* Handle bar */}
      <div
        style={{
          position: 'absolute',
          top: type === 'start' ? '4px' : 'auto',
          bottom: type === 'end' ? '4px' : 'auto',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '12px',
          height: '4px',
          backgroundColor: color,
          borderRadius: '2px',
        }}
      />

      {/* Triangle indicator */}
      <div style={triangleStyle} />
    </div>
  );
}