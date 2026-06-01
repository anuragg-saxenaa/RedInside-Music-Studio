import { useEffect, useState, useCallback } from 'react';
import { C } from '../shared/colors';
import { TrashIcon, PlayIcon } from '../shared/Icons';
import { useWorkspace } from '../../../contexts/WorkspaceContext';
import { useDownloads } from '../../../contexts/DownloadsContext';
import { listDownloadedTracks, storageEstimate, removeAllDownloads } from '../../../pwa/downloads';
import type { DownloadRow } from '../../../pwa/db';

function fmtBytes(n: number): string {
  if (n <= 0) return '0 MB';
  const mb = n / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export default function DownloadsView() {
  const { ids, remove, ctxRefresh, playTrackById } = useDownloadsViewDeps();
  const [rows, setRows] = useState<DownloadRow[]>([]);
  const [est, setEst] = useState<{ usage: number; quota: number }>({ usage: 0, quota: 0 });

  const refresh = useCallback(async () => {
    setRows(await listDownloadedTracks());
    setEst(await storageEstimate());
  }, []);

  useEffect(() => { refresh(); }, [refresh, ids]);

  const pct = est.quota > 0 ? Math.min(100, (est.usage / est.quota) * 100) : 0;

  return (
    <div data-testid="downloads-view" style={{ padding: '20px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: C.text, letterSpacing: '-0.3px' }}>Downloads</div>
        {rows.length > 0 && (
          <button
            onClick={async () => { await removeAllDownloads(); await ctxRefresh(); await refresh(); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', border: `1px solid rgba(255,107,107,0.3)`, background: 'rgba(255,107,107,0.06)', color: '#ff6b6b', fontSize: '12px', fontWeight: 600 }}
          >
            <TrashIcon size={14} /> Delete all
          </button>
        )}
      </div>

      {/* Storage bar */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: C.textDim, marginBottom: '5px' }}>
          <span>{rows.length} downloaded · {fmtBytes(rows.reduce((s, r) => s + r.bytes, 0))}</span>
          {est.quota > 0 && <span>{fmtBytes(est.usage)} of {fmtBytes(est.quota)} used</span>}
        </div>
        <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: C.red, transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ color: C.textDim, textAlign: 'center', padding: '48px 0', fontSize: '13px', lineHeight: 1.6 }}>
          No downloads yet.<br />Tap the download icon on any song to make it available offline.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {rows.map((r) => (
            <div key={r.musicId} style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 13px',
              borderRadius: '10px', border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.025)',
            }}>
              <button
                onClick={() => playTrackById(r.musicId)}
                title="Play"
                style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${C.red}, ${C.redDark})`, color: '#fff' }}
              >
                <span style={{ marginLeft: 2 }}><PlayIcon size={14} /></span>
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.text, fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                <div style={{ color: C.textDim, fontSize: '11px' }}>{r.artist || 'RedInside Studio'} · {fmtBytes(r.bytes)}</div>
              </div>
              <button
                onClick={async () => { await remove(r.musicId); await refresh(); }}
                title="Remove download"
                data-testid={`remove-download-${r.musicId}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 6, flexShrink: 0 }}
              >
                <TrashIcon size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Bridges WorkspaceContext (player) + DownloadsContext (remove) for this view.
function useDownloadsViewDeps() {
  const { ids, remove, refresh: ctxRefresh } = useDownloads();
  const ws = useWorkspace();
  const playTrackById = (id: string) => {
    const t = ws.tracks.find((x) => x.id === id);
    if (t) { ws.playTrack(t); return; }
    // Track belongs to another project — switch to it so it loads & can play.
    listDownloadedTracks().then((list) => {
      const row = list.find((r) => r.musicId === id);
      if (row) ws.setActiveProjectId(row.projectId);
    });
  };
  return { ids, remove, ctxRefresh, playTrackById };
}
