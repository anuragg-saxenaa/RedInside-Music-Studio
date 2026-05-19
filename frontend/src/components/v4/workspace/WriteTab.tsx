import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import LyricsEditor from '../../LyricsEditor/LyricsEditor';
import type { LyricsGeneration } from '../../../types';

export default function WriteTab() {
  const { activeProjectId, setSelectedLyrics } = useWorkspace();

  if (!activeProjectId) {
    return <div data-testid="write-tab" style={{ color: C.textDim, textAlign: 'center', padding: '48px 0' }}>Select a project first</div>;
  }

  return (
    <div data-testid="write-tab">
      <LyricsEditor
        projectId={activeProjectId}
        onLyricsGenerated={(lyrics: LyricsGeneration) => setSelectedLyrics(lyrics)}
      />
    </div>
  );
}
