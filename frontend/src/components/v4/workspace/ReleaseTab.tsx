import { useState, useEffect } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import AudioMasteringPanel from '../../Mastering/AudioMasteringPanel';
import ReadinessChecklist from '../release/ReadinessChecklist';
import SocialExportPanel from '../release/SocialExportPanel';

export default function ReleaseTab() {
  const { activeProjectId, selectedTrack, tracks } = useWorkspace();
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [hasLyrics, setHasLyrics] = useState(false);

  useEffect(() => {
    if (!activeProjectId) return;
    fetch(`/api/projects/${activeProjectId}/artwork`)
      .then(r => r.ok && r.status !== 204 ? r.blob() : null)
      .then(blob => setArtworkUrl(blob ? URL.createObjectURL(blob) : null))
      .catch(() => {});
    fetch(`/api/projects/${activeProjectId}/lyrics`)
      .then(r => r.json())
      .then((list: unknown[]) => setHasLyrics(Array.isArray(list) && list.length > 0))
      .catch(() => {});
  }, [activeProjectId]);

  if (!activeProjectId) {
    return <div style={{ color: C.textDim, textAlign: 'center', padding: '48px 0' }}>Select a project first</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} data-testid="release-tab">
      <ReadinessChecklist track={selectedTrack} artworkUrl={artworkUrl} hasLyrics={hasLyrics} />
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
