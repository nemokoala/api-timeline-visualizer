import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { ApiRequest, TimelineItem } from '../../types/network';
import {
  getTimelinePrefs,
  saveTimelinePrefs,
  TIMELINE_COLUMN_LABELS,
  TIMELINE_COLUMNS,
  type TimelineColumnId,
  type TimelinePrefs,
} from '../../utils/timelinePrefs';
import type { RequestSearchSummary } from '../../utils/requestSearch';
import { formatDateTime, formatDuration, getRequestKindLabel, getStatusTone } from '../../utils/formatters';
import { getResponseImageThumbnail } from '../../utils/imageSource';
import { SearchHitBadge } from './SearchHitBadge';
import { ColumnMenu } from '../shared/ColumnMenu';

type TimelineViewProps = {
  items: TimelineItem[];
  requests: ApiRequest[];
  selectedRequestId: string | null;
  searchText: string;
  searchOccurrenceByRequest: Map<string, RequestSearchSummary>;
  activeGlobalSearchIndex: number | null;
  onSelectRequest: (requestId: string) => void;
  /** 이미지 행이 화면에 들어오면 썸네일용 응답 본문을 지연 로드한다. */
  onEnsureThumbnailBody?: (requestId: string) => void;
};

const COLUMN_WIDTHS: Record<TimelineColumnId, string> = {
  time: '88px',
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

/** URL에서 쿼리 문자열(?a=1&b=2)만 추출한다. 해시(#…)는 제외. 빈 쿼리('?')는 무시. */
function getQueryString(url: string | undefined): string {
  if (!url) return '';
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) return '';
  const hashIndex = url.indexOf('#', queryIndex);
  const query = hashIndex === -1 ? url.slice(queryIndex) : url.slice(queryIndex, hashIndex);
  return query === '?' ? '' : query;
}

export function TimelineView({
  items,
  requests,
  selectedRequestId,
  searchText,
  searchOccurrenceByRequest,
  activeGlobalSearchIndex,
  onSelectRequest,
  onEnsureThumbnailBody,
}: TimelineViewProps) {
  const [prefs, setPrefs] = useState<TimelinePrefs>(getTimelinePrefs);
  const [columnMenu, setColumnMenu] = useState<{ x: number; y: number } | null>(null);
  const requestById = useMemo(
    () => new Map(requests.map((request) => [request.id, request])),
    [requests],
  );
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const thumbObserverRef = useRef<IntersectionObserver | null>(null);
  const onEnsureThumbnailBodyRef = useRef(onEnsureThumbnailBody);
  onEnsureThumbnailBodyRef.current = onEnsureThumbnailBody;
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

  // 선택한 행을 화면에 보이게 스크롤하되, "선택이 바뀔 때"만 한 번 스크롤한다.
  // (새 요청이 계속 들어와 sortedItems가 갱신될 때마다 선택 행으로 스크롤이 튀는 것을 막는다.)
  const scrolledSelectionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedRequestId) {
      scrolledSelectionRef.current = null;
      return;
    }
    if (scrolledSelectionRef.current === selectedRequestId) return;
    const element = rowRefs.current.get(selectedRequestId);
    if (element) {
      element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      scrolledSelectionRef.current = selectedRequestId;
    }
  }, [sortedItems, selectedRequestId]);

  // 이미지 썸네일: 화면(근처)에 들어온 이미지 행의 응답 본문을 지연 로드한다.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const requestId = (entry.target as HTMLElement).dataset.requestId;
          if (requestId) onEnsureThumbnailBodyRef.current?.(requestId);
        }
      },
      { rootMargin: '150px' },
    );
    thumbObserverRef.current = observer;
    return () => observer.disconnect();
  }, []);

  // 본문이 아직 없는 이미지 행만 관찰(로드되면 다음 렌더에서 관찰 대상에서 빠진다).
  useEffect(() => {
    const observer = thumbObserverRef.current;
    if (!observer) return;
    observer.disconnect();
    for (const item of sortedItems) {
      const request = requestById.get(item.requestId);
      if (request?.type !== 'image' || request.responseContent !== undefined) continue;
      const element = rowRefs.current.get(item.requestId);
      if (element) observer.observe(element);
    }
  }, [sortedItems, requestById]);

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
              title="클릭: 정렬 · 우클릭: 열/쿼리 표시 설정"
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
        <ColumnMenu
          columns={TIMELINE_COLUMNS.map((id) => ({ id, label: TIMELINE_COLUMN_LABELS[id] }))}
          visibility={prefs.columnVisibility}
          position={columnMenu}
          options={[{ id: 'showQuery', label: 'Show query string', checked: prefs.showQuery }]}
          onToggle={toggleColumnVisibility}
          onToggleOption={(id) => {
            if (id === 'showQuery') updatePrefs({ ...prefs, showQuery: !prefs.showQuery });
          }}
          onClose={() => setColumnMenu(null)}
        />
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
            const queryString = prefs.showQuery ? getQueryString(request?.url) : '';
            const thumbnailSrc =
              request?.type === 'image'
                ? getResponseImageThumbnail(request.responseContent, request.mimeType)
                : null;

            return (
              <button
                key={item.id}
                ref={(element) => {
                  if (element) rowRefs.current.set(item.requestId, element);
                  else rowRefs.current.delete(item.requestId);
                }}
                data-request-id={item.requestId}
                className={`request-row ${isSelected ? 'selected' : ''} ${hasSearch ? 'search-match' : ''}`}
                type="button"
                style={{ gridTemplateColumns }}
                onClick={() => onSelectRequest(item.requestId)}
              >
                {prefs.columnVisibility.time ? (
                  <span className="offset">{formatDateTime(request?.startedAt ?? NaN)}</span>
                ) : null}
                {prefs.columnVisibility.request ? (
                  <span className="request-main">
                    <span className="request-meta">
                      <span className={`method method-${item.method.toLowerCase()}`}>{item.method}</span>
                      {thumbnailSrc ? (
                        <img className="row-thumb" src={thumbnailSrc} alt="" loading="lazy" />
                      ) : null}
                      <span className="path">
                        {item.normalizedPath}
                        {queryString ? <span className="path-query">{queryString}</span> : null}
                      </span>
                      {searchSummary ? (
                        <SearchHitBadge
                          summary={searchSummary}
                          activeGlobalSearchIndex={activeGlobalSearchIndex}
                        />
                      ) : null}
                    </span>
                    <span className="request-timing">
                      {request ? (
                        <span className={`kind-tag kind-${request.type}`}>
                          {getRequestKindLabel(request.type)}
                        </span>
                      ) : null}
                      <span className="bar-track" aria-hidden="true">
                        <span
                          className={`bar ${item.isError ? 'error' : item.isSlow ? 'slow' : 'ok'}`}
                          style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
                        />
                      </span>
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
