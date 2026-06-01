import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface DownloadRow {
  musicId: string;
  title: string;
  artist: string;
  projectId: string;
  bytes: number;
  status: 'pending' | 'done' | 'error';
  addedAt: number;
}

interface RisDB extends DBSchema {
  downloads: { key: string; value: DownloadRow };
}

let _db: Promise<IDBPDatabase<RisDB>> | null = null;
function db() {
  if (!_db) {
    _db = openDB<RisDB>('ris-downloads', 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('downloads')) {
          d.createObjectStore('downloads', { keyPath: 'musicId' });
        }
      },
    });
  }
  return _db;
}

export async function putDownload(row: DownloadRow): Promise<void> {
  await (await db()).put('downloads', row);
}

export async function getDownload(id: string): Promise<DownloadRow | undefined> {
  return (await db()).get('downloads', id);
}

export async function listDownloads(): Promise<DownloadRow[]> {
  return (await db()).getAll('downloads');
}

export async function deleteDownload(id: string): Promise<void> {
  await (await db()).delete('downloads', id);
}
