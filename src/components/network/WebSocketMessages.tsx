import { useMemo, useState } from 'react';
import type { ColumnDef, ColumnSizingState, OnChangeFn } from '@tanstack/react-table';
import type { ApiRequest, WebSocketFrame } from '../../types/network';
import { DataTable } from '../shared/DataTable';
import { JsonViewer } from '../shared/JsonViewer';
import { SegmentedControl } from '../ui/SegmentedControl';
import { getTablePrefs, saveTablePrefs, type TablePrefs } from '../../utils/tablePrefs';
import { useExpandedRows } from '../../hooks/useExpandedRows';
import { useSearchOptions } from '../../contexts/SearchOptionsContext';
import { highlightSearchText } from '../../utils/searchHighlight';
import { formatBytes, formatDateTime } from '../../utils/formatters';
import { countFrames } from '../../utils/websocketRequests';
import { useT } from '../../i18n';

const WS_PREFS_KEY = 'websocket-messages-table-prefs';

const WS_DEFAULT_PREFS: TablePrefs = {
  columnVisibility: { direction: true, timestamp: true, size: true, data: true },
  columnWidths: { direction: 34, timestamp: 92, size: 66 },
};

type DirectionFilter = 'all' | 'sent' | 'received';

/** 방향별 화살표. 상태 프레임(open/close/error)은 점으로 구분한다. */
const DIRECTION_MARK: Record<WebSocketFrame['direction'], string> = {
  sent: '↑',
  received: '↓',
  status: '•',
};

const DIRECTION_COLOR: Record<WebSocketFrame['direction'], string> = {
  sent: 'text-accent',
  received: 'text-ok',
  status: 'text-ink-weak',
};

type WebSocketMessagesProps = {
  request: ApiRequest;
  searchText: string;
  searchFocusKey: string;
};

/**
 * WebSocket 연결의 송수신 프레임 목록. 행을 누르면 그 자리에서 본문이 펼쳐진다
 * (JSON이면 트리, 아니면 평문). 프레임은 수천 개까지 쌓일 수 있어 가상화한다.
 */
export function WebSocketMessages({ request, searchText, searchFocusKey }: WebSocketMessagesProps) {
  const t = useT();
  const searchOptions = useSearchOptions();
  const { isExpanded, toggle } = useExpandedRows();
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [tablePrefs, setTablePrefs] = useState<TablePrefs>(() =>
    getTablePrefs(WS_PREFS_KEY, WS_DEFAULT_PREFS),
  );

  const frames = request.frames ?? [];
  const counts = useMemo(() => countFrames(frames), [frames]);

  const visibleFrames = useMemo(() => {
    if (directionFilter === 'all') return frames;
    // 상태 줄(연결 열림/닫힘)은 흐름을 읽는 기준점이라 방향 필터에서도 남긴다.
    return frames.filter(
      (frame) => frame.direction === directionFilter || frame.direction === 'status',
    );
  }, [directionFilter, frames]);

  const handleColumnSizingChange: OnChangeFn<ColumnSizingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(tablePrefs.columnWidths) : updater;
    const prefs = { ...tablePrefs, columnWidths: next };
    setTablePrefs(prefs);
    saveTablePrefs(WS_PREFS_KEY, prefs);
  };

  const hasSearch = Boolean(searchText.trim());

  const columns = useMemo<ColumnDef<WebSocketFrame, unknown>[]>(
    () => [
      {
        id: 'direction',
        header: '',
        size: 34,
        minSize: 28,
        cell: ({ row }) => {
          const frame = row.original;
          return (
            <span
              className={`text-[13px] font-bold ${DIRECTION_COLOR[frame.direction]}`}
              title={t(
                frame.direction === 'sent'
                  ? 'websocket.sent'
                  : frame.direction === 'received'
                    ? 'websocket.received'
                    : 'websocket.status',
              )}
            >
              {DIRECTION_MARK[frame.direction]}
            </span>
          );
        },
      },
      {
        id: 'timestamp',
        header: 'Time',
        size: 92,
        minSize: 72,
        cell: ({ row }) => (
          <span className="text-[11px] text-ink-weak tabular-nums">
            {formatDateTime(row.original.timestamp)}
          </span>
        ),
      },
      {
        id: 'size',
        header: 'Length',
        size: 66,
        minSize: 52,
        cell: ({ row }) => (
          <span className="text-[11px] text-ink-weak tabular-nums">
            {row.original.direction === 'status' ? '—' : formatBytes(row.original.size)}
          </span>
        ),
      },
      {
        id: 'data',
        header: 'Data',
        enableResizing: false,
        meta: { flex: true, minWidth: 120 },
        cell: ({ row }) => {
          const frame = row.original;
          const text = frame.text.replace(/\s+/g, ' ').trim();
          return (
            <span
              className={`block overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] ${
                frame.direction === 'status'
                  ? 'text-ink-weak italic'
                  : 'text-ink [font-family:SFMono-Regular,Consolas,monospace]'
              }`}
            >
              {hasSearch ? highlightSearchText(text, searchText, searchOptions) : text}
            </span>
          );
        },
      },
    ],
    [hasSearch, searchOptions, searchText, t],
  );

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <SegmentedControl
          size="sm"
          ariaLabel={t('websocket.directionFilter')}
          value={directionFilter}
          onChange={setDirectionFilter}
          options={[
            { value: 'all', label: t('websocket.all') },
            { value: 'sent', label: `${DIRECTION_MARK.sent} ${counts.sent}` },
            { value: 'received', label: `${DIRECTION_MARK.received} ${counts.received}` },
          ]}
        />
        <span
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
            request.isOpen ? 'bg-accent-soft text-accent' : 'bg-fill text-ink-weak'
          }`}
        >
          {request.isOpen ? t('websocket.open') : t('websocket.closed')}
        </span>
      </div>

      {request.droppedFrameCount ? (
        <p className="m-0 text-[11px] text-ink-weak">
          {t('websocket.dropped', { count: request.droppedFrameCount })}
        </p>
      ) : null}

      <div className="h-[260px] overflow-hidden rounded-xl border border-line-weak bg-surface-sub">
        <DataTable
          columns={columns}
          data={visibleFrames}
          getRowId={(frame) => frame.id}
          ariaLabel={t('websocket.messageList')}
          virtualized
          estimateRowHeight={28}
          rowAlign="start"
          columnSizing={tablePrefs.columnWidths}
          onColumnSizingChange={handleColumnSizingChange}
          columnVisibility={tablePrefs.columnVisibility}
          onRowClick={(frame) => {
            if (frame.direction === 'status') return;
            toggle(frame.id);
          }}
          renderSubRow={(frame) =>
            isExpanded(frame.id) ? (
              <div className="px-2.5 pt-0.5 pb-2">
                <JsonViewer
                  instanceId={frame.id}
                  value={frame.preview ?? frame.text}
                  searchText={searchText}
                  searchFocusKey={searchFocusKey}
                />
              </div>
            ) : null
          }
          emptyState={t('websocket.noMessages')}
        />
      </div>
    </div>
  );
}
