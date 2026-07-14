/**
 * Wrapper mínimo de IndexedDB em Promises (doc §4.8). Um único object store
 * chave→valor; os namespaces por mundo vivem no prefixo das chaves
 * (ex.: `w_ab12:player`, `w_ab12:chunk:3,-2`).
 */

const DB_NAME = "voxel-quest";
const STORE = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function dbGet<T>(key: string): Promise<T | undefined> {
  const db = await open();
  return request(db.transaction(STORE).objectStore(STORE).get(key));
}

export async function dbSet(key: string, value: unknown): Promise<void> {
  const db = await open();
  await request(db.transaction(STORE, "readwrite").objectStore(STORE).put(value, key));
}

/** Grava várias chaves numa única transação (autosave de chunks). */
export async function dbSetMany(entries: [string, unknown][]): Promise<void> {
  if (entries.length === 0) return;
  const db = await open();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  for (const [key, value] of entries) store.put(value, key);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Remove todas as chaves com um prefixo (excluir mundo). */
export async function dbDeletePrefix(prefix: string): Promise<void> {
  const db = await open();
  const tx = db.transaction(STORE, "readwrite");
  const range = IDBKeyRange.bound(prefix, prefix + "￿");
  tx.objectStore(STORE).delete(range);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Lista pares [chave, valor] de um prefixo (carregar chunks modificados). */
export async function dbGetPrefix<T>(prefix: string): Promise<[string, T][]> {
  const db = await open();
  const store = db.transaction(STORE).objectStore(STORE);
  const range = IDBKeyRange.bound(prefix, prefix + "￿");
  const [keys, values] = await Promise.all([
    request(store.getAllKeys(range)),
    request(store.getAll(range)),
  ]);
  return keys.map((k, i) => [String(k), values[i] as T]);
}
