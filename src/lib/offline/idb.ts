/**
 * Tiny promise wrapper over IndexedDB (no dependencies).
 * Every method swallows storage errors and returns an empty result, so a
 * broken/blocked browser database can never break the app - it just means
 * "no offline support" for that session.
 */
const DB_NAME = "naha-offline";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("cache")) {
            const s = db.createObjectStore("cache", { keyPath: "key" });
            s.createIndex("ts", "ts");
            s.createIndex("ut", "ut");
          }
          if (!db.objectStoreNames.contains("outbox")) {
            db.createObjectStore("outbox", { keyPath: "id", autoIncrement: true });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void, fallback: T,
  pick?: (req: IDBRequest | void) => T): Promise<T> {
  return open().then((db) => {
    if (!db) return fallback;
    return new Promise<T>((resolve) => {
      try {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(pick ? pick(req) : ((req as IDBRequest | undefined)?.result as T));
        tx.onerror = () => resolve(fallback);
        tx.onabort = () => resolve(fallback);
      } catch {
        resolve(fallback);
      }
    });
  });
}

export const idb = {
  available: () => open().then((db) => !!db),
  get: <T>(store: string, key: IDBValidKey) =>
    run<T | undefined>(store, "readonly", (s) => s.get(key), undefined),
  /** Returns the stored key, or undefined if the write failed. */
  put: (store: string, value: unknown) =>
    run<IDBValidKey | undefined>(store, "readwrite", (s) => s.put(value), undefined),
  del: (store: string, key: IDBValidKey) =>
    run<void>(store, "readwrite", (s) => s.delete(key), undefined),
  all: <T>(store: string) => run<T[]>(store, "readonly", (s) => s.getAll(), []),
  byIndex: <T>(store: string, index: string, value: IDBValidKey) =>
    run<T[]>(store, "readonly", (s) => s.index(index).getAll(value), []),
  count: (store: string) => run<number>(store, "readonly", (s) => s.count(), 0),
  clear: (store: string) => run<void>(store, "readwrite", (s) => s.clear(), undefined),
  /** Delete the oldest rows (by `index`) until at most `max` remain. */
  trim: async (store: string, index: string, max: number) => {
    const n = await idb.count(store);
    if (n <= max) return;
    let toDelete = n - max;
    await run<void>(store, "readwrite", (s) => {
      const cur = s.index(index).openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (c && toDelete > 0) { c.delete(); toDelete--; c.continue(); }
      };
    }, undefined);
  },
};
