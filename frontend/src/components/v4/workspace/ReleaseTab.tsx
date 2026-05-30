import { useState, useEffect } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { useAuthFetch } from '../../../hooks/useAuthFetch';
import AudioMasteringPanel from '../../Mastering/AudioMasteringPanel';
import ReadinessChecklist from '../release/ReadinessChecklist';
import SocialExportPanel from '../release/SocialExportPanel';
import VideoPreview from '../../VideoPreview/VideoPreview';

function VideoSection({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
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
        Video
        <span style={{ color: C.textDim, fontSize: '10px' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ padding: '16px' }}>{children}</div>}
    </div>
  );
}

export default function ReleaseTab() {
  const { activeProjectId, selectedTrack, tracks } = useWorkspace();
  const authFetch = useAuthFetch();
  const [hasLyrics, setHasLyrics] = useState(false);

  useEffect(() => {
    if (!activeProjectId) return;
    authFetch(`/api/lyrics?projectId=${activeProjectId}`)
      .then(r => r.json())
      .then((list: unknown[]) => setHasLyrics(Array.isArray(list) && list.length > 0))
      .catch(() => {});
  }, [activeProjectId]);

  if (!activeProjectId) {
    return <div style={{ color: C.textDim, textAlign: 'center', padding: '48px 0' }}>Select a project first</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} data-testid="release-tab">
      <VideoSection>
        <VideoPreview projectId={activeProjectId} selectedMusic={selectedTrack ?? null} />
      </VideoSection>
      <ReadinessChecklist track={selectedTrack} hasLyrics={hasLyrics} />
      <hr style={{ border: 'none', borderTop: `1px solid ${C.border}` }} />
      <SocialExportPanel track={selectedTrack} />
      <hr style={{ border: 'none', borderTop: `1px solid ${C.border}` }} />
      <div>
        <div style={{ color: C.textLabel, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '12px' }}>
          Mastering
        </div>
        <AudioMasteringPanel projectId={activeProjectId} allMusic={tracks} />
      </div>
    </div>
  );
}
