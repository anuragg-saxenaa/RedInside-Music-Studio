import { useState } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import TrackRow from '../tracks/TrackRow';
import ABComparator from '../tracks/ABComparator';
import YoutubeDownloader from '../../Downloader/YoutubeDownloader';
import MusicPlayer from '../../MusicPlayer/MusicPlayer';
import type { MusicGeneration } from '../../../types';

export default function SoundsTab() {
  const { tracks, activeProjectId, selectedLyrics, setSelectedTrack, setActiveTab, refreshTracks } = useWorkspace();
  const [showYoutube, setShowYoutube] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

  if (!activeProjectId) {
    return (
      <div style={{ color: C.textDim, textAlign: 'center', padding: '48px 0' }}>
        Select or create a project to get started
      </div>
    );
  }

  const handleMusicGenerated = (_music: MusicGeneration) => {
    refreshTracks();
    setShowGenerate(false);
  };

  return (
    <div data-testid="sounds-tab">
      {/* Action bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => { setShowGenerate(v => !v); setShowYoutube(false); }}
          data-testid="generate-btn"
          style={{
            background: showGenerate ? C.glassActive : 'rgba(255,255,255,0.06)',
            border: `1px solid ${showGenerate ? C.borderActive : C.border}`,
            borderRadius: '8px', color: C.text, padding: '8px 16px', fontSize: '12px',
            fontWeight: 600, cursor: 'pointer',
          }}
        >⚡ Generate New</button>
        <button
          onClick={() => { setShowYoutube(v => !v); setShowGenerate(false); }}
          data-testid="youtube-btn"
          style={{
            background: showYoutube ? C.glassActive : 'rgba(255,255,255,0.06)',
            border: `1px solid ${showYoutube ? C.borderActive : C.border}`,
            borderRadius: '8px', color: C.text, padding: '8px 16px', fontSize: '12px',
            fontWeight: 600, cursor: 'pointer',
          }}
        >▼ YouTube Import</button>
      </div>

      {/* Generate panel */}
      {showGenerate && (
        <div style={{ marginBottom: '16px', padding: '16px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: '10px' }}>
          <MusicPlayer
            projectId={activeProjectId}
            selectedLyrics={selectedLyrics}
            onMusicGenerated={handleMusicGenerated}
            allMusic={tracks}
          />
        </div>
      )}

      {/* YouTube panel */}
      {showYoutube && (
        <div style={{ marginBottom: '16px' }}>
          <YoutubeDownloader
            projectId={activeProjectId}
            onDownloaded={() => { refreshTracks(); setShowYoutube(false); }}
          />
        </div>
      )}

      {/* Track list */}
      <div data-testid="track-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {tracks.length === 0 && (
          <div style={{ color: C.textDim, textAlign: 'center', padding: '32px 0', fontSize: '13px' }}>
            No tracks yet — generate or import one above
          </div>
        )}
        {tracks.map(track => (
          <TrackRow
            key={track.id}
            track={track}
            onDoubleClick={() => { setSelectedTrack(track); setActiveTab('craft'); }}
          />
        ))}
      </div>

      {/* A/B Comparator */}
      {tracks.length >= 2 && <ABComparator />}
    </div>
  );
}
