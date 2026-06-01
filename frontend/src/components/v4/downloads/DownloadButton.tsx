import { useState } from 'react';
import { C } from '../shared/colors';
import { DownloadIcon, DownloadedIcon } from '../shared/Icons';
import { useDownloads } from '../../../contexts/DownloadsContext';
import type { TrackMeta } from '../../../pwa/downloads';

interface Props {
  tracks: TrackMeta[];
  label?: string;          // when set, renders a labeled pill (playlist/album/project)
  size?: number;
}

// Spinner ring (CSS keyframe defined once below)
function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      style={{
        width: size, height: size, borderRadius: '50%',
        border: `2px solid ${C.red}55`, borderTopColor: C.red,
        display: 'inline-block', animation: 'ris-dl-spin 0.7s linear infinite',
      }}
    />
  );
}

export default function DownloadButton({ tracks, label, size = 18 }: Props) {
  const { statusOf, download, remove } = useDownloads();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const single = tracks.length === 1 ? tracks[0] : null;
  const allDone = tracks.length > 0 && tracks.every((t) => statusOf(t.id) === 'done');
  const anyBusy = busy || (single ? statusOf(single.id) === 'downloading' : false);

  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (anyBusy) return;
    if (single) {
      if (statusOf(single.id) === 'done') { await remove(single.id); return; }
      await download(single);
      return;
    }
    // multi
    setBusy(true);
    setProgress({ done: 0, total: tracks.length });
    try {
      // sequential with progress
      let done = 0;
      for (const t of tracks) {
        if (statusOf(t.id) !== 'done') await download(t);
        setProgress({ done: ++done, total: tracks.length });
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const keyframes = (
    <style>{`@keyframes ris-dl-spin { to { transform: rotate(360deg); } }`}</style>
  );

  // Icon-only (single track) variant
  if (!label) {
    const st = single ? statusOf(single.id) : 'idle';
    return (
      <>
        {keyframes}
        <button
          onClick={onClick}
          data-testid={single ? `download-btn-${single.id}` : undefined}
          title={st === 'done' ? 'Downloaded — tap to remove' : st === 'downloading' ? 'Downloading…' : 'Download for offline'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: st === 'done' ? C.red : 'rgba(255,255,255,0.45)',
          }}
        >
          {st === 'downloading'
            ? <Spinner size={size} />
            : st === 'done'
              ? <span data-testid={single ? `downloaded-${single.id}` : undefined}><DownloadedIcon size={size} /></span>
              : <DownloadIcon size={size} />}
        </button>
      </>
    );
  }

  // Labeled (multi) variant
  return (
    <>
      {keyframes}
      <button
        onClick={onClick}
        disabled={anyBusy}
        style={{
          display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', borderRadius: '9px', cursor: anyBusy ? 'default' : 'pointer',
          border: `1px solid ${allDone ? C.borderActive : C.border}`,
          background: allDone ? `${C.red}1a` : 'rgba(255,255,255,0.04)',
          color: allDone ? C.red : C.text, fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
        }}
      >
        {anyBusy ? <Spinner size={14} /> : allDone ? <DownloadedIcon size={15} /> : <DownloadIcon size={15} />}
        {anyBusy && progress ? `Downloading ${progress.done}/${progress.total}` : allDone ? 'Downloaded' : (label || 'Download')}
      </button>
    </>
  );
}
