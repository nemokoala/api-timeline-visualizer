import type {
  CookieEntry,
  IndexedDbDatabaseSnapshot,
  IndexedDbRecord,
  IndexedDbStoreSnapshot,
  StorageEntry,
} from '../types/storage';
import { countSearchOccurrences, type SearchOptions } from './searchHighlight';

export type StorageSearchTarget =
  | { kind: 'local'; key: string }
  | { kind: 'session'; key: string }
  | { kind: 'cookie'; name: string; domain: string; path: string }
  | { kind: 'indexeddb'; databaseName: string; storeName: string; recordIndex: number };

export type StorageSearchOccurrence = {
  target: StorageSearchTarget;
  occurrenceIndex: number;
};

export type StorageItemSearchSummary = {
  hitCount: number;
  globalStart: number;
  globalEnd: number;
  itemOrder: number;
};

export function storageTargetKey(target: StorageSearchTarget): string {
  if (target.kind === 'indexeddb') {
    return `indexeddb:${target.databaseName}:${target.storeName}:${target.recordIndex}`;
  }

  if (target.kind === 'cookie') {
    return `cookie:${target.domain}:${target.path}:${target.name}`;
  }

  return `${target.kind}:${target.key}`;
}

export function buildStorageSearchTargets(
  localEntries: StorageEntry[],
  sessionEntries: StorageEntry[],
  cookieEntries: CookieEntry[],
  indexedDatabases: IndexedDbDatabaseSnapshot[],
): StorageSearchTarget[] {
  const targets: StorageSearchTarget[] = [];

  for (const entry of localEntries) {
    targets.push({ kind: 'local', key: entry.key });
  }

  for (const entry of sessionEntries) {
    targets.push({ kind: 'session', key: entry.key });
  }

  for (const cookie of cookieEntries) {
    targets.push({ kind: 'cookie', name: cookie.name, domain: cookie.domain, path: cookie.path });
  }

  for (const database of indexedDatabases) {
    for (const store of database.stores) {
      store.records.forEach((record, recordIndex) => {
        targets.push({
          kind: 'indexeddb',
          databaseName: database.name,
          storeName: store.name,
          recordIndex,
        });
      });
    }
  }

  return targets;
}

export function buildStorageSearchText(
  target: StorageSearchTarget,
  localEntries: StorageEntry[],
  sessionEntries: StorageEntry[],
  cookieEntries: CookieEntry[],
  indexedDatabases: IndexedDbDatabaseSnapshot[],
): string {
  if (target.kind === 'local' || target.kind === 'session') {
    const entries = target.kind === 'local' ? localEntries : sessionEntries;
    const entry = entries.find((item) => item.key === target.key);
    if (!entry) return '';
    return `${entry.key} ${entry.value}`;
  }

  if (target.kind === 'cookie') {
    const cookie = cookieEntries.find(
      (item) =>
        item.name === target.name && item.domain === target.domain && item.path === target.path,
    );
    if (!cookie) return '';
    return `${cookie.name} ${cookie.value} ${cookie.domain} ${cookie.path}`;
  }

  const database = indexedDatabases.find((item) => item.name === target.databaseName);
  const store = database?.stores.find((item) => item.name === target.storeName);
  const record = store?.records[target.recordIndex];
  if (!database || !store || !record) return '';

  return `${database.name} ${store.name} ${record.key} ${record.value}`;
}

export function buildStorageSearchOccurrences(
  targets: StorageSearchTarget[],
  localEntries: StorageEntry[],
  sessionEntries: StorageEntry[],
  cookieEntries: CookieEntry[],
  indexedDatabases: IndexedDbDatabaseSnapshot[],
  searchText: string,
  options?: SearchOptions,
): StorageSearchOccurrence[] {
  const occurrences: StorageSearchOccurrence[] = [];

  for (const target of targets) {
    const text = buildStorageSearchText(
      target,
      localEntries,
      sessionEntries,
      cookieEntries,
      indexedDatabases,
    );
    const hitCount = countSearchOccurrences(text, searchText, options);

    for (let occurrenceIndex = 0; occurrenceIndex < hitCount; occurrenceIndex += 1) {
      occurrences.push({ target, occurrenceIndex });
    }
  }

  return occurrences;
}

export function buildStorageOccurrenceSummaryByItem(
  occurrences: StorageSearchOccurrence[],
): Map<string, StorageItemSearchSummary> {
  const summaryByItem = new Map<string, StorageItemSearchSummary>();
  let globalIndex = 0;
  let itemOrder = 0;
  let lastTargetKey: string | null = null;

  for (const occurrence of occurrences) {
    globalIndex += 1;
    const targetKey = storageTargetKey(occurrence.target);

    if (targetKey !== lastTargetKey) {
      itemOrder += 1;
      lastTargetKey = targetKey;
      summaryByItem.set(targetKey, {
        hitCount: 1,
        globalStart: globalIndex,
        globalEnd: globalIndex,
        itemOrder,
      });
      continue;
    }

    const summary = summaryByItem.get(targetKey);
    if (!summary) continue;

    summary.hitCount += 1;
    summary.globalEnd = globalIndex;
  }

  return summaryByItem;
}

export function getStorageItemJumpIndices(occurrences: StorageSearchOccurrence[]): number[] {
  const indices: number[] = [];
  let lastTargetKey: string | null = null;

  occurrences.forEach((occurrence, index) => {
    const targetKey = storageTargetKey(occurrence.target);
    if (targetKey === lastTargetKey) return;
    indices.push(index);
    lastTargetKey = targetKey;
  });

  return indices;
}

export function getSearchMatchIndexForStorageTarget(
  occurrences: StorageSearchOccurrence[],
  target: StorageSearchTarget,
): number | null {
  const targetKey = storageTargetKey(target);
  const index = occurrences.findIndex((occurrence) => storageTargetKey(occurrence.target) === targetKey);
  return index >= 0 ? index : null;
}

export function getNextStorageItemJumpIndex(
  occurrences: StorageSearchOccurrence[],
  currentMatchIndex: number,
  direction: 1 | -1,
): number | null {
  const jumpIndices = getStorageItemJumpIndices(occurrences);
  if (!jumpIndices.length) return null;

  const currentTargetKey = occurrences[currentMatchIndex]
    ? storageTargetKey(occurrences[currentMatchIndex].target)
    : null;
  if (!currentTargetKey) return jumpIndices[0] ?? null;

  const currentJumpPos = jumpIndices.findIndex(
    (index) => occurrences[index] && storageTargetKey(occurrences[index].target) === currentTargetKey,
  );
  const resolvedJumpPos = currentJumpPos >= 0 ? currentJumpPos : 0;
  const nextJumpPos = (resolvedJumpPos + direction + jumpIndices.length) % jumpIndices.length;

  return jumpIndices[nextJumpPos] ?? null;
}

export function storageTargetToSelectedItem(
  target: StorageSearchTarget,
): SelectedStorageItemFromTarget {
  if (target.kind === 'indexeddb') {
    return {
      kind: 'indexeddb',
      databaseName: target.databaseName,
      storeName: target.storeName,
      recordIndex: target.recordIndex,
    };
  }

  if (target.kind === 'cookie') {
    return { kind: 'cookie', name: target.name, domain: target.domain, path: target.path };
  }

  return { kind: target.kind, key: target.key };
}

export function selectedItemToStorageTarget(
  selectedItem: SelectedStorageItemFromTarget,
): StorageSearchTarget {
  if (selectedItem.kind === 'indexeddb') {
    return {
      kind: 'indexeddb',
      databaseName: selectedItem.databaseName,
      storeName: selectedItem.storeName,
      recordIndex: selectedItem.recordIndex,
    };
  }

  if (selectedItem.kind === 'cookie') {
    return {
      kind: 'cookie',
      name: selectedItem.name,
      domain: selectedItem.domain,
      path: selectedItem.path,
    };
  }

  return { kind: selectedItem.kind, key: selectedItem.key };
}

export type SelectedStorageItemFromTarget =
  | { kind: 'local' | 'session'; key: string }
  | { kind: 'cookie'; name: string; domain: string; path: string }
  | { kind: 'indexeddb'; databaseName: string; storeName: string; recordIndex: number };

export function storageTargetTab(
  target: StorageSearchTarget,
): 'local' | 'session' | 'cookies' | 'indexeddb' {
  if (target.kind === 'indexeddb') return 'indexeddb';
  if (target.kind === 'cookie') return 'cookies';
  return target.kind;
}

export function findIndexedDbRecord(
  databases: IndexedDbDatabaseSnapshot[],
  databaseName: string,
  storeName: string,
  recordIndex: number,
): IndexedDbRecord | null {
  const database = databases.find((item) => item.name === databaseName);
  const store = database?.stores.find((item) => item.name === storeName);
  return store?.records[recordIndex] ?? null;
}

export function findIndexedDbStore(
  databases: IndexedDbDatabaseSnapshot[],
  databaseName: string,
  storeName: string,
): IndexedDbStoreSnapshot | null {
  const database = databases.find((item) => item.name === databaseName);
  return database?.stores.find((item) => item.name === storeName) ?? null;
}
