import { readJson, writeJson } from './localStoragePrefs';

/** 목록(Network·Console·Storage 등 DataTable)의 표시 옵션. 모든 테이블이 공유한다. */
export type TableViewPrefs = {
  /** 행에 한 칸 걸러 옅은 배경을 깔아 긴 목록을 가로로 따라가기 쉽게 한다. */
  rowStripe: boolean;
};

const STORAGE_KEY = 'api-flow-table-view-prefs';

const DEFAULT_PREFS: TableViewPrefs = { rowStripe: true };

function normalize(raw: unknown): TableViewPrefs {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    rowStripe: typeof source.rowStripe === 'boolean' ? source.rowStripe : DEFAULT_PREFS.rowStripe,
  };
}

// 모든 테이블이 참조하는 단일 진실. 저장 시에만 참조가 바뀌어 useSyncExternalStore 스냅샷이 안정적이다.
let current: TableViewPrefs = normalize(readJson<Partial<TableViewPrefs>>(STORAGE_KEY));
const listeners = new Set<() => void>();

export function getTableViewPrefs(): TableViewPrefs {
  return current;
}

export function saveTableViewPrefs(next: TableViewPrefs): void {
  current = normalize(next);
  writeJson(STORAGE_KEY, current);
  listeners.forEach((listener) => listener());
}

export function subscribeTableViewPrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
