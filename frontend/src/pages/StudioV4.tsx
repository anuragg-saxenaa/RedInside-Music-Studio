import { WorkspaceProvider } from '../contexts/WorkspaceContext';
import AppShell from '../components/v4/layout/AppShell';
import Titlebar from '../components/v4/layout/Titlebar';
import LeftSidebar from '../components/v4/layout/LeftSidebar';
import GlobalSearch from '../components/v4/layout/GlobalSearch';
import RightPanel from '../components/v4/layout/RightPanel';
import PlayerBar from '../components/v4/layout/PlayerBar';
import CentreWorkspace from '../components/v4/workspace/CentreWorkspace';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { useState, useEffect } from 'react';

function StudioV4Inner() {
  const { isMockMode } = useWorkspace();
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Ensure window.__studioWs is always connected — YoutubeDownloader + VocalRemovalCard read it directly
  useWebSocket(() => {});
  return (
    <>
      <AppShell
        titlebar={<Titlebar />}
        sidebar={<LeftSidebar onOpenSearch={() => setShowSearch(true)} />}
        centre={<CentreWorkspace />}
        rightPanel={<RightPanel />}
        playerBar={<PlayerBar />}
        mockBanner={isMockMode ? (
          <div style={{ background: '#FFB800', color: '#000', textAlign: 'center', padding: '6px 12px', fontSize: '13px', fontWeight: 600, zIndex: 9999 }}>
            TEST MODE — MiniMax mock active
          </div>
        ) : undefined}
      />
      {showSearch && <GlobalSearch onClose={() => setShowSearch(false)} />}
    </>
  );
}

export default function StudioV4() {
  return (
    <WorkspaceProvider>
      <StudioV4Inner />
    </WorkspaceProvider>
  );
}
