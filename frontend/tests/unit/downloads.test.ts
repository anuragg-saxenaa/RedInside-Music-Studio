import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { putDownload, getDownload, listDownloads, deleteDownload } from '../../src/pwa/db';
import { downloadTrack, isDownloaded, removeDownload, listDownloadedTracks } from '../../src/pwa/downloads';

function mockCaches() {
  const store = new Map<string, Response>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).caches = {
    open: async () => ({
      put: async (req: string | Request, res: Response) => { store.set(typeof req === 'string' ? req : req.url, res); },
      match: async (req: string | Request) => store.get(typeof req === 'string' ? req : req.url),
      delete: async (req: string | Request) => store.delete(typeof req === 'string' ? req : req.url),
    }),
  };
  return store;
}

describe('downloads index', () => {
  beforeEach(async () => {
    for (const d of await listDownloads()) await deleteDownload(d.musicId);
  });

  it('stores and reads a download row', async () => {
    await putDownload({ musicId: 'm1', title: 'Song', artist: 'A', projectId: 'p1', bytes: 1234, status: 'done', addedAt: Date.now() });
    const row = await getDownload('m1');
    expect(row?.title).toBe('Song');
    expect(row?.bytes).toBe(1234);
  });

  it('lists and deletes', async () => {
    await putDownload({ musicId: 'm2', title: 'B', artist: '', projectId: 'p1', bytes: 1, status: 'done', addedAt: 1 });
    expect((await listDownloads()).length).toBe(1);
    await deleteDownload('m2');
    expect((await listDownloads()).length).toBe(0);
  });
});

describe('downloadTrack', () => {
  beforeEach(async () => {
    for (const d of await listDownloads()) await deleteDownload(d.musicId);
  });

  it('caches audio bytes + writes a done index row, then removes', async () => {
    mockCaches();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = async () => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 });

    await downloadTrack({ id: 'mX', title: 'T', artist: 'A', projectId: 'p' });
    expect(await isDownloaded('mX')).toBe(true);
    const list = await listDownloadedTracks();
    expect(list.find((d) => d.musicId === 'mX')?.bytes).toBe(4);

    await removeDownload('mX');
    expect(await isDownloaded('mX')).toBe(false);
  });

  it('marks status error on failed fetch', async () => {
    mockCaches();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = async () => new Response('nope', { status: 500 });
    await expect(downloadTrack({ id: 'mErr', projectId: 'p' })).rejects.toThrow();
    expect(await isDownloaded('mErr')).toBe(false);
  });

  it('throws QuotaError when the estimate shows no room', async () => {
    mockCaches();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = async () => new Response(new Uint8Array(100), { status: 200 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).storage = { estimate: async () => ({ usage: 999, quota: 1000 }), persist: async () => true };
    await expect(downloadTrack({ id: 'mQuota', projectId: 'p' })).rejects.toMatchObject({ name: 'QuotaError' });
    expect(await isDownloaded('mQuota')).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (navigator as any).storage;
  });
});
