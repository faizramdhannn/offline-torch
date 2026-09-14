// Cache generik berbasis IndexedDB — dipakai untuk menyimpan payload besar
// (ratusan KB - puluhan MB) di browser user sendiri, bertahan lintas
// refresh/tab/browser baru (beda dengan localStorage yang kuotanya kecil,
// atau cache in-memory yang hilang saat halaman di-reload).
const DB_NAME = "app_cache";
const STORE_NAME = "kv";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface CacheEntry<T> {
  value: T;
  ts: number;
}

// Best-effort: kalau IndexedDB gagal/tidak tersedia (private mode, dsb),
// resolve ke undefined/no-op alih-alih melempar error — cache hanyalah
// optimisasi, bukan sumber data utama.
export async function idbGet<T>(key: string): Promise<CacheEntry<T> | undefined> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result as CacheEntry<T> | undefined);
      req.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ value, ts: Date.now() } as CacheEntry<T>, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore — non-fatal
  }
}

export function isCacheFresh(entry: CacheEntry<unknown> | undefined, ttlMs: number): boolean {
  return !!entry && Date.now() - entry.ts < ttlMs;
}
