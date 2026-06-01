import { putDownload, getDownload, listDownloads, deleteDownload, type DownloadRow } from './db';

const AUDIO_CACHE = 'ris-audio-v1';
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const audioUrl = (id: string) => `${API_BASE}/api/music/${id}/file`;

export interface TrackMeta {
  id: string;
  title?: string;
  artist?: string;
  projectId: string;
}

export class QuotaError extends Error {
  constructor(message = 'Not enough storage space') {
    super(message);
    this.name = 'QuotaError';
  }
}

let _persistRequested = false;
async function requestPersistOnce(): Promise<void> {
  if (_persistRequested) return;
  _persistRequested = true;
  try { await navigator.storage?.persist?.(); } catch { /* best effort */ }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number }> {
  if (navigator.storage?.estimate) {
    const e = await navigator.storage.estimate();
    return { usage: e.usage || 0, quota: e.quota || 0 };
  }
  return { usage: 0, quota: 0 };
}

export async function isDownloaded(id: string): Promise<boolean> {
  const row = await getDownload(id);
  return row?.status === 'done';
}

export async function downloadTrack(t: TrackMeta): Promise<void> {
  await requestPersistOnce();
  await putDownload({ musicId: t.id, title: t.title || 'Untitled', artist: t.artist || '', projectId: t.projectId, bytes: 0, status: 'pending', addedAt: Date.now() });
  try {
    const res = await fetch(audioUrl(t.id));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.clone().arrayBuffer();

    // Quota guard — don't write if it would exceed available space.
    const { usage, quota } = await storageEstimate();
    if (quota > 0 && usage + buf.byteLength > quota) {
      throw new QuotaError();
    }

    const cache = await caches.open(AUDIO_CACHE);
    await cache.put(
      audioUrl(t.id),
      new Response(buf, { status: 200, headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(buf.byteLength) } }),
    );
    await putDownload({ musicId: t.id, title: t.title || 'Untitled', artist: t.artist || '', projectId: t.projectId, bytes: buf.byteLength, status: 'done', addedAt: Date.now() });
  } catch (e) {
    await putDownload({ musicId: t.id, title: t.title || 'Untitled', artist: t.artist || '', projectId: t.projectId, bytes: 0, status: 'error', addedAt: Date.now() });
    throw e;
  }
}

export async function downloadMany(tracks: TrackMeta[], onProgress?: (done: number, total: number) => void): Promise<void> {
  let done = 0;
  for (const t of tracks) {
    if (!(await isDownloaded(t.id))) {
      try { await downloadTrack(t); } catch { /* keep going; row marked error */ }
    }
    onProgress?.(++done, tracks.length);
  }
}

export async function removeDownload(id: string): Promise<void> {
  try {
    const cache = await caches.open(AUDIO_CACHE);
    await cache.delete(audioUrl(id));
  } catch { /* cache may not exist */ }
  await deleteDownload(id);
}

export async function listDownloadedTracks(): Promise<DownloadRow[]> {
  return (await listDownloads()).filter((d) => d.status === 'done');
}

export async function removeAllDownloads(): Promise<void> {
  for (const d of await listDownloads()) await removeDownload(d.musicId);
}
