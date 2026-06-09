export type StorageEntry = {
  key: string;
  value: string;
  size: number;
};

export type IndexedDbRecord = {
  key: string;
  value: string;
};

export type IndexedDbStoreSnapshot = {
  name: string;
  keyPath: string | null;
  autoIncrement: boolean;
  count?: number;
  records: IndexedDbRecord[];
  truncated?: boolean;
  error?: string;
};

export type IndexedDbDatabaseSnapshot = {
  name: string;
  version?: number;
  stores: IndexedDbStoreSnapshot[];
  error?: string;
};

export type PageStorageSnapshot = {
  origin: string;
  href: string;
  capturedAt: string;
  localStorage: StorageEntry[];
  sessionStorage: StorageEntry[];
  indexedDB: IndexedDbDatabaseSnapshot[];
  errors: string[];
};
