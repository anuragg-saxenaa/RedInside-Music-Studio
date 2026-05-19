import { useState } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import AudioEditorPanel from '../../AudioEditor/AudioEditorPanel';
import MedleyPanel from '../../Medley/MedleyPanel';
import RemixSuggestions from '../shared/RemixSuggestions';

type CraftSubTab = 'editor' | 'medley';

export default function CraftTab() {
  const { activeProjectId, selectedTrack, tracks } = useWorkspace();
  const [subTab, setSubTab] = useState<CraftSubTab>('editor');

  if (!activeProjectId) {
    return <div style={{ color: C.textDim, textAlign: 'center', padding: '48px 0' }}>Select a project first</div>;
  }

  return (
    <div data-testid="craft-tab">
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        {([['editor', 'Audio Editor'], ['medley', 'Medley Mixer']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            style={{
              background: subTab === id ? C.glassActive : 'transparent',
              border: `1px solid ${subTab === id ? C.borderActive : C.border}`,
              borderRadius: '6px', color: subTab === id ? C.text : C.textDim,
              padding: '6px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}
          >{label}</button>
        ))}
      </div>

      {subTab === 'editor' && selectedTrack && (
        <>
          <AudioEditorPanel
            projectId={activeProjectId}
            audioUrl={`/api/music/${selectedTrack.id}/file`}
            trackId={selectedTrack.id}
            musicId={selectedTrack.id}
          />
          <RemixSuggestions onApply={ops => console.log('Apply remix ops:', ops)} />
        </>
      )}

      {subTab === 'editor' && !selectedTrack && (
        <div style={{ color: C.textDim, textAlign: 'center', padding: '32px 0' }}>
          Select a track from SOUNDS to edit
        </div>
      )}

      {subTab === 'medley' && (
        <MedleyPanel projectId={activeProjectId} musicList={tracks} />
      )}
    </div>
  );
}
