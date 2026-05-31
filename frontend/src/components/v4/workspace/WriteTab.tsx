import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import WriteStudio from './WriteStudio';

export default function WriteTab() {
  const { activeProjectId } = useWorkspace();

  if (!activeProjectId) {
    return <div data-testid="write-tab" style={{ color: C.textDim, textAlign: 'center', padding: '48px 0' }}>Select a project first</div>;
  }

  return <WriteStudio />;
}
