import { useState, useMemo } from 'react';
import { C } from '../shared/colors';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import TrackRow from '../tracks/TrackRow';
import TrackEditPanel from '../tracks/TrackEditPanel';
import ABComparator from '../tracks/ABComparator';
import YoutubeDownloader from '../../Downloader/YoutubeDownloader';
import CreateSongPanel from './CreateSongPanel';
import DownloadButton from '../downloads/DownloadButton';
import { TrackListSkeleton } from '../shared/Skeleton';

function fmtTotalDuration(s: number) {
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function SoundsTab() {
  const { tracks, tracksLoading, activeProjectId, setSelectedTrack, setActiveTab, refreshTracks } = useWorkspace();
  const [showYoutube, setShowYoutube] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'duration' | 'bpm'>('date');

  const displayTracks = useMemo(() => {
    let list = tracks.filter(t =>
      !search || (t.title || `Track v${t.version}`).toLowerCase().includes(search.toLowerCase())
    );
    if (sortBy === 'title') list = [...list].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    if (sortBy === 'duration') list = [...list].sort((a, b) => (b.duration_seconds ?? 0) - (a.duration_seconds ?? 0));
    return list;
  }, [tracks, search, sortBy]);

  if (!activeProjectId) {
    return (
      <div style={{ color: C.textDim, textAlign: 'center', padding: '48px 0' }}>
        Select or create a project to get started
      </div>
    );
  }

  return (
    <div data-testid="sounds-tab">
      {/* Summary header */}
      {tracks.length > 0 && (
        <div style={{ color: C.textDim, fontSize: '11px', marginBottom: '8px', letterSpacing: '0.2px' }}>
          {tracks.length} track{tracks.length !== 1 ? 's' : ''}
          {tracks.reduce((s, t) => s + (t.duration_seconds ?? 0), 0) > 0 &&
            ` · ${fmtTotalDuration(tracks.reduce((s, t) => s + (t.duration_seconds ?? 0), 0))}`
          }
        </div>
      )}

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
        {tracks.length > 0 && (
          <DownloadButton
            label="Download all"
            tracks={tracks.map(t => ({ id: t.id, title: t.title || `Track v${t.version}`, artist: t.artist, projectId: t.project_id }))}
          />
        )}
      </div>

      {/* Search + sort bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tracks…"
          data-testid="track-search"
          style={{
            flex: 1, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`,
            borderRadius: '8px', padding: '7px 12px', color: C.text,
            fontSize: '12px', outline: 'none',
          }}
        />
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          data-testid="track-sort"
          style={{
            background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`,
            borderRadius: '8px', padding: '7px 10px', color: C.text, fontSize: '12px',
            cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="date">Newest</option>
          <option value="title">A–Z</option>
          <option value="duration">Duration</option>
          <option value="bpm">BPM</option>
        </select>
      </div>

      {/* Generate panel */}
      {showGenerate && (
        <div style={{ marginBottom: '16px', padding: '16px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: '10px' }}>
          <CreateSongPanel onDone={() => setShowGenerate(false)} />
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
        {tracksLoading && tracks.length === 0 && <TrackListSkeleton rows={7} />}
        {!tracksLoading && displayTracks.length === 0 && (
          <div style={{ color: C.textDim, textAlign: 'center', padding: '32px 0', fontSize: '13px' }}>
            {tracks.length === 0
              ? 'No tracks yet — generate or import one above'
              : 'No tracks match your search'}
          </div>
        )}
        {displayTracks.map(track => (
          <div key={track.id}>
            <TrackRow
              track={track}
              onDoubleClick={() => { setSelectedTrack(track); setActiveTab('craft'); }}
              onEdit={() => setExpandedTrackId(prev => prev === track.id ? null : track.id)}
              isEditOpen={expandedTrackId === track.id}
            />
            {expandedTrackId === track.id && (
              <TrackEditPanel
                track={track}
                onClose={() => setExpandedTrackId(null)}
                onSaved={() => { setExpandedTrackId(null); refreshTracks(); }}
              />
            )}
          </div>
        ))}
      </div>

      {/* A/B Comparator */}
      {tracks.length >= 2 && <ABComparator />}
    </div>
  );
}
