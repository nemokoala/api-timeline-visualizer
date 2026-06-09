export type TimelineColumnId = 'time' | 'request' | 'status' | 'duration';
export type SortDirection = 'asc' | 'desc';

export type TimelinePrefs = {
  sortColumn: TimelineColumnId;
  sortDirection: SortDirection;
  columnVisibility: Record<TimelineColumnId, boolean>;
};

const STORAGE_KEY = 'api-flow-timeline-prefs';

export const TIMELINE_COLUMNS: TimelineColumnId[] = ['time', 'request', 'status', 'duration'];

export const TIMELINE_COLUMN_LABELS: Record<TimelineColumnId, string> = {
  time: 'Time',
  request: 'Request',
  status: 'Status',
  duration: 'Duration',
};

const DEFAULT_PREFS: TimelinePrefs = {
  sortColumn: 'time',
  sortDirection: 'asc',
  columnVisibility: {
    time: true,
    request: true,
    status: true,
    duration: true,
  },
};

function readPrefs(): Partial<TimelinePrefs> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Partial<TimelinePrefs>;
  } catch {
    return {};
  }
}

function writePrefs(prefs: TimelinePrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage failures in extension context.
  }
}

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
  };
}

export function saveTimelinePrefs(prefs: TimelinePrefs): void {
  writePrefs({
    ...prefs,
    columnVisibility: normalizeVisibility(prefs.columnVisibility),
  });
}
