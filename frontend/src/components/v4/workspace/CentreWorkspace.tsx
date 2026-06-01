import TabBar from './TabBar';
import SoundsTab from './SoundsTab';
import WriteTab from './WriteTab';
import AlbumTab from './AlbumTab';
import CraftTab from './CraftTab';
import ReleaseTab from './ReleaseTab';
import DownloadsView from '../downloads/DownloadsView';
import { useWorkspace } from '../../../contexts/WorkspaceContext';

export default function CentreWorkspace() {
  const { activeTab } = useWorkspace();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TabBar />
      <div style={{ flex: 1, overflow: 'hidden auto', padding: '24px' }}>
        {activeTab === 'sounds'    && <SoundsTab />}
        {activeTab === 'write'     && <WriteTab />}
        {activeTab === 'album'     && <AlbumTab />}
        {activeTab === 'craft'     && <CraftTab />}
        {activeTab === 'release'   && <ReleaseTab />}
        {activeTab === 'downloads' && <DownloadsView />}
      </div>
    </div>
  );
}
