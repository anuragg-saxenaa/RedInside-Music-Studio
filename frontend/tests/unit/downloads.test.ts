import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { putDownload, getDownload, listDownloads, deleteDownload } from '../../src/pwa/db';

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
