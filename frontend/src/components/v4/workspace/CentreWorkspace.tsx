import TabBar from './TabBar';
import SoundsTab from './SoundsTab';
import WriteTab from './WriteTab';
import CreateTab from './CreateTab';
import CraftTab from './CraftTab';
import ReleaseTab from './ReleaseTab';
import { useWorkspace } from '../../../contexts/WorkspaceContext';

export default function CentreWorkspace() {
  const { activeTab } = useWorkspace();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TabBar />
      <div style={{ flex: 1, overflow: 'hidden auto', padding: '24px' }}>
        {activeTab === 'sounds'  && <SoundsTab />}
        {activeTab === 'write'   && <WriteTab />}
        {activeTab === 'create'  && <CreateTab />}
        {activeTab === 'craft'   && <CraftTab />}
        {activeTab === 'release' && <ReleaseTab />}
      </div>
    </div>
  );
}
