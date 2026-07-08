/**
 * 타임라인 테이블 설정: 정렬 기준 열/방향 및 열별 표시 여부를 저장합니다.
 * 읽은 값은 알려진 열 목록으로 검증하며, 모든 열이 숨겨지지 않도록 정규화합니다.
 */
import { readJson, writeJson } from './localStoragePrefs';

export type TimelineColumnId = 'time' | 'request' | 'status' | 'duration' | 'size';
export type SortDirection = 'asc' | 'desc';

export type TimelinePrefs = {
  sortColumn: TimelineColumnId;
  sortDirection: SortDirection;
  columnVisibility: Record<TimelineColumnId, boolean>;
  /** 컬럼 id → 폭(px). 리사이즈로 변경된 값만 저장. request(flex)는 없음. */
  columnWidths: Record<string, number>;
  /** Request 열에 쿼리 문자열(?a=1&b=2)까지 표시할지 여부. */
  showQuery: boolean;
};

const STORAGE_KEY = 'api-flow-timeline-prefs';

export const TIMELINE_COLUMNS: TimelineColumnId[] = ['time', 'request', 'status', 'duration', 'size'];

export const TIMELINE_COLUMN_LABELS: Record<TimelineColumnId, string> = {
  time: 'Time',
  request: 'Request',
  status: 'Status',
  duration: 'Duration',
  size: 'Size',
};

const DEFAULT_PREFS: TimelinePrefs = {
  sortColumn: 'time',
  sortDirection: 'asc',
  columnVisibility: {
    time: true,
    request: true,
    status: true,
    duration: true,
    size: true,
  },
  columnWidths: { time: 92, status: 52, duration: 60, size: 72 },
  showQuery: true,
};

function readPrefs(): Partial<TimelinePrefs> {
  return readJson<Partial<TimelinePrefs>>(STORAGE_KEY) ?? {};
}

function writePrefs(prefs: TimelinePrefs): void {
  writeJson(STORAGE_KEY, prefs);
}

// 저장된 표시 설정을 기본값에 병합하고, 모두 숨김이면 기본값으로 초기화.
function normalizeVisibility(
  visibility: Partial<Record<TimelineColumnId, boolean>> | undefined,
): Record<TimelineColumnId, boolean> {
  const merged = { ...DEFAULT_PREFS.columnVisibility, ...visibility };
  const visibleCount = TIMELINE_COLUMNS.filter((column) => merged[column]).length;
  if (visibleCount === 0) return { ...DEFAULT_PREFS.columnVisibility };
  return merged;
}

export function getTimelinePrefs(): TimelinePrefs {
  const stored = readPrefs();
  const sortColumn = TIMELINE_COLUMNS.includes(stored.sortColumn as TimelineColumnId)
    ? (stored.sortColumn as TimelineColumnId)
    : DEFAULT_PREFS.sortColumn;
  const sortDirection = stored.sortDirection === 'desc' ? 'desc' : 'asc';

  return {
    sortColumn,
    sortDirection,
    columnVisibility: normalizeVisibility(stored.columnVisibility),
    columnWidths: { ...DEFAULT_PREFS.columnWidths, ...(stored.columnWidths ?? {}) },
    showQuery: stored.showQuery !== false,
  };
}

export function saveTimelinePrefs(prefs: TimelinePrefs): void {
  writePrefs({
    ...prefs,
    columnVisibility: normalizeVisibility(prefs.columnVisibility),
    showQuery: prefs.showQuery === true,
  });
}
