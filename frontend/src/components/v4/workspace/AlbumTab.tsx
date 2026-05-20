import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';

export default function AlbumTab() {
  const { activeProjectId } = useWorkspace();

  if (!activeProjectId) {
    return <div data-testid="album-tab" style={{ color: C.textDim, textAlign: 'center', padding: '48px 0' }}>Select a project first</div>;
  }

  return (
    <div data-testid="album-tab">
      <div style={{ color: C.textDim, textAlign: 'center', padding: '48px 0' }}>
        Album Studio — coming soon
      </div>
    </div>
  );
}
