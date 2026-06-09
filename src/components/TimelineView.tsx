import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { ApiRequest, TimelineItem } from '../types/network';
import {
  getTimelinePrefs,
  saveTimelinePrefs,
  TIMELINE_COLUMN_LABELS,
  TIMELINE_COLUMNS,
  type TimelineColumnId,
  type TimelinePrefs,
} from '../utils/timelinePrefs';
import type { RequestSearchSummary } from '../utils/requestSearch';
import { formatDuration, formatOffset, getStatusTone } from './formatters';
import { SearchHitBadge } from './SearchHitBadge';

type TimelineViewProps = {
  items: TimelineItem[];
  requests: ApiRequest[];
  selectedRequestId: string | null;
  searchText: string;
  searchOccurrenceByRequest: Map<string, RequestSearchSummary>;
  activeGlobalSearchIndex: number | null;
  onSelectRequest: (requestId: string) => void;
};

const COLUMN_WIDTHS: Record<TimelineColumnId, string> = {
  time: '72px',
  request: 'minmax(220px, 1fr)',
  status: '36px',
  duration: '52px',
};

const TIMELINE_COLUMN_HEADER_LABELS: Record<TimelineColumnId, string> = {
  time: 'Time',
  request: 'Request',
  status: 'Stat',
  duration: 'Dur',
};

function compareItems(a: TimelineItem, b: TimelineItem, column: TimelineColumnId): number {
  switch (column) {
    case 'time':
      return a.startOffset - b.startOffset;
    case 'request':
      return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
    case 'status':
      return (a.status || 0) - (b.status || 0);
    case 'duration':
      return a.duration - b.duration;
    default:
      return 0;
  }
}

function buildGridTemplate(visibility: Record<TimelineColumnId, boolean>): string {
  return TIMELINE_COLUMNS.filter((column) => visibility[column])
    .map((column) => COLUMN_WIDTHS[column])
    .join(' ');
}

export function TimelineView({
  items,
  requests,
  selectedRequestId,
  searchText,
  searchOccurrenceByRequest,
  activeGlobalSearchIndex,
  onSelectRequest,
}: TimelineViewProps) {
  const [prefs, setPrefs] = useState<TimelinePrefs>(getTimelinePrefs);
  const [columnMenu, setColumnMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const requestById = useMemo(
    () => new Map(requests.map((request) => [request.id, request])),
    [requests],
  );
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const hasSearch = Boolean(searchText.trim());

  const sortedItems = useMemo(() => {
    const direction = prefs.sortDirection === 'asc' ? 1 : -1;
    return [...items].sort(
      (a, b) => compareItems(a, b, prefs.sortColumn) * direction,
    );
  }, [items, prefs.sortColumn, prefs.sortDirection]);

  const maxEnd = useMemo(
    () => Math.max(100, ...sortedItems.map((item) => item.startOffset + item.duration)),
    [sortedItems],
  );

  const gridTemplateColumns = buildGridTemplate(prefs.columnVisibility);

  const updatePrefs = (next: TimelinePrefs) => {
    setPrefs(next);
    saveTimelinePrefs(next);
  };

  const handleSortClick = (column: TimelineColumnId) => {
    const nextDirection =
      prefs.sortColumn === column && prefs.sortDirection === 'asc' ? 'desc' : 'asc';
    updatePrefs({
      ...prefs,
      sortColumn: column,
      sortDirection: nextDirection,
    });
  };

  const handleColumnContextMenu = (event: ReactMouseEvent) => {
    event.preventDefault();
    setColumnMenu({ x: event.clientX, y: event.clientY });
  };

  const toggleColumnVisibility = (column: TimelineColumnId) => {
    const visibleCount = TIMELINE_COLUMNS.filter((id) => prefs.columnVisibility[id]).length;
    if (prefs.columnVisibility[column] && visibleCount <= 1) return;

    updatePrefs({
      ...prefs,
      columnVisibility: {
        ...prefs.columnVisibility,
        [column]: !prefs.columnVisibility[column],
      },
    });
  };

  useEffect(() => {
    if (!columnMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setColumnMenu(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setColumnMenu(null);
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [columnMenu]);

  useEffect(() => {
    if (!selectedRequestId) return;
    rowRefs.current.get(selectedRequestId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [sortedItems, selectedRequestId]);

  return (
    <section className="timeline-panel" aria-label="Timeline">
      <div
        className="timeline-heading"
        style={{ gridTemplateColumns }}
        onContextMenu={handleColumnContextMenu}
      >
        {TIMELINE_COLUMNS.map((column) =>
          prefs.columnVisibility[column] ? (
            <button
              key={column}
              type="button"
              className={`timeline-column-header timeline-column-header-${column} ${prefs.sortColumn === column ? 'sorted' : ''}`}
              onClick={() => handleSortClick(column)}
              title="클릭: 정렬 · 우클릭: 열 표시 설정"
            >
              <span>{TIMELINE_COLUMN_HEADER_LABELS[column]}</span>
              {prefs.sortColumn === column ? (
                <span className="sort-indicator" aria-hidden="true">
                  {prefs.sortDirection === 'asc' ? '↑' : '↓'}
                </span>
              ) : null}
            </button>
          ) : null,
        )}
      </div>

      {columnMenu ? (
        <div
          ref={menuRef}
          className="timeline-column-menu"
          style={{ top: columnMenu.y, left: columnMenu.x }}
          role="menu"
          aria-label="열 표시 설정"
        >
          {TIMELINE_COLUMNS.map((column) => {
            const isVisible = prefs.columnVisibility[column];
            const isLastVisible =
              isVisible && TIMELINE_COLUMNS.filter((id) => prefs.columnVisibility[id]).length <= 1;

            return (
              <button
                key={column}
                type="button"
                role="menuitemcheckbox"
                aria-checked={isVisible}
                className={`timeline-column-menu-item ${isVisible ? 'checked' : ''}`}
                disabled={isLastVisible}
                onClick={() => toggleColumnVisibility(column)}
              >
                <span className="timeline-column-menu-check" aria-hidden="true">
                  {isVisible ? '✓' : ''}
                </span>
                <span>{TIMELINE_COLUMN_LABELS[column]}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {sortedItems.length === 0 ? (
        <div className="empty-state">
          <strong>{hasSearch ? 'No matching API requests.' : 'No API requests captured.'}</strong>
          <span>
            {hasSearch
              ? 'Try another keyword or clear the search field.'
              : 'Open a page with DevTools active and trigger XHR or fetch traffic.'}
          </span>
        </div>
      ) : (
        <div className="timeline-list">
          {sortedItems.map((item) => {
            const request = requestById.get(item.requestId);
            const startPercent = Math.min(94, (item.startOffset / maxEnd) * 100);
            const widthPercent = Math.max(2, (item.duration / maxEnd) * 100);
            const isSelected = selectedRequestId === item.requestId;
            const searchSummary = searchOccurrenceByRequest.get(item.requestId);

            return (
              <button
                key={item.id}
                ref={(element) => {
                  if (element) rowRefs.current.set(item.requestId, element);
                  else rowRefs.current.delete(item.requestId);
                }}
                className={`request-row ${isSelected ? 'selected' : ''} ${hasSearch ? 'search-match' : ''}`}
                type="button"
                style={{ gridTemplateColumns }}
                onClick={() => onSelectRequest(item.requestId)}
              >
                {prefs.columnVisibility.time ? (
                  <span className="offset">{formatOffset(item.startOffset)}</span>
                ) : null}
                {prefs.columnVisibility.request ? (
                  <span className="request-main">
                    <span className="request-meta">
                      <span className={`method method-${item.method.toLowerCase()}`}>{item.method}</span>
                      <span className="path">{item.normalizedPath}</span>
                      {searchSummary ? (
                        <SearchHitBadge
                          summary={searchSummary}
                          activeGlobalSearchIndex={activeGlobalSearchIndex}
                        />
                      ) : null}
                    </span>
                    <span className="bar-track" aria-hidden="true">
                      <span
                        className={`bar ${item.isError ? 'error' : item.isSlow ? 'slow' : 'ok'}`}
                        style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
                      />
                    </span>
                  </span>
                ) : null}
                {prefs.columnVisibility.status ? (
                  <span className={`status ${getStatusTone(item.status)}`}>{item.status || 'n/a'}</span>
                ) : null}
                {prefs.columnVisibility.duration ? (
                  <span className="duration">{formatDuration(request?.duration ?? item.duration)}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
