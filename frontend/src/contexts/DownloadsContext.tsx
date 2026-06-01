import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { downloadTrack, downloadMany, removeDownload, listDownloadedTracks, type TrackMeta } from '../pwa/downloads';

type Status = 'idle' | 'downloading' | 'done';

interface Ctx {
  ids: Set<string>;
  statusOf: (id: string) => Status;
  download: (t: TrackMeta) => Promise<void>;
  downloadSet: (t: TrackMeta[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const C = createContext<Ctx | null>(null);

export function DownloadsProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const list = await listDownloadedTracks();
      setIds(new Set(list.map((d) => d.musicId)));
    } catch { /* IndexedDB unavailable — leave empty */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const mark = (id: string, on: boolean) =>
    setBusy((p) => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; });

  const download = useCallback(async (t: TrackMeta) => {
    mark(t.id, true);
    try { await downloadTrack(t); } finally { mark(t.id, false); await refresh(); }
  }, [refresh]);

  const downloadSet = useCallback(async (ts: TrackMeta[]) => {
    ts.forEach((t) => mark(t.id, true));
    try { await downloadMany(ts); } finally { ts.forEach((t) => mark(t.id, false)); await refresh(); }
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await removeDownload(id);
    await refresh();
  }, [refresh]);

  const statusOf = useCallback((id: string): Status =>
    busy.has(id) ? 'downloading' : ids.has(id) ? 'done' : 'idle', [busy, ids]);

  return (
    <C.Provider value={{ ids, statusOf, download, downloadSet, remove, refresh }}>
      {children}
    </C.Provider>
  );
}

export function useDownloads(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error('useDownloads must be used within DownloadsProvider');
  return v;
}
