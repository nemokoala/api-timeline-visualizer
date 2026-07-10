import { type ReactNode, type MouseEvent as ReactMouseEvent } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type OnChangeFn,
  type Row,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { cn } from '../../utils/cn';

/** 컬럼별 추가 메타. flex 컬럼은 잔여 폭(1fr)을 차지하고 리사이즈되지 않는다. */
export type DataTableColumnMeta = {
  /** true면 이 컬럼이 남은 폭을 채운다(px 폭 대신 minmax(min,1fr)). */
  flex?: boolean;
  /** flex 컬럼의 최소 폭(px). */
  minWidth?: number;
  headerClassName?: string;
  cellClassName?: string;
};

type DataTableProps<T> = {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  getRowId: (row: T) => string;
  columnSizing: ColumnSizingState;
  onColumnSizingChange: OnChangeFn<ColumnSizingState>;
  columnVisibility?: VisibilityState;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  enableSorting?: boolean;
  selectedRowId?: string | null;
  onRowClick?: (row: T) => void;
  /**
   * 행별 추가 클래스. 선택 상태 클래스보다 나중에 머지되므로,
   * 선택된 행의 기본 배경(bg-accent-soft)을 덮어쓸 수 있다 —
   * 선택 여부에 따라 달라져야 하면 호출부에서 분기할 것.
   */
  rowClassName?: (row: T) => string;
  /** 각 행 아래에 전폭으로 그릴 서브행(예: 네트워크 타임라인 막대). */
  renderSubRow?: (row: T) => ReactNode;
  /** 행 DOM 등록(스크롤/검색 이동용). */
  registerRowRef?: (id: string, element: HTMLElement | null) => void;
  onHeaderContextMenu?: (event: ReactMouseEvent) => void;
  /**
   * 데이터 행 우클릭 컨텍스트 메뉴. 헤더 우클릭은 onHeaderContextMenu(열 표시 메뉴)가 처리한다.
   * ContextMenu 키·Shift+F10도 브라우저가 contextmenu 이벤트로 바꿔 주므로 여기서 함께 잡힌다.
   */
  onRowContextMenu?: (row: T, event: ReactMouseEvent) => void;
  emptyState?: ReactNode;
  /** 스크롤 컨테이너 ref — 자동 스크롤·행 조회용. */
  rootRef?: (element: HTMLDivElement | null) => void;
  /** 루트에 추가할 클래스(예: 도메인 컨텍스트 마커). */
  className?: string;
  /** 행 셀 세로 정렬. wrap 모드(콘솔 줄바꿈)에서는 start. */
  rowAlign?: 'center' | 'start';
  ariaLabel?: string;
};

function columnMeta(meta: unknown): DataTableColumnMeta {
  return (meta as DataTableColumnMeta) ?? {};
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  columnSizing,
  onColumnSizingChange,
  columnVisibility,
  sorting,
  onSortingChange,
  enableSorting = false,
  selectedRowId,
  onRowClick,
  rowClassName,
  renderSubRow,
  registerRowRef,
  onHeaderContextMenu,
  onRowContextMenu,
  emptyState,
  rootRef,
  className,
  rowAlign = 'center',
  ariaLabel,
}: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { columnSizing, columnVisibility, sorting },
    onColumnSizingChange,
    onSortingChange,
    enableSorting,
    enableSortingRemoval: false,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
  });

  const visibleColumns = table.getVisibleLeafColumns();
  const gridTemplateColumns = visibleColumns
    .map((column) => {
      const meta = columnMeta(column.columnDef.meta);
      return meta.flex ? `minmax(${meta.minWidth ?? 120}px, 1fr)` : `${column.getSize()}px`;
    })
    .join(' ');

  const rows = table.getRowModel().rows;

  return (
    <div
      className={cn('flex h-full min-h-0 flex-col overflow-auto', className)}
      role="table"
      aria-label={ariaLabel}
      ref={rootRef}
    >
      <div
        className="sticky top-0 z-[2] grid border-b border-line-weak bg-surface"
        role="row"
        style={{ gridTemplateColumns }}
        onContextMenu={onHeaderContextMenu}
      >
        {table.getHeaderGroups()[0]?.headers.map((header) => {
          const meta = columnMeta(header.column.columnDef.meta);
          const canSort = header.column.getCanSort();
          const sorted = header.column.getIsSorted();
          const canResize = header.column.getCanResize() && !meta.flex;
          return (
            <div
              key={header.id}
              role="columnheader"
              className={cn(
                'relative flex min-w-0 select-none items-center gap-1 px-2.5 py-[7px] text-[11px] font-semibold uppercase tracking-[0.02em] text-ink-weak',
                canSort && 'cursor-pointer',
                sorted && 'text-ink-strong',
                meta.headerClassName,
              )}
              onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
            >
              <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                {flexRender(header.column.columnDef.header, header.getContext())}
              </span>
              {sorted ? (
                <span className="text-[10px] text-accent" aria-hidden="true">
                  {sorted === 'asc' ? '↑' : '↓'}
                </span>
              ) : null}
              {canResize ? (
                <span
                  className={cn(
                    "absolute top-0 right-0 h-full w-[9px] cursor-col-resize touch-none select-none",
                    "after:absolute after:top-[22%] after:right-1 after:h-[56%] after:w-[2px] after:rounded-[2px] after:bg-line after:content-['']",
                    'hover:after:top-0 hover:after:h-full hover:after:bg-accent',
                    header.column.getIsResizing() && 'after:top-0 after:h-full after:bg-accent',
                  )}
                  role="separator"
                  aria-orientation="vertical"
                  onMouseDown={header.getResizeHandler()}
                  onTouchStart={header.getResizeHandler()}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={() => header.column.resetSize()}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex-none">
        {rows.length === 0 ? (
          <div className="px-3 py-4 text-[12px] text-ink-weak">{emptyState}</div>
        ) : (
          rows.map((row: Row<T>) => {
            const id = row.id;
            const isSelected = selectedRowId === id;
            return (
              <div
                key={id}
                ref={registerRowRef ? (element) => registerRowRef(id, element) : undefined}
                role="row"
                tabIndex={0}
                data-row-id={id}
                className={cn(
                  'group/row cursor-pointer border-b border-line-weak text-ink hover:bg-row-hover',
                  isSelected &&
                    'bg-accent-soft shadow-[inset_3px_0_0_var(--blue)] hover:bg-accent-soft',
                  rowClassName?.(row.original),
                )}
                onClick={() => onRowClick?.(row.original)}
                onContextMenu={
                  onRowContextMenu
                    ? (event) => onRowContextMenu(row.original, event)
                    : undefined
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onRowClick?.(row.original);
                  }
                }}
              >
                <div
                  data-row-cells=""
                  className={cn('grid', rowAlign === 'start' ? 'items-start' : 'items-center')}
                  style={{ gridTemplateColumns }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = columnMeta(cell.column.columnDef.meta);
                    return (
                      <div
                        key={cell.id}
                        role="cell"
                        className={cn(
                          'min-w-0 overflow-hidden px-2.5 py-[7px] text-[12px]',
                          meta.cellClassName,
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    );
                  })}
                </div>
                {renderSubRow ? <div>{renderSubRow(row.original)}</div> : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
