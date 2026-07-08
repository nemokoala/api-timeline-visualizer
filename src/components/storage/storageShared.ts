/**
 * Storage 뷰어 패널들이 공유하는 타입·컬럼 정의·테이블 prefs 상수.
 */
import type { TablePrefs } from "../../utils/tablePrefs";

export type StorageTab = "local" | "session" | "cookies" | "indexeddb";

export type SelectedStorageItem =
  | { kind: "local" | "session"; key: string }
  | { kind: "cookie"; name: string; domain: string; path: string }
  | {
      kind: "indexeddb";
      databaseName: string;
      storeName: string;
      recordIndex: number;
    };

export type WebStorageColumnId = "key" | "value" | "size";
export type IndexedDbColumnId = "key" | "value";
export type CookieColumnId =
  | "name"
  | "value"
  | "domain"
  | "path"
  | "expires"
  | "size"
  | "sameSite"
  | "httpOnly"
  | "secure";
export type WebStorageColumnVisibility = Record<WebStorageColumnId, boolean>;
export type IndexedDbColumnVisibility = Record<IndexedDbColumnId, boolean>;
export type CookieColumnVisibility = Record<CookieColumnId, boolean>;

export const WEB_STORAGE_COLUMNS: Array<{ id: WebStorageColumnId; label: string }> = [
  { id: "key", label: "Key" },
  { id: "value", label: "Value" },
  { id: "size", label: "Size" },
];

export const COOKIE_COLUMNS: Array<{ id: CookieColumnId; label: string }> = [
  { id: "name", label: "Name" },
  { id: "value", label: "Value" },
  { id: "domain", label: "Domain" },
  { id: "path", label: "Path" },
  { id: "expires", label: "Expires" },
  { id: "size", label: "Size" },
  { id: "sameSite", label: "SameSite" },
  { id: "httpOnly", label: "HttpOnly" },
  { id: "secure", label: "Secure" },
];

export const INDEXED_DB_RECORD_COLUMNS: Array<{
  id: IndexedDbColumnId;
  label: string;
}> = [
  { id: "key", label: "Key" },
  { id: "value", label: "Value" },
];

export const WEB_PREFS_KEY = "storage-web-table-prefs";
export const IDB_PREFS_KEY = "storage-idb-table-prefs";
export const COOKIE_PREFS_KEY = "storage-cookie-table-prefs";

export const WEB_DEFAULT_PREFS: TablePrefs = {
  columnVisibility: { key: true, value: true, size: true },
  columnWidths: { key: 200, size: 80, actions: 44 },
};
export const IDB_DEFAULT_PREFS: TablePrefs = {
  columnVisibility: { key: true, value: true },
  columnWidths: { key: 200, actions: 44 },
};
export const COOKIE_DEFAULT_PREFS: TablePrefs = {
  columnVisibility: {
    name: true,
    value: true,
    domain: true,
    path: true,
    expires: true,
    size: true,
    sameSite: false,
    httpOnly: false,
    secure: false,
  },
  columnWidths: {
    name: 160,
    domain: 160,
    path: 100,
    expires: 160,
    size: 64,
    sameSite: 90,
    httpOnly: 80,
    secure: 70,
    actions: 44,
  },
};
