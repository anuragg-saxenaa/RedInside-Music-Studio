import { WorkspaceProvider } from '../contexts/WorkspaceContext';
import AppShell from '../components/v4/layout/AppShell';
import Titlebar from '../components/v4/layout/Titlebar';
import LeftSidebar from '../components/v4/layout/LeftSidebar';
import RightPanel from '../components/v4/layout/RightPanel';
import PlayerBar from '../components/v4/layout/PlayerBar';
import CentreWorkspace from '../components/v4/workspace/CentreWorkspace';
import { useWorkspace } from '../contexts/WorkspaceContext';

function StudioV4Inner() {
  const { isMockMode } = useWorkspace();
  return (
    <AppShell
      titlebar={<Titlebar />}
      sidebar={<LeftSidebar />}
      centre={<CentreWorkspace />}
      rightPanel={<RightPanel />}
      playerBar={<PlayerBar />}
      mockBanner={isMockMode ? (
        <div style={{ background: '#FFB800', color: '#000', textAlign: 'center', padding: '6px 12px', fontSize: '13px', fontWeight: 600, zIndex: 9999 }}>
          TEST MODE — MiniMax mock active
        </div>
      ) : undefined}
    />
  );
}

export default function StudioV4() {
  return (
    <WorkspaceProvider>
      <StudioV4Inner />
    </WorkspaceProvider>
  );
}
