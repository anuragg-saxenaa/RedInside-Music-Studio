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
  const title = t.title || 'Untitled';
  const artist = t.artist || '';
  // Preserve the original request time across all status transitions.
  const existing = await getDownload(t.id);
  const addedAt = existing?.addedAt ?? Date.now();
  await putDownload({ musicId: t.id, title, artist, projectId: t.projectId, bytes: 0, status: 'pending', addedAt });
  try {
    const res = await fetch(audioUrl(t.id));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.clone().arrayBuffer();

    // Quota guard — don't write if it would clearly exceed available space.
    const { usage, quota } = await storageEstimate();
    if (quota > 0 && usage + buf.byteLength > quota) {
      throw new QuotaError();
    }

    const cache = await caches.open(AUDIO_CACHE);
    try {
      await cache.put(
        audioUrl(t.id),
        new Response(buf, { status: 200, headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(buf.byteLength) } }),
      );
    } catch (e) {
      // Cache write can still hit the real quota even if the estimate passed.
      if (e instanceof DOMException && e.name === 'QuotaExceededError') throw new QuotaError();
      throw e;
    }
    await putDownload({ musicId: t.id, title, artist, projectId: t.projectId, bytes: buf.byteLength, status: 'done', addedAt });
  } catch (e) {
    await putDownload({ musicId: t.id, title, artist, projectId: t.projectId, bytes: 0, status: 'error', addedAt });
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
  // Delete the index row first so the UI never shows a "downloaded" track whose
  // cache delete failed. An orphaned cache entry is harmless (SW LRU-evicts it).
  await deleteDownload(id);
  try {
    const cache = await caches.open(AUDIO_CACHE);
    await cache.delete(audioUrl(id));
  } catch { /* cache may not exist; orphan is harmless */ }
}

export async function listDownloadedTracks(): Promise<DownloadRow[]> {
  return (await listDownloads()).filter((d) => d.status === 'done');
}

export async function removeAllDownloads(): Promise<void> {
  for (const d of await listDownloads()) await removeDownload(d.musicId);
}
