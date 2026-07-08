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

export type CookieSameSite = 'strict' | 'lax' | 'none' | 'unspecified';

export type CookieEntry = {
  name: string;
  value: string;
  domain: string;
  path: string;
  /** 만료 시각(epoch seconds). 세션 쿠키면 null. */
  expires: number | null;
  /** name + value의 UTF-8 바이트 크기. */
  size: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: CookieSameSite;
  /** 도메인 쿠키가 아니라 정확히 이 호스트에만 적용되는 쿠키인지. */
  hostOnly: boolean;
};

export type CookieSnapshot = {
  /** 스냅샷을 조회한 대상 페이지 URL. */
  url: string;
  capturedAt: string;
  cookies: CookieEntry[];
  errors: string[];
};
