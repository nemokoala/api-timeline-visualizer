import type { PageStorageSnapshot } from '../types/storage';
import type { StorageBlobPreviewItem } from './storageBlobValue';
import { MAX_IMAGE_BLOB_BYTES } from './storageLimits';

const POLL_INTERVAL_MS = 160;
const POLL_TIMEOUT_MS = 30000;
const BLOB_PREVIEW_POLL_TIMEOUT_MS = 60000;
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

export async function fetchStorageRecordBlobPreviews(
  databaseName: string,
  storeName: string,
  recordIndex: number,
): Promise<StorageBlobPreviewItem[]> {
  if (!canInspectPageStorage()) return [];

  const requestId = `blob_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await evalInInspectedPage(
    buildFetchBlobPreviewsScript(requestId, databaseName, storeName, recordIndex, MAX_IMAGE_BLOB_BYTES),
  );

  try {
    const startedAt = Date.now();

    while (Date.now() - startedAt < BLOB_PREVIEW_POLL_TIMEOUT_MS) {
      const rawResult = await evalInInspectedPage(buildReadBlobPreviewScript(requestId));
      const result = parseBlobPreviewResult(rawResult);

      if (result?.status === 'done') return result.data;
      if (result?.status === 'error') throw new Error(result.error);

      await delay(POLL_INTERVAL_MS);
    }

    throw new Error('Timed out while loading blob previews.');
  } finally {
    void evalInInspectedPage(buildCleanupBlobPreviewScript(requestId)).catch(() => undefined);
  }
}

function parseBlobPreviewResult(value: unknown): BlobPreviewPendingResult | null {
  if (typeof value !== 'string') return null;

  try {
    const parsed = JSON.parse(value) as BlobPreviewPendingResult;
    if (!parsed || typeof parsed !== 'object' || !('status' in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

type BlobPreviewPendingResult =
  | { status: 'pending' }
  | { status: 'done'; data: StorageBlobPreviewItem[] }
  | { status: 'error'; error: string };

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

  const normalizeValue = (value) => {
    if (value instanceof Blob) {
      const mimeType = value.type || 'application/octet-stream';
      if (mimeType.startsWith('image/')) {
        return {
          __apiFlowImageBlob: true,
          mimeType,
          size: value.size,
        };
      }

      return {
        __apiFlowBlob: true,
        mimeType,
        size: value.size,
      };
    }

    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'symbol') return value.toString();
    if (typeof value === 'function') return '[Function]';

    if (Array.isArray(value)) {
      return value.map((item) => normalizeValue(item));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, normalizeValue(item)]),
      );
    }

    return String(value);
  };

  const serialize = (value) => {
    const normalized = normalizeValue(value);

    if (typeof normalized === 'string') return normalized;
    if (
      normalized &&
      typeof normalized === 'object' &&
      (normalized.__apiFlowImageBlob || normalized.__apiFlowBlob)
    ) {
      return JSON.stringify(normalized);
    }

    try {
      return JSON.stringify(normalized, null, 2);
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
    const keyPath = store.keyPath;
    const autoIncrement = store.autoIncrement;
    const count = await requestToPromise(store.count());
    const rawRecords = [];

    await new Promise((resolve, reject) => {
      const cursorRequest = store.openCursor();
      cursorRequest.onerror = () => reject(cursorRequest.error || new Error('Failed to read IndexedDB cursor.'));
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor || rawRecords.length >= maxRecords) {
          resolve();
          return;
        }

        rawRecords.push({
          key: cursor.key,
          value: cursor.value,
        });
        cursor.continue();
      };
    });

    const records = rawRecords.map((record) => ({
      key: serialize(record.key),
      value: serialize(record.value),
    }));

    return {
      name: storeName,
      keyPath: keyPath === null ? null : serialize(keyPath),
      autoIncrement,
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

function buildFetchBlobPreviewsScript(
  requestId: string,
  databaseName: string,
  storeName: string,
  recordIndex: number,
  maxImageBlobBytes: number,
): string {
  return `
(() => {
  const requestId = ${JSON.stringify(requestId)};
  const databaseName = ${JSON.stringify(databaseName)};
  const storeName = ${JSON.stringify(storeName)};
  const recordIndex = ${recordIndex};
  const maxImageBlobBytes = ${maxImageBlobBytes};
  const rootKey = '__apiFlowBlobPreviewRequests';

  window[rootKey] = window[rootKey] || {};
  window[rootKey][requestId] = { status: 'pending' };

  const readBlobAsDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Failed to read blob.'));
    reader.readAsDataURL(blob);
  });

  const openDatabase = (name) => new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB database.'));
    request.onblocked = () => reject(new Error('IndexedDB database is blocked.'));
  });

  const collectBlobPreviews = async (value, path, results) => {
    if (value instanceof Blob) {
      const mimeType = value.type || 'application/octet-stream';
      if (!mimeType.startsWith('image/')) return;

      const blobKeyPath = path || 'value';
      if (value.size > maxImageBlobBytes) {
        results.push({
          blobKeyPath,
          mimeType,
          size: value.size,
          unavailableReason: 'Preview unavailable (over ' + Math.round(maxImageBlobBytes / (1024 * 1024)) + ' MB limit)',
        });
        return;
      }

      const dataUrl = await readBlobAsDataUrl(value);
      results.push({
        blobKeyPath,
        mimeType,
        size: value.size,
        src: dataUrl,
      });
      return;
    }

    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const itemPath = path ? path + '[' + index + ']' : '[' + index + ']';
        await collectBlobPreviews(value[index], itemPath, results);
      }
      return;
    }

    if (!value || typeof value !== 'object') return;

    for (const [key, nested] of Object.entries(value)) {
      const itemPath = path ? path + '.' + key : key;
      await collectBlobPreviews(nested, itemPath, results);
    }
  };

  Promise.resolve()
    .then(async () => {
      const db = await openDatabase(databaseName);
      try {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        let currentIndex = 0;
        let recordValue = null;

        await new Promise((resolve, reject) => {
          const cursorRequest = store.openCursor();
          cursorRequest.onerror = () => reject(cursorRequest.error || new Error('Failed to read IndexedDB cursor.'));
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) {
              resolve();
              return;
            }

            if (currentIndex === recordIndex) {
              recordValue = cursor.value;
              resolve();
              return;
            }

            currentIndex += 1;
            cursor.continue();
          };
        });

        const results = [];
        if (recordValue !== null && recordValue !== undefined) {
          await collectBlobPreviews(recordValue, '', results);
        }

        window[rootKey][requestId] = { status: 'done', data: results };
      } finally {
        db.close();
      }
    })
    .catch((error) => {
      window[rootKey][requestId] = {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    });

  return true;
})()
`;
}

function buildReadBlobPreviewScript(requestId: string): string {
  return `
(() => {
  const root = window.__apiFlowBlobPreviewRequests;
  const result = root ? root[${JSON.stringify(requestId)}] : null;
  return result ? JSON.stringify(result) : null;
})()
`;
}

function buildCleanupBlobPreviewScript(requestId: string): string {
  return `
(() => {
  if (window.__apiFlowBlobPreviewRequests) {
    delete window.__apiFlowBlobPreviewRequests[${JSON.stringify(requestId)}];
  }
  return true;
})()
`;
}
