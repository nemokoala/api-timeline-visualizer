/**
 * 공용 DataTable 설정 저장 헬퍼.
 *
 * 세 패널(Network/Storage/Console)이 각자 키를 갖되 동일한 형태
 * (컬럼 표시 여부 + 컬럼 폭 + 선택적 정렬)를 localStorage에 저장/복원한다.
 */
import { readJson, writeJson } from './localStoragePrefs';

export type TableSortState = { id: string; desc: boolean }[];

export type TablePrefs = {
  /** 컬럼 id → 표시 여부. */
  columnVisibility: Record<string, boolean>;
  /** 컬럼 id → 폭(px). 리사이즈로 변경된 값만 저장된다. */
  columnWidths: Record<string, number>;
  /** 정렬 상태(정렬을 쓰는 뷰만). */
  sorting?: TableSortState;
};

export function getTablePrefs(key: string, defaults: TablePrefs): TablePrefs {
  const stored = readJson<Partial<TablePrefs>>(key);
  if (!stored) {
    return {
      columnVisibility: { ...defaults.columnVisibility },
      columnWidths: { ...defaults.columnWidths },
      sorting: defaults.sorting ? [...defaults.sorting] : undefined,
    };
  }
  return {
    columnVisibility: { ...defaults.columnVisibility, ...(stored.columnVisibility ?? {}) },
    columnWidths: { ...defaults.columnWidths, ...(stored.columnWidths ?? {}) },
    sorting: stored.sorting ?? defaults.sorting,
  };
}

export function saveTablePrefs(key: string, prefs: TablePrefs): void {
  writeJson(key, prefs);
}
