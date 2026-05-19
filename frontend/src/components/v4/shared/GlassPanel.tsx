import type { CSSProperties, ReactNode } from 'react';
import { C } from './colors';

interface GlassPanelProps {
  children: ReactNode;
  style?: CSSProperties;
  active?: boolean;
  'data-testid'?: string;
}

export default function GlassPanel({ children, style, active, 'data-testid': testId }: GlassPanelProps) {
  return (
    <div
      data-testid={testId}
      style={{
        background: active ? C.glassActive : C.glass,
        backdropFilter: 'blur(18px) saturate(1.2)',
        border: `1px solid ${active ? C.borderActive : C.border}`,
        borderRadius: '10px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
