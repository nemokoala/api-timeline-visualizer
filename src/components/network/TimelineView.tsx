import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { ColumnDef, ColumnSizingState, OnChangeFn, SortingState } from '@tanstack/react-table';
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
import { formatBytes, formatDateTime, formatDuration, getRequestKindLabel, getStatusTone } from '../../utils/formatters';
import { getResponseImageThumbnail } from '../../utils/imageSource';
import { SearchHitBadge } from './SearchHitBadge';
import { ColumnMenu } from '../shared/ColumnMenu';
import { DataTable } from '../shared/DataTable';

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

const TIMELINE_COLUMN_HEADER_LABELS: Record<TimelineColumnId, string> = {
  time: 'Time',
  request: 'Request',
  status: 'Stat',
  duration: 'Dur',
  size: 'Size',
};

/** URL에서 쿼리 문자열(?a=1&b=2)만 추출한다. 해시(#…)는 제외. 빈 쿼리('?')는 무시. */
function getQueryString(url: string | undefined): string {
  if (!url) return '';
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) return '';
  const hashIndex = url.indexOf('#', queryIndex);
  const query = hashIndex === -1 ? url.slice(queryIndex) : url.slice(queryIndex, hashIndex);
  return query === '?' ? '' : query;
}

/** 셀 렌더러가 참조하는, 매 렌더 갱신되는 동적 컨텍스트(컬럼 def를 안정적으로 유지하기 위함). */
type RenderContext = {
  maxEnd: number;
  requestById: Map<string, ApiRequest>;
  showQuery: boolean;
  searchOccurrenceByRequest: Map<string, RequestSearchSummary>;
  activeGlobalSearchIndex: number | null;
};

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
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const thumbObserverRef = useRef<IntersectionObserver | null>(null);
  const onEnsureThumbnailBodyRef = useRef(onEnsureThumbnailBody);
  onEnsureThumbnailBodyRef.current = onEnsureThumbnailBody;
  const hasSearch = Boolean(searchText.trim());

  const maxEnd = useMemo(
    () => Math.max(100, ...items.map((item) => item.startOffset + item.duration)),
    [items],
  );

  // 셀 렌더러가 참조할 동적 값. 컬럼 def는 안정적으로 두고 여기로 최신값을 전달한다.
  const ctxRef = useRef<RenderContext>({
    maxEnd,
    requestById,
    showQuery: prefs.showQuery,
    searchOccurrenceByRequest,
    activeGlobalSearchIndex,
  });
  ctxRef.current = {
    maxEnd,
    requestById,
    showQuery: prefs.showQuery,
    searchOccurrenceByRequest,
    activeGlobalSearchIndex,
  };

  const updatePrefs = (next: TimelinePrefs) => {
    setPrefs(next);
    saveTimelinePrefs(next);
  };

  const handleColumnSizingChange: OnChangeFn<ColumnSizingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(prefs.columnWidths) : updater;
    updatePrefs({ ...prefs, columnWidths: next });
  };

  const sorting: SortingState = [
    { id: prefs.sortColumn, desc: prefs.sortDirection === 'desc' },
  ];

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    const first = next[0];
    if (!first) return;
    updatePrefs({
      ...prefs,
      sortColumn: first.id as TimelineColumnId,
      sortDirection: first.desc ? 'desc' : 'asc',
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

  const columns = useMemo<ColumnDef<TimelineItem, unknown>[]>(
    () => [
      {
        id: 'time',
        header: TIMELINE_COLUMN_HEADER_LABELS.time,
        accessorFn: (item) => item.startOffset,
        size: 92,
        minSize: 64,
        cell: ({ row }) => {
          const request = ctxRef.current.requestById.get(row.original.requestId);
          return <span className="offset">{formatDateTime(request?.startedAt ?? NaN)}</span>;
        },
      },
      {
        id: 'request',
        header: TIMELINE_COLUMN_HEADER_LABELS.request,
        accessorFn: (item) => item.label,
        enableResizing: false,
        meta: { flex: true, minWidth: 220 },
        cell: ({ row }) => <RequestCell item={row.original} ctx={ctxRef.current} />,
      },
      {
        id: 'status',
        header: TIMELINE_COLUMN_HEADER_LABELS.status,
        accessorFn: (item) => item.status,
        size: 52,
        minSize: 40,
        cell: ({ row }) => (
          <span className={`status ${getStatusTone(row.original.status)}`}>
            {row.original.status || 'n/a'}
          </span>
        ),
      },
      {
        id: 'duration',
        header: TIMELINE_COLUMN_HEADER_LABELS.duration,
        accessorFn: (item) => item.duration,
        size: 60,
        minSize: 48,
        cell: ({ row }) => {
          const request = ctxRef.current.requestById.get(row.original.requestId);
          return <span className="duration">{formatDuration(request?.duration ?? row.original.duration)}</span>;
        },
      },
      {
        id: 'size',
        header: TIMELINE_COLUMN_HEADER_LABELS.size,
        accessorFn: (item) => item.size ?? -1,
        size: 72,
        minSize: 52,
        cell: ({ row }) => {
          const request = ctxRef.current.requestById.get(row.original.requestId);
          return <span className="size">{formatBytes(request?.size ?? row.original.size)}</span>;
        },
      },
    ],
    [],
  );

  // 선택한 행을 화면에 보이게 스크롤하되, "선택이 바뀔 때"만 한 번 스크롤한다.
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
  }, [items, selectedRequestId]);

  // 이미지 썸네일: 화면(근처)에 들어온 이미지 행의 응답 본문을 지연 로드한다.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const requestId = (entry.target as HTMLElement).dataset.rowId;
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
    for (const item of items) {
      const request = requestById.get(item.requestId);
      if (request?.type !== 'image' || request.responseContent !== undefined) continue;
      const element = rowRefs.current.get(item.requestId);
      if (element) observer.observe(element);
    }
  }, [items, requestById]);

  return (
    <section className="timeline-panel" aria-label="Timeline">
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

      <DataTable
        className="timeline-table"
        ariaLabel="API requests"
        columns={columns}
        data={items}
        getRowId={(item) => item.requestId}
        columnSizing={prefs.columnWidths}
        onColumnSizingChange={handleColumnSizingChange}
        columnVisibility={prefs.columnVisibility}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        enableSorting
        selectedRowId={selectedRequestId}
        onRowClick={(item) => onSelectRequest(item.requestId)}
        rowClassName={() => (hasSearch ? 'search-match' : '')}
        registerRowRef={(id, element) => {
          if (element) rowRefs.current.set(id, element);
          else rowRefs.current.delete(id);
        }}
        onHeaderContextMenu={handleColumnContextMenu}
        emptyState={
          <div className="empty-state">
            <strong>{hasSearch ? 'No matching API requests.' : 'No API requests captured.'}</strong>
            <span>
              {hasSearch
                ? 'Try another keyword or clear the search field.'
                : 'Open a page with DevTools active and trigger XHR or fetch traffic.'}
            </span>
          </div>
        }
      />
    </section>
  );
}

function RequestCell({ item, ctx }: { item: TimelineItem; ctx: RenderContext }) {
  const request = ctx.requestById.get(item.requestId);
  const startPercent = Math.min(94, (item.startOffset / ctx.maxEnd) * 100);
  const widthPercent = Math.max(2, (item.duration / ctx.maxEnd) * 100);
  const searchSummary = ctx.searchOccurrenceByRequest.get(item.requestId);
  const queryString = ctx.showQuery ? getQueryString(request?.url) : '';
  // 썸네일은 base64 본문이 바뀔 때만 다시 계산한다. 매 렌더마다 전체 base64에
  // 정규식을 돌리면 리스트가 커질수록 심하게 버벅인다.
  const thumbnailSrc = useMemo(
    () =>
      request?.type === 'image'
        ? getResponseImageThumbnail(request.responseContent, request.mimeType)
        : null,
    [request?.type, request?.responseContent, request?.mimeType],
  );

  return (
    <span className="request-main">
      <span className="request-meta">
        <span className={`method method-${item.method.toLowerCase()}`}>{item.method}</span>
        {thumbnailSrc ? (
          <img className="row-thumb" src={thumbnailSrc} alt="" loading="lazy" decoding="async" />
        ) : null}
        <span className="path">
          {item.normalizedPath}
          {queryString ? <span className="path-query">{queryString}</span> : null}
        </span>
        {searchSummary ? (
          <SearchHitBadge summary={searchSummary} activeGlobalSearchIndex={ctx.activeGlobalSearchIndex} />
        ) : null}
      </span>
      <span className="request-timing">
        {request ? (
          <span className={`kind-tag kind-${request.type}`}>{getRequestKindLabel(request.type)}</span>
        ) : null}
        <span className="bar-track" aria-hidden="true">
          <span
            className={`bar ${item.isError ? 'error' : item.isSlow ? 'slow' : 'ok'}`}
            style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
          />
        </span>
      </span>
    </span>
  );
}
