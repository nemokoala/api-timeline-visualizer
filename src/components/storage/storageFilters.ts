/**
 * Storage 뷰어의 행 필터링. Include/Exclude 필터와 검색을 함께 적용한다.
 * (Storage는 스냅샷 모델이라 검색도 비매칭 행을 숨긴다 — README의 검색 설계 참고.)
 */
import type {
  CookieEntry,
  IndexedDbDatabaseSnapshot,
  IndexedDbRecord,
  IndexedDbStoreSnapshot,
  StorageEntry,
} from "../../types/storage";
import { matchesIncludeExcludeFilters } from "../../utils/textFilters";
import { textMatchesSearch, type SearchOptions } from "../../utils/searchHighlight";

export function filterEntries(
  entries: StorageEntry[],
  searchText: string,
  includeText: string,
  excludeText: string,
  searchOptions: SearchOptions,
): StorageEntry[] {
  return entries.filter((entry) => {
    const haystack = `${entry.key} ${entry.value}`;
    if (
      !matchesStorageFilters(
        haystack,
        includeText,
        excludeText,
        searchText,
        searchOptions,
      )
    )
      return false;
    return true;
  });
}

export function filterCookies(
  cookies: CookieEntry[],
  searchText: string,
  includeText: string,
  excludeText: string,
  searchOptions: SearchOptions,
): CookieEntry[] {
  return cookies.filter((cookie) => {
    const haystack = `${cookie.name} ${cookie.value} ${cookie.domain} ${cookie.path}`;
    return matchesStorageFilters(
      haystack,
      includeText,
      excludeText,
      searchText,
      searchOptions,
    );
  });
}

export function filterIndexedDB(
  databases: IndexedDbDatabaseSnapshot[],
  searchText: string,
  includeText: string,
  excludeText: string,
  searchOptions: SearchOptions,
): IndexedDbDatabaseSnapshot[] {
  return databases
    .filter((database) =>
      matchesIncludeExcludeFilters(database.name, includeText, excludeText),
    )
    .map((database) => {
      const stores = database.stores
        .filter((store) =>
          matchesIncludeExcludeFilters(
            `${database.name} ${store.name}`,
            includeText,
            excludeText,
          ),
        )
        .map((store) => ({
          ...store,
          records: filterIndexedDbRecords(
            database,
            store,
            searchText,
            includeText,
            excludeText,
            searchOptions,
          ),
        }))
        .filter((store) => {
          if (store.records.length > 0) return true;
          if (!searchText.trim() && !includeText.trim()) return true;
          return textMatchesSearch(
            `${database.name} ${store.name}`,
            searchText,
            searchOptions,
          );
        });

      return { ...database, stores };
    })
    .filter((database) => {
      if (database.stores.length > 0) return true;
      if (!searchText.trim() && !includeText.trim()) return true;
      return textMatchesSearch(database.name, searchText, searchOptions);
    });
}

function filterIndexedDbRecords(
  database: IndexedDbDatabaseSnapshot,
  store: IndexedDbStoreSnapshot,
  searchText: string,
  includeText: string,
  excludeText: string,
  searchOptions: SearchOptions,
): IndexedDbRecord[] {
  return store.records.filter((record) => {
    const haystack = `${database.name} ${store.name} ${record.key} ${record.value}`;
    return matchesStorageFilters(
      haystack,
      includeText,
      excludeText,
      searchText,
      searchOptions,
    );
  });
}

function matchesStorageFilters(
  haystack: string,
  includeText: string,
  excludeText: string,
  searchText: string,
  searchOptions: SearchOptions,
): boolean {
  if (!matchesIncludeExcludeFilters(haystack, includeText, excludeText))
    return false;
  if (!searchText.trim()) return true;
  return textMatchesSearch(haystack, searchText, searchOptions);
}
