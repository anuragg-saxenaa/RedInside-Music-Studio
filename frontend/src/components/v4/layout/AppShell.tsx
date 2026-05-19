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
    <div style={{ background: C.bgApp, minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'SF Pro Text', Inter, system-ui, sans-serif", color: C.text }}>
      {mockBanner}
      {titlebar}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr 260px', gap: '8px', padding: '8px', minHeight: 0, paddingBottom: '0' }}>
        <div style={{ overflow: 'hidden auto', paddingBottom: '8px' }} data-testid="left-sidebar">
          {sidebar}
        </div>
        <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }} data-testid="centre-panel">
          {centre}
        </div>
        <div style={{ overflow: 'hidden auto', paddingBottom: '8px' }} data-testid="right-panel">
          {rightPanel}
        </div>
      </div>
      <div style={{ position: 'sticky', bottom: 0, zIndex: 200 }} data-testid="player-bar">
        {playerBar}
      </div>
    </div>
  );
}
