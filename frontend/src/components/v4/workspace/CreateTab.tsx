import { useState } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import ArtworkGenerator from '../../ArtworkGenerator/ArtworkGenerator';
import VideoPreview from '../../VideoPreview/VideoPreview';
import VoiceDesign from '../../VoiceDesign/VoiceDesign';

function Section({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }} data-testid={testId}>
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
        {title}
        <span style={{ color: C.textDim, fontSize: '10px' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ padding: '16px' }}>{children}</div>}
    </div>
  );
}

export default function CreateTab() {
  const { activeProjectId, selectedTrack } = useWorkspace();

  if (!activeProjectId) {
    return <div data-testid="create-tab" style={{ color: C.textDim, textAlign: 'center', padding: '48px 0' }}>Select a project first</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }} data-testid="create-tab">
      <Section title="Artwork" testId="section-artwork">
        <ArtworkGenerator projectId={activeProjectId} musicId={selectedTrack?.id} />
      </Section>
      <Section title="Video" testId="section-video">
        <VideoPreview projectId={activeProjectId} selectedMusic={selectedTrack ?? null} />
      </Section>
      <Section title="Voice" testId="section-voice">
        <VoiceDesign projectId={activeProjectId} />
      </Section>
    </div>
  );
}
