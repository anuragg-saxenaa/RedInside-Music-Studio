import { useState } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import AudioEditorPanel from '../../AudioEditor/AudioEditorPanel';
import MedleyPanel from '../../Medley/MedleyPanel';
import RemixSuggestions from '../shared/RemixSuggestions';
import VoiceDesign from '../../VoiceDesign/VoiceDesign';

type CraftSubTab = 'editor' | 'medley';

function VoiceSection({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden', marginTop: '16px' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.04)', border: 'none',
          borderBottom: open ? `1px solid ${C.border}` : 'none',
          color: C.text, padding: '12px 16px', textAlign: 'left', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: '13px', fontWeight: 600,
        }}
      >
        Voice Design
        <span style={{ color: C.textDim, fontSize: '10px' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ padding: '16px' }}>{children}</div>}
    </div>
  );
}

export default function CraftTab() {
  const { activeProjectId, selectedTrack, tracks } = useWorkspace();
  const [subTab, setSubTab] = useState<CraftSubTab>('editor');
  const [craftPreset, setCraftPreset] = useState<Record<string, unknown>>({});

  if (!activeProjectId) {
    return <div data-testid="craft-tab" style={{ color: C.textDim, textAlign: 'center', padding: '48px 0' }}>Select a project first</div>;
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
            presetOperations={craftPreset}
          />
          <RemixSuggestions onApply={ops => setCraftPreset(ops as Record<string, unknown>)} />
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

      <VoiceSection>
        <VoiceDesign projectId={activeProjectId} />
      </VoiceSection>
    </div>
  );
}
