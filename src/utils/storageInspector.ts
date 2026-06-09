import type { PageStorageSnapshot } from '../types/storage';

const POLL_INTERVAL_MS = 160;
const POLL_TIMEOUT_MS = 10000;
const MAX_INDEXED_DB_RECORDS = 80;

type PendingStorageResult =
  | { status: 'pending' }
  | { status: 'done'; data: PageStorageSnapshot }
  | { status: 'error'; error: string };

export function canInspectPageStorage(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.devtools?.inspectedWindow?.eval);
}

export async function inspectPageStorage(): Promise<PageStorageSnapshot> {
  if (!canInspectPageStorage()) {
    throw new Error('Storage inspection is available only inside the Chrome DevTools panel.');
  }

  const snapshotId = `storage_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await evalInInspectedPage(buildStartCaptureScript(snapshotId, MAX_INDEXED_DB_RECORDS));

  try {
    const startedAt = Date.now();

    while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
      const rawResult = await evalInInspectedPage(buildReadCaptureScript(snapshotId));
      const result = parsePendingResult(rawResult);

      if (result?.status === 'done') return result.data;
      if (result?.status === 'error') throw new Error(result.error);

      await delay(POLL_INTERVAL_MS);
    }

    throw new Error('Timed out while reading page storage.');
  } finally {
    void evalInInspectedPage(buildCleanupScript(snapshotId)).catch(() => undefined);
  }
}

function evalInInspectedPage(expression: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.devtools.inspectedWindow.eval(expression, (result, exceptionInfo) => {
      if (exceptionInfo?.isException) {
        reject(new Error(exceptionInfo.value ?? exceptionInfo.description ?? 'Failed to inspect page storage.'));
        return;
      }

      resolve(result);
    });
  });
}

function parsePendingResult(value: unknown): PendingStorageResult | null {
  if (typeof value !== 'string') return null;

  try {
    const parsed = JSON.parse(value) as PendingStorageResult;
    if (!parsed || typeof parsed !== 'object' || !('status' in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function buildStartCaptureScript(snapshotId: string, maxRecords: number): string {
  return `
(() => {
  const snapshotId = ${JSON.stringify(snapshotId)};
  const maxRecords = ${maxRecords};
  const rootKey = '__apiFlowStorageSnapshots';

  window[rootKey] = window[rootKey] || {};
  window[rootKey][snapshotId] = { status: 'pending' };

  const sizeOf = (value) => {
    try {
      return new Blob([String(value)]).size;
    } catch {
      return String(value).length;
    }
  };

  const serialize = (value) => {
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) return String(value);
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'symbol') return value.toString();
    if (typeof value === 'function') return '[Function]';

    try {
      return JSON.stringify(value, (_key, item) => {
        if (typeof item === 'bigint') return item.toString();
        if (typeof item === 'function') return '[Function]';
        if (typeof item === 'symbol') return item.toString();
        return item;
      }, 2);
    } catch {
      return Object.prototype.toString.call(value);
    }
  };

  const readWebStorage = (storage) => {
    const rows = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key === null) continue;
      const value = storage.getItem(key) ?? '';
      rows.push({ key, value, size: sizeOf(key) + sizeOf(value) });
    }
    return rows.sort((a, b) => a.key.localeCompare(b.key));
  };

  const requestToPromise = (request) => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
  });

  const openDatabase = (name) => new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB database.'));
    request.onblocked = () => reject(new Error('IndexedDB database is blocked.'));
  });

  const getDatabaseInfos = async () => {
    if (typeof indexedDB.databases === 'function') {
      const databases = await indexedDB.databases();
      return databases.filter((db) => db && db.name).map((db) => ({
        name: db.name,
        version: db.version,
      }));
    }

    return [];
  };

  const readStore = async (db, storeName) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const count = await requestToPromise(store.count());
    const records = [];

    await new Promise((resolve, reject) => {
      const cursorRequest = store.openCursor();
      cursorRequest.onerror = () => reject(cursorRequest.error || new Error('Failed to read IndexedDB cursor.'));
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor || records.length >= maxRecords) {
          resolve();
          return;
        }

        records.push({
          key: serialize(cursor.key),
          value: serialize(cursor.value),
        });
        cursor.continue();
      };
    });

    return {
      name: storeName,
      keyPath: store.keyPath === null ? null : serialize(store.keyPath),
      autoIncrement: store.autoIncrement,
      count,
      records,
      truncated: count > records.length,
    };
  };

  const readIndexedDB = async () => {
    if (!('indexedDB' in window)) return [];

    const infos = await getDatabaseInfos();
    const snapshots = [];

    for (const info of infos) {
      let db = null;
      try {
        db = await openDatabase(info.name);
        const stores = [];
        for (const storeName of Array.from(db.objectStoreNames).sort()) {
          try {
            stores.push(await readStore(db, storeName));
          } catch (error) {
            stores.push({
              name: storeName,
              keyPath: null,
              autoIncrement: false,
              records: [],
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        snapshots.push({
          name: info.name,
          version: db.version || info.version,
          stores,
        });
      } catch (error) {
        snapshots.push({
          name: info.name,
          version: info.version,
          stores: [],
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (db) db.close();
      }
    }

    return snapshots;
  };

  Promise.resolve()
    .then(async () => {
      const errors = [];
      let localStorageRows = [];
      let sessionStorageRows = [];
      let indexedDBRows = [];

      try {
        localStorageRows = readWebStorage(window.localStorage);
      } catch (error) {
        errors.push('localStorage: ' + (error instanceof Error ? error.message : String(error)));
      }

      try {
        sessionStorageRows = readWebStorage(window.sessionStorage);
      } catch (error) {
        errors.push('sessionStorage: ' + (error instanceof Error ? error.message : String(error)));
      }

      try {
        indexedDBRows = await readIndexedDB();
      } catch (error) {
        errors.push('IndexedDB: ' + (error instanceof Error ? error.message : String(error)));
      }

      window[rootKey][snapshotId] = {
        status: 'done',
        data: {
          origin: location.origin,
          href: location.href,
          capturedAt: new Date().toISOString(),
          localStorage: localStorageRows,
          sessionStorage: sessionStorageRows,
          indexedDB: indexedDBRows,
          errors,
        },
      };
    })
    .catch((error) => {
      window[rootKey][snapshotId] = {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    });

  return true;
})()
`;
}

function buildReadCaptureScript(snapshotId: string): string {
  return `
(() => {
  const root = window.__apiFlowStorageSnapshots;
  const result = root ? root[${JSON.stringify(snapshotId)}] : null;
  return result ? JSON.stringify(result) : null;
})()
`;
}

function buildCleanupScript(snapshotId: string): string {
  return `
(() => {
  if (window.__apiFlowStorageSnapshots) {
    delete window.__apiFlowStorageSnapshots[${JSON.stringify(snapshotId)}];
  }
  return true;
})()
`;
}
