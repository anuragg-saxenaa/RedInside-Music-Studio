import type { ReactNode } from 'react';
import { C } from '../shared/colors';

interface AppShellProps {
  titlebar: ReactNode;
  sidebar: ReactNode;
  centre: ReactNode;
  rightPanel: ReactNode;
  playerBar: ReactNode;
  mockBanner?: ReactNode;
}

export default function AppShell({ titlebar, sidebar, centre, rightPanel, playerBar, mockBanner }: AppShellProps) {
  return (
    <div style={{
      background: C.bgApp,
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Outfit', 'DM Sans', -apple-system, sans-serif",
      color: C.text,
    }}>
      {mockBanner}
      {titlebar}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '232px 1fr 268px',
        overflow: 'hidden',
        gap: '1px',
        background: C.border,
      }}>
        <div style={{ overflow: 'hidden', background: 'rgba(0,0,0,0.72)' }} data-testid="left-sidebar">
          {sidebar}
        </div>
        <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0, background: 'rgba(4,1,2,0.92)' }} data-testid="centre-panel">
          {centre}
        </div>
        <div style={{ overflow: 'hidden auto', background: 'rgba(0,0,0,0.72)' }} data-testid="right-panel">
          {rightPanel}
        </div>
      </div>
      <div style={{ flexShrink: 0, zIndex: 200 }}>
        {playerBar}
      </div>
    </div>
  );
}
