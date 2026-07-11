import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
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
import { useVirtualizer } from '@tanstack/react-virtual';
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
  /**
   * 행 가상화(보이는 행만 렌더). 콘솔·네트워크처럼 많이 쌓이는 목록에서 켠다.
   * 켜면 off-screen 행은 DOM에 없으므로, 특정 행으로 스크롤할 땐 scrollToId를 쓴다.
   */
  virtualized?: boolean;
  /** 가상화 시 초기 행 높이 추정치(px). 실제 높이는 마운트 후 measureElement로 잰다. */
  estimateRowHeight?: number;
  /** 이 id의 행을 화면에 보이도록 스크롤한다(가상화 시 off-screen 행도 마운트). 값이 바뀔 때 동작. */
  scrollToId?: string | null;
  /** scrollToId 정렬. 'auto'=안 보일 때만 최소 이동, 'center'=항상 중앙. 기본 'auto'. */
  scrollToAlign?: 'auto' | 'center' | 'start';
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
  virtualized = false,
  estimateRowHeight = 30,
  scrollToId,
  scrollToAlign = 'auto',
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

  // 헤더는 sticky라 스크롤된 목록의 위쪽을 덮는다. 행을 scrollIntoView로 끌어올 때
  // 헤더 뒤로 숨지 않도록, 실제 헤더 높이를 재서 행의 scroll-margin-top으로 준다.
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const measure = () => setHeaderHeight(header.offsetHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  const visibleColumns = table.getVisibleLeafColumns();
  const gridTemplateColumns = visibleColumns
    .map((column) => {
      const meta = columnMeta(column.columnDef.meta);
      return meta.flex ? `minmax(${meta.minWidth ?? 120}px, 1fr)` : `${column.getSize()}px`;
    })
    .join(' ');

  const rows = table.getRowModel().rows;

  // 스크롤 컨테이너 = 루트. virtualizer가 여기에 붙는다. rootRef 콜백이 매 렌더 새
  // 함수여도 스크롤 요소가 흔들리지 않게, 최신 rootRef를 ref에 담아 두고 호출한다.
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const rootRefLatest = useRef(rootRef);
  rootRefLatest.current = rootRef;
  const setScrollElement = useCallback((element: HTMLDivElement | null) => {
    scrollElementRef.current = element;
    rootRefLatest.current?.(element);
  }, []);

  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row, index) => map.set(row.id, index));
    return map;
  }, [rows]);
  // scrollToId 효과가 "행 목록이 바뀔 때"가 아니라 "scrollToId가 바뀔 때"만 돌도록,
  // 인덱스 맵은 ref로 읽는다(새 요청이 스트리밍돼도 선택 행으로 튀지 않게).
  const rowIndexByIdRef = useRef(rowIndexById);
  rowIndexByIdRef.current = rowIndexById;

  const virtualizer = useVirtualizer({
    count: rows.length,
    // virtualized=false면 스크롤 요소를 주지 않아 리스너도 안 붙고 아무 일도 안 한다.
    getScrollElement: () => (virtualized ? scrollElementRef.current : null),
    estimateSize: () => estimateRowHeight,
    overscan: 12,
    getItemKey: (index) => rows[index]?.id ?? index,
  });

  // 활성 행(검색 히트/선택)을 화면에 보이도록 스크롤한다. 가상화에서 off-screen 행을
  // DOM에 올리는 유일한 경로 — 이후 각 뷰가 마운트된 행에 하이라이트/미세 스크롤을 이어간다.
  useEffect(() => {
    if (!virtualized || scrollToId == null) return;
    const index = rowIndexByIdRef.current.get(scrollToId);
    if (index == null) return;
    virtualizer.scrollToIndex(index, { align: scrollToAlign });
  }, [virtualized, scrollToId, scrollToAlign, virtualizer]);

  const computeRowClass = (row: Row<T>, isSelected: boolean) =>
    cn(
      'group/row cursor-pointer border-b border-line-weak text-ink hover:bg-row-hover',
      isSelected && 'bg-accent-soft shadow-[inset_3px_0_0_var(--blue)] hover:bg-accent-soft',
      rowClassName?.(row.original),
    );

  const rowKeyDown = (row: Row<T>) => (event: ReactKeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick?.(row.original);
    }
  };

  const renderRowInner = (row: Row<T>) => (
    <>
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
    </>
  );

  return (
    <div
      className={cn('flex h-full min-h-0 flex-col overflow-auto', className)}
      role="table"
      aria-label={ariaLabel}
      ref={setScrollElement}
    >
      <div
        ref={headerRef}
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

      {rows.length === 0 ? (
        <div className="px-3 py-4 text-[12px] text-ink-weak">{emptyState}</div>
      ) : virtualized ? (
        <div
          className="relative flex-none"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const row = rows[virtualItem.index];
            const isSelected = selectedRowId === row.id;
            return (
              <div
                key={row.id}
                data-index={virtualItem.index}
                ref={(element) => {
                  // 가변 높이 실측 + 뷰의 행 조회용 등록을 한 콜백에서 처리한다.
                  virtualizer.measureElement(element);
                  registerRowRef?.(row.id, element);
                }}
                role="row"
                tabIndex={0}
                data-row-id={row.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                  scrollMarginTop: headerHeight,
                }}
                className={computeRowClass(row, isSelected)}
                onClick={() => onRowClick?.(row.original)}
                onContextMenu={
                  onRowContextMenu ? (event) => onRowContextMenu(row.original, event) : undefined
                }
                onKeyDown={rowKeyDown(row)}
              >
                {renderRowInner(row)}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-none">
          {rows.map((row: Row<T>) => {
            const isSelected = selectedRowId === row.id;
            return (
              <div
                key={row.id}
                ref={registerRowRef ? (element) => registerRowRef(row.id, element) : undefined}
                role="row"
                tabIndex={0}
                data-row-id={row.id}
                style={{ scrollMarginTop: headerHeight }}
                className={computeRowClass(row, isSelected)}
                onClick={() => onRowClick?.(row.original)}
                onContextMenu={
                  onRowContextMenu ? (event) => onRowContextMenu(row.original, event) : undefined
                }
                onKeyDown={rowKeyDown(row)}
              >
                {renderRowInner(row)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
