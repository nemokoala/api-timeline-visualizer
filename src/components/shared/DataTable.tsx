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
  rowClassName?: (row: T) => string;
  /** 각 행 아래에 전폭으로 그릴 서브행(예: 네트워크 타임라인 막대). */
  renderSubRow?: (row: T) => ReactNode;
  /** 행 DOM 등록(스크롤/검색 이동용). */
  registerRowRef?: (id: string, element: HTMLElement | null) => void;
  onHeaderContextMenu?: (event: ReactMouseEvent) => void;
  emptyState?: ReactNode;
  /** 스크롤 컨테이너(.data-table) ref — 자동 스크롤·행 조회용. */
  rootRef?: (element: HTMLDivElement | null) => void;
  /** 루트에 추가할 클래스(예: wrap-lines). */
  className?: string;
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
  emptyState,
  rootRef,
  className,
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
    <div className={`data-table ${className ?? ''}`} role="table" aria-label={ariaLabel} ref={rootRef}>
      <div className="data-table-header" role="row" style={{ gridTemplateColumns }} onContextMenu={onHeaderContextMenu}>
        {table.getHeaderGroups()[0]?.headers.map((header) => {
          const meta = columnMeta(header.column.columnDef.meta);
          const canSort = header.column.getCanSort();
          const sorted = header.column.getIsSorted();
          const canResize = header.column.getCanResize() && !meta.flex;
          return (
            <div
              key={header.id}
              role="columnheader"
              className={`data-table-header-cell ${meta.headerClassName ?? ''} ${canSort ? 'is-sortable' : ''} ${sorted ? 'is-sorted' : ''}`}
              onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
            >
              <span className="data-table-header-label">
                {flexRender(header.column.columnDef.header, header.getContext())}
              </span>
              {sorted ? (
                <span className="data-table-sort-indicator" aria-hidden="true">
                  {sorted === 'asc' ? '↑' : '↓'}
                </span>
              ) : null}
              {canResize ? (
                <span
                  className={`data-table-resize-handle ${header.column.getIsResizing() ? 'is-resizing' : ''}`}
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

      <div className="data-table-body">
        {rows.length === 0 ? (
          <div className="data-table-empty">{emptyState}</div>
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
                className={`data-table-row ${isSelected ? 'selected' : ''} ${rowClassName?.(row.original) ?? ''}`}
                onClick={() => onRowClick?.(row.original)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onRowClick?.(row.original);
                  }
                }}
              >
                <div className="data-table-row-cells" style={{ gridTemplateColumns }}>
                  {row.getVisibleCells().map((cell) => {
                    const meta = columnMeta(cell.column.columnDef.meta);
                    return (
                      <div key={cell.id} role="cell" className={`data-table-cell ${meta.cellClassName ?? ''}`}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    );
                  })}
                </div>
                {renderSubRow ? <div className="data-table-subrow">{renderSubRow(row.original)}</div> : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
