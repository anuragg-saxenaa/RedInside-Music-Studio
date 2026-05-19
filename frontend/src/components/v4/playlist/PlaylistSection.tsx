import { C } from '../shared/colors';
import GlassPanel from '../shared/GlassPanel';
import { useWorkspace } from '../../../contexts/WorkspaceContext';

export default function PlaylistSection() {
  const { playlists } = useWorkspace();
  return (
    <GlassPanel style={{ padding: '12px' }} data-testid="playlist-section">
      <div style={{ color: C.textLabel, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '8px' }}>
        Playlists
      </div>
      {playlists.length === 0 && (
        <div style={{ color: C.textDim, fontSize: '11px' }}>No playlists yet</div>
      )}
    </GlassPanel>
  );
}
