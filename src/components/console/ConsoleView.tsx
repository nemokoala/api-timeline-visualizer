import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import type { ConsoleEntry, ConsoleLevelFilter } from '../../types/console';
import { useSplitPanelLayout } from '../../hooks/useSplitPanelLayout';
import { clearInspectedConsoleBuffer } from '../../utils/consoleInspector';
import { scrollSearchHitIntoView } from '../../utils/searchScroll';
import { useSearchOptions } from '../../contexts/SearchOptionsContext';
import { highlightSearchText, textMatchesSearch } from '../../utils/searchHighlight';
import { matchesIncludeExcludeFilters } from '../../utils/textFilters';
import {
  buildConsoleSearchOccurrences,
  consoleArgsMatchSearch,
  getSearchMatchIndexForConsoleEntry,
  type ConsoleSearchOccurrence,
} from '../../utils/consoleSearch';
import { formatConsoleMessagePreview } from '../../utils/consoleMessagePreview';
import { DetailPanelCloseButton, SplitLayoutToggleButton } from '../shared/DetailPanelCloseButton';
import { DetailSection } from '../shared/DetailSection';
import { DetailTitleBar } from '../shared/DetailTitleBar';
import { DefinitionList } from '../shared/DefinitionList';
import { JsonTree, JsonViewer } from '../shared/JsonViewer';
import { SplitPanelResizer } from '../shared/SplitPanelResizer';
import { formatDateTime } from '../../utils/formatters';
import { ColumnMenu } from '../shared/ColumnMenu';
import { DataTable } from '../shared/DataTable';
import { getTablePrefs, saveTablePrefs, type TablePrefs } from '../../utils/tablePrefs';
import type { ColumnDef, ColumnSizingState, OnChangeFn } from '@tanstack/react-table';
import { Button, IconButton } from '../ui/Button';
import { PillTabs } from '../ui/PillTabs';
import { ToggleControl } from '../ui/ToggleControl';
import { cn } from '../../utils/cn';

type ConsoleViewProps = {
  entries: ConsoleEntry[];
  selectedEntryId: string | null;
  searchText: string;
  includeText: string;
  excludeText: string;
  searchMatchIndex: number;
  onEntriesChange: (entries: ConsoleEntry[]) => void;
  onSelectedEntryIdChange: (entryId: string | null) => void;
  onSearchOccurrencesChange: (occurrences: ConsoleSearchOccurrence[]) => void;
  onSearchMatchIndexChange: (index: number) => void;
};

const LEVEL_FILTERS: Array<{ value: ConsoleLevelFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'log', label: 'Log' },
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warn' },
  { value: 'error', label: 'Error' },
  { value: 'debug', label: 'Debug' },
];

type ConsoleColumnId = 'level' | 'timestamp' | 'source';

const CONSOLE_COLUMNS: Array<{ id: ConsoleColumnId; label: string }> = [
  { id: 'level', label: 'Level' },
  { id: 'timestamp', label: 'Timestamp' },
  { id: 'source', label: 'Source' },
];

const WRAP_LINES_STORAGE_KEY = 'console-wrap-lines';

/* 레벨별 글자색. error는 강조를 위해 진한 빨강 원색(--red). */
const LEVEL_TEXT_COLOR: Record<string, string> = {
  log: 'text-ink-sub',
  info: 'text-accent',
  warn: 'text-warn',
  error: 'text-danger-bg',
  debug: 'text-purple',
};
const CONSOLE_PREFS_KEY = 'console-table-prefs';

const CONSOLE_DEFAULT_PREFS: TablePrefs = {
  columnVisibility: { level: true, timestamp: true, message: true, repeat: true, source: true },
  columnWidths: { level: 60, timestamp: 96, repeat: 48, source: 150 },
};

function loadWrapLines(): boolean {
  try {
    return localStorage.getItem(WRAP_LINES_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function ConsoleView({
  entries,
  selectedEntryId,
  searchText,
  includeText,
  excludeText,
  searchMatchIndex,
  onEntriesChange,
  onSelectedEntryIdChange,
  onSearchOccurrencesChange,
  onSearchMatchIndexChange,
}: ConsoleViewProps) {
  const searchOptions = useSearchOptions();
  const [levelFilter, setLevelFilter] = useState<ConsoleLevelFilter>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [wrapLines, setWrapLines] = useState(loadWrapLines);
  const [tablePrefs, setTablePrefs] = useState<TablePrefs>(() =>
    getTablePrefs(CONSOLE_PREFS_KEY, CONSOLE_DEFAULT_PREFS),
  );
  const [columnMenu, setColumnMenu] = useState<{ x: number; y: number } | null>(null);
  const [expandedEntryIds, setExpandedEntryIds] = useState<ReadonlySet<string>>(() => new Set());
  const consoleWorkspaceRef = useRef<HTMLDivElement>(null);
  const logListRef = useRef<HTMLDivElement | null>(null);

  const toggleExpandedEntry = useCallback((entryId: string) => {
    setExpandedEntryIds((current) => {
      const next = new Set(current);
      if (!next.delete(entryId)) next.add(entryId);
      return next;
    });
  }, []);

  const persistTablePrefs = (next: TablePrefs) => {
    setTablePrefs(next);
    saveTablePrefs(CONSOLE_PREFS_KEY, next);
  };

  const handleColumnToggle = (col: ConsoleColumnId) => {
    persistTablePrefs({
      ...tablePrefs,
      columnVisibility: { ...tablePrefs.columnVisibility, [col]: !tablePrefs.columnVisibility[col] },
    });
  };

  const handleColumnSizingChange: OnChangeFn<ColumnSizingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(tablePrefs.columnWidths) : updater;
    persistTablePrefs({ ...tablePrefs, columnWidths: next });
  };

  const columns = useMemo<ColumnDef<ConsoleEntry, unknown>[]>(
    () => [
      {
        id: 'level',
        header: 'Level',
        size: 60,
        minSize: 44,
        cell: ({ row }) => (
          <span
            className={`overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.04em] ${
              LEVEL_TEXT_COLOR[row.original.level] ?? 'text-ink-weak'
            }`}
          >
            {row.original.level}
          </span>
        ),
      },
      {
        id: 'timestamp',
        header: 'Time',
        size: 96,
        minSize: 72,
        cell: ({ row }) => (
          <span className="text-[11px] text-ink-weak tabular-nums">
            {formatDateTime(row.original.timestamp)}
          </span>
        ),
      },
      {
        id: 'message',
        header: 'Message',
        enableResizing: false,
        meta: { flex: true, minWidth: 160 },
        cell: ({ row }) => {
          const entry = row.original;
          const preview = formatConsoleMessagePreview(entry.text);
          const hasJson = getJsonArgs(entry).length > 0;
          const isExpanded = expandedEntryIds.has(entry.id);
          return (
            <div className="flex min-w-0 items-start gap-1">
              {hasJson ? (
                <IconButton
                  size="xs"
                  ghost
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? 'JSON 접기' : 'JSON 펼치기'}
                  className="h-[17px] min-w-[17px] shrink-0 rounded px-0 text-[8px]"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleExpandedEntry(entry.id);
                  }}
                >
                  <span className={cn('transition-transform duration-[120ms]', isExpanded && 'rotate-90')}>
                    ▶
                  </span>
                </IconButton>
              ) : (
                <span className="w-[17px] shrink-0" aria-hidden="true" />
              )}
              <span
                className={
                  wrapLines
                    ? 'min-w-0 overflow-visible whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word]'
                    : 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap'
                }
                title={entry.text}
              >
                {searchText.trim() ? highlightSearchText(preview, searchText, searchOptions) : preview}
              </span>
            </div>
          );
        },
      },
      {
        id: 'repeat',
        header: '',
        size: 48,
        minSize: 32,
        enableResizing: false,
        cell: ({ row }) =>
          row.original.repeatCount && row.original.repeatCount > 1 ? (
            <span className="min-w-[18px] rounded-full bg-accent-soft px-1.5 py-px text-center text-[10px] font-bold leading-[15px] text-accent-strong">
              {row.original.repeatCount}
            </span>
          ) : null,
      },
      {
        id: 'source',
        header: 'Source',
        size: 150,
        minSize: 80,
        cell: ({ row }) => {
          const source = row.original.source;
          if (!source) return null;
          return (
            <span
              className={`text-[10px] text-ink-weak ${
                wrapLines
                  ? 'overflow-visible whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word]'
                  : 'max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap'
              }`}
              title={source}
            >
              {searchText.trim() ? highlightSearchText(source, searchText, searchOptions) : source}
            </span>
          );
        },
      },
    ],
    [expandedEntryIds, searchOptions, searchText, toggleExpandedEntry, wrapLines],
  );

  const handleColumnContextMenu = (event: ReactMouseEvent) => {
    event.preventDefault();
    setColumnMenu({ x: event.clientX, y: event.clientY });
  };
  const {
    isStacked: isSplitStacked,
    layoutStyle: splitLayoutStyle,
    startWidthResize,
    startHeightResize,
    resetWidth: resetSplitWidth,
    resetHeight: resetSplitHeight,
    toggleSplitLayout,
  } = useSplitPanelLayout(consoleWorkspaceRef);

  const hasSearch = Boolean(searchText.trim());
  const hasIncludeExclude = Boolean(includeText.trim() || excludeText.trim());

  const displayEntries = useMemo(() => {
    const filtered = entries.filter((entry) => {
      if (entry.level === 'clear') return false;
      if (levelFilter !== 'all' && entry.level !== levelFilter) return false;
      if (hasIncludeExclude) {
        const haystack = `${entry.text} ${entry.source ?? ''} ${entry.stack ?? ''}`;
        if (!matchesIncludeExcludeFilters(haystack, includeText, excludeText)) return false;
      }
      return true;
    });

    return groupRepeatedEntries(filtered);
  }, [entries, excludeText, hasIncludeExclude, includeText, levelFilter]);

  const searchOccurrences = useMemo(() => {
    if (!hasSearch) return [];
    return buildConsoleSearchOccurrences(displayEntries, searchText, searchOptions);
  }, [displayEntries, hasSearch, searchOptions, searchText]);

  const activeSearchOccurrence = searchOccurrences[searchMatchIndex] ?? null;
  const searchFocusKey = `${searchMatchIndex}:${activeSearchOccurrence?.entryId ?? ''}`;
  const selectedEntry = displayEntries.find((entry) => entry.id === selectedEntryId) ?? null;
  const hasDetail = Boolean(selectedEntry);

  useEffect(() => {
    onSearchOccurrencesChange(searchOccurrences);
  }, [onSearchOccurrencesChange, searchOccurrences]);

  useEffect(() => {
    return () => onSearchOccurrencesChange([]);
  }, [onSearchOccurrencesChange]);


  useEffect(() => {
    if (!hasSearch || !searchOccurrences.length) return;

    const clampedIndex = searchMatchIndex % searchOccurrences.length;
    if (clampedIndex !== searchMatchIndex) {
      onSearchMatchIndexChange(clampedIndex);
      return;
    }

    // Follow the active hit with the selected entry so the detail panel reveals
    // matches that only live there (arguments, stack) — these aren't rendered in
    // the list row, so navigation would otherwise look frozen on them. The list
    // still shows every entry in context; nothing is filtered out.
    const occurrence = searchOccurrences[clampedIndex];
    if (occurrence) onSelectedEntryIdChange(occurrence.entryId);
  }, [hasSearch, onSearchMatchIndexChange, onSelectedEntryIdChange, searchMatchIndex, searchOccurrences]);

  useEffect(() => {
    if (!selectedEntryId) return;
    if (displayEntries.some((entry) => entry.id === selectedEntryId)) return;
    onSelectedEntryIdChange(null);
  }, [displayEntries, onSelectedEntryIdChange, selectedEntryId]);

  useEffect(() => {
    // Don't auto-scroll to the bottom while searching — it would fight the
    // scroll-to-hit navigation and pull the user away from the active match.
    if (!autoScroll || hasSearch || !logListRef.current) return;
    logListRef.current.scrollTop = logListRef.current.scrollHeight;
  }, [autoScroll, hasSearch, displayEntries.length]);

  useEffect(() => {
    if (!activeSearchOccurrence) return;

    const frameId = window.requestAnimationFrame(() => {
      const list = logListRef.current;
      const row = list?.querySelector<HTMLElement>(
        `[data-row-id="${CSS.escape(activeSearchOccurrence.entryId)}"]`,
      );

      // Always scroll the list to the active hit, even while a detail panel is
      // open — otherwise navigating hits leaves the list (and the detail panel,
      // which stays on the clicked entry) frozen in place.
      if (row) scrollSearchHitIntoView(row);

      list
        ?.querySelectorAll('.search-highlight.is-active')
        .forEach((mark) => mark.classList.remove('is-active'));

      if (!hasDetail) {
        // 셀 영역으로 한정한다. 펼쳐진 JSON 서브행에도 .search-highlight가 생기는데,
        // occurrenceIndex는 셀 기준 순번이라 함께 세면 활성 마크가 어긋난다.
        const rowMarks = row?.querySelectorAll('[data-row-cells] .search-highlight');
        rowMarks?.forEach((mark, index) => {
          mark.classList.toggle('is-active', index === activeSearchOccurrence.occurrenceIndex);
        });
      }
    });

    return () => window.cancelAnimationFrame(frameId);
    // expandedEntryIds: 행을 펼치면 리렌더로 마크 DOM이 새로 만들어져 손으로 붙인
    // is-active가 사라진다. 다시 칠하려고 의존성에 둔다.
  }, [activeSearchOccurrence, expandedEntryIds, hasDetail, searchMatchIndex]);

  const handleSelectEntry = (entryId: string) => {
    // 같은 행을 다시 누르면 세부 패널을 닫는다(토글).
    if (entryId === selectedEntryId) {
      onSelectedEntryIdChange(null);
      return;
    }

    if (hasSearch) {
      const matchIndex = getSearchMatchIndexForConsoleEntry(searchOccurrences, entryId);
      if (matchIndex !== null) {
        onSearchMatchIndexChange(matchIndex);
      }
    }

    onSelectedEntryIdChange(entryId);
  };

  const handleClear = async () => {
    await clearInspectedConsoleBuffer();
    onEntriesChange([]);
    onSelectedEntryIdChange(null);
    onSearchMatchIndexChange(0);
  };

  return (
    <section className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-bg">
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-line-weak bg-surface px-3.5 py-2.5">
        <PillTabs
          className="min-w-0 overflow-x-auto"
          ariaLabel="Console level filter"
          value={levelFilter}
          onChange={setLevelFilter}
          options={LEVEL_FILTERS}
        />
        <div className="flex flex-none items-center gap-2.5">
          <ToggleControl label="Auto-scroll" checked={autoScroll} onChange={setAutoScroll} />
          <ToggleControl
            label="Wrap lines"
            checked={wrapLines}
            onChange={(next) => {
              setWrapLines(next);
              localStorage.setItem(WRAP_LINES_STORAGE_KEY, String(next));
            }}
          />
          <Button onClick={() => void handleClear()} disabled={!entries.length}>
            Clear
          </Button>
        </div>
      </div>

      <div
        ref={consoleWorkspaceRef}
        className={`grid h-full min-h-0 overflow-hidden ${hasDetail && isSplitStacked ? 'split-layout-stacked' : ''}`}
        style={hasDetail ? splitLayoutStyle : undefined}
      >
        <DataTable
          ariaLabel="Console logs"
          className="console-log-list min-h-0 min-w-0 bg-surface"
          rowAlign={wrapLines ? 'start' : 'center'}
          rootRef={(element) => {
            logListRef.current = element;
          }}
          columns={columns}
          data={displayEntries}
          getRowId={(entry) => entry.id}
          columnSizing={tablePrefs.columnWidths}
          onColumnSizingChange={handleColumnSizingChange}
          columnVisibility={tablePrefs.columnVisibility}
          selectedRowId={selectedEntryId}
          onRowClick={(entry) => handleSelectEntry(entry.id)}
          renderSubRow={(entry) =>
            expandedEntryIds.has(entry.id) ? (
              <ConsoleRowJson entry={entry} searchText={searchText} />
            ) : null
          }
          rowClassName={(entry) => {
            // 레벨 색조는 hover/selected 배경보다 우선한다(원본 CSS 우선순위 유지).
            if (entry.level === 'error') {
              const strong = entry.id === selectedEntryId;
              return strong
                ? 'bg-[rgba(240,68,82,0.1)] hover:bg-[rgba(240,68,82,0.1)]'
                : 'bg-[rgba(240,68,82,0.05)] hover:bg-[rgba(240,68,82,0.1)]';
            }
            if (entry.level === 'warn') {
              return 'bg-[rgba(255,158,44,0.07)] hover:bg-[rgba(255,158,44,0.07)]';
            }
            return '';
          }}
          onHeaderContextMenu={handleColumnContextMenu}
          emptyState="No console output yet. Logs appear after the panel opens."
        />

        {hasDetail && selectedEntry ? (
          <>
            <SplitPanelResizer
              orientation={isSplitStacked ? 'horizontal' : 'vertical'}
              ariaLabel="Resize console detail panel"
              onMouseDown={isSplitStacked ? startHeightResize : startWidthResize}
              onDoubleClick={isSplitStacked ? resetSplitHeight : resetSplitWidth}
            />
            <ConsoleDetailPanel
              entry={selectedEntry}
              searchText={searchText}
              searchOccurrenceIndex={activeSearchOccurrence?.occurrenceIndex ?? 0}
              searchFocusKey={searchFocusKey}
              isStacked={isSplitStacked}
              onToggleLayout={toggleSplitLayout}
              onClose={() => onSelectedEntryIdChange(null)}
            />
          </>
        ) : null}
      </div>

      {columnMenu ? (
        <ColumnMenu
          columns={CONSOLE_COLUMNS}
          visibility={tablePrefs.columnVisibility as Record<ConsoleColumnId, boolean>}
          position={columnMenu}
          minVisible={0}
          onToggle={handleColumnToggle}
          onClose={() => setColumnMenu(null)}
        />
      ) : null}
    </section>
  );
}

function ConsoleDetailPanel({
  entry,
  searchText,
  searchOccurrenceIndex,
  searchFocusKey,
  isStacked,
  onToggleLayout,
  onClose,
}: {
  entry: ConsoleEntry;
  searchText: string;
  searchOccurrenceIndex: number;
  searchFocusKey: string;
  isStacked: boolean;
  onToggleLayout: () => void;
  onClose: () => void;
}) {
  const searchOptions = useSearchOptions();
  const panelRef = useRef<HTMLElement>(null);
  const hasSearch = Boolean(searchText.trim());

  useEffect(() => {
    if (!hasSearch) return;

    const frameId = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;

      document
        .querySelectorAll('.console-log-list .search-highlight.is-active')
        .forEach((mark) => mark.classList.remove('is-active'));

      const marks = panel.querySelectorAll('.search-highlight');
      marks.forEach((mark, index) => {
        mark.classList.toggle('is-active', index === searchOccurrenceIndex);
      });

      const target = marks[searchOccurrenceIndex] ?? marks[0];
      if (!target) return;

      scrollSearchHitIntoView(target);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [entry, hasSearch, searchFocusKey, searchOccurrenceIndex, searchText]);

  const argsMatchesSearch = hasSearch && consoleArgsMatchSearch(entry.args, searchText, searchOptions);
  const summaryMatchesSearch =
    hasSearch &&
    (textMatchesSearch(entry.level, searchText, searchOptions) ||
      (entry.source ? textMatchesSearch(entry.source, searchText, searchOptions) : false) ||
      (entry.args.length === 0 && textMatchesSearch(entry.text, searchText, searchOptions)));

  const stackMatchesSearch =
    hasSearch && entry.stack ? textMatchesSearch(entry.stack, searchText, searchOptions) : false;

  return (
    <aside
      className="h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto bg-surface pb-[30px] [scrollbar-gutter:stable]"
      ref={panelRef}
    >
      <DetailTitleBar
        kicker={entry.level}
        kickerCaps
        title={entry.text}
        titleAttr={entry.text}
        actions={
          <>
            <span className="flex-none text-[11px] text-ink-weak tabular-nums">
              {formatDateTime(entry.timestamp)}
            </span>
            <SplitLayoutToggleButton isStacked={isStacked} onClick={onToggleLayout} />
            <DetailPanelCloseButton onClick={onClose} label="Close log detail" />
          </>
        }
      />

      <DetailSection
        sectionId={`${entry.id}:summary`}
        title="Summary"
        defaultOpen
        density="compact"
        expandForSearch={summaryMatchesSearch}
        searchExpandToken={searchFocusKey}
      >
        <DefinitionList
          className="gap-1"
          rowClassName="grid-cols-[68px_minmax(0,1fr)] gap-2"
          textClassName="text-[11px] leading-[1.35]"
          rows={[
            [
              'Level',
              hasSearch ? highlightSearchText(entry.level, searchText, searchOptions) : entry.level,
            ] as [string, ReactNode],
            ...(entry.args.length === 0
              ? [
                  [
                    'Message',
                    hasSearch
                      ? highlightSearchText(entry.text, searchText, searchOptions)
                      : entry.text,
                  ] as [string, ReactNode],
                ]
              : []),
            ...(entry.source
              ? [
                  [
                    'Source',
                    hasSearch
                      ? highlightSearchText(entry.source, searchText, searchOptions)
                      : entry.source,
                  ] as [string, ReactNode],
                ]
              : []),
            ...(entry.repeatCount && entry.repeatCount > 1
              ? [['Repeated', `${entry.repeatCount} times`] as [string, ReactNode]]
              : []),
          ]}
        />
      </DetailSection>

      <DetailSection
        sectionId={`${entry.id}:args`}
        title={`Arguments (${entry.args.length})`}
        defaultOpen
        density="compact"
        expandForSearch={argsMatchesSearch}
        searchExpandToken={searchFocusKey}
      >
        <div className="grid gap-2.5">
          {entry.args.length === 0 ? (
            <p className="m-0 text-[12px] text-ink-weak">No arguments.</p>
          ) : (
            entry.args.map((arg, index) => (
              <ConsoleArgBlock
                key={`${entry.id}:arg:${index}`}
                index={index}
                value={arg}
                entryId={entry.id}
                searchText={searchText}
                searchFocusKey={searchFocusKey}
              />
            ))
          )}
        </div>
      </DetailSection>

      {entry.stack ? (
        <DetailSection
          sectionId={`${entry.id}:stack`}
          title="Stack"
          defaultOpen={entry.level === 'error'}
          density="compact"
          expandForSearch={stackMatchesSearch}
          searchExpandToken={searchFocusKey}
        >
          <pre className="m-0 overflow-auto whitespace-pre-wrap rounded-[10px] border border-line-weak bg-surface-sub px-[11px] py-[9px] text-[11px] leading-[1.45] text-ink [word-break:break-word] [font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]">
            {hasSearch ? highlightSearchText(entry.stack, searchText, searchOptions) : entry.stack}
          </pre>
        </DetailSection>
      ) : null}
    </aside>
  );
}

function ConsoleArgBlock({
  index,
  value,
  entryId,
  searchText,
  searchFocusKey,
}: {
  index: number;
  value: unknown;
  entryId: string;
  searchText: string;
  searchFocusKey: string;
}) {
  const searchOptions = useSearchOptions();
  const hasSearch = Boolean(searchText.trim());

  if (shouldRenderArgInJsonViewer(value)) {
    return (
      <div className="console-arg-block grid gap-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.04em] text-ink-weak">arg[{index}]</div>
        <JsonViewer
          instanceId={`console:${entryId}:arg:${index}`}
          value={value}
          searchText={searchText}
          searchFocusKey={searchFocusKey}
          recordKey={`arg[${index}]`}
        />
      </div>
    );
  }

  const display = value === undefined ? 'undefined' : value === null ? 'null' : String(value);
  return (
    <div className="console-arg-block grid gap-1">
      <div className="text-[10px] font-bold uppercase tracking-[0.04em] text-ink-weak">arg[{index}]</div>
      <pre className="m-0 overflow-auto whitespace-pre-wrap rounded-[10px] border border-line-weak bg-surface-sub px-[11px] py-[9px] text-[11px] leading-[1.45] text-ink [word-break:break-word] [font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]">
        {hasSearch ? highlightSearchText(display, searchText, searchOptions) : display}
      </pre>
    </div>
  );
}

/** 행에서 펼쳐 보여줄 JSON 인자들. 인자가 없으면 메시지 본문이 통째로 JSON인지 본다. */
function getJsonArgs(entry: ConsoleEntry): { index: number; value: unknown }[] {
  const fromArgs = entry.args
    .map((value, index) => ({ index, value }))
    .filter(({ value }) => shouldRenderArgInJsonViewer(value));

  if (fromArgs.length > 0) return fromArgs;
  if (entry.args.length === 0 && shouldRenderArgInJsonViewer(entry.text)) {
    return [{ index: 0, value: entry.text }];
  }
  return [];
}

/**
 * 행을 펼쳤을 때 메시지 아래로 이어지는 JSON 트리.
 * 상세 패널과 달리 툴바·테두리 없이 본문만 이어 붙여, 행의 텍스트가 그대로
 * 펼쳐진 것처럼 보이게 한다. 행 클릭(선택)과 키 입력은 여기서 막는다.
 */
function ConsoleRowJson({ entry, searchText }: { entry: ConsoleEntry; searchText: string }) {
  const jsonArgs = getJsonArgs(entry);
  if (jsonArgs.length === 0) return null;

  return (
    <div
      className="grid gap-1 pb-1 pl-[34px]"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      role="presentation"
    >
      {jsonArgs.map(({ index, value }) => (
        <JsonTree key={index} value={value} searchText={searchText} className="px-0 py-0" />
      ))}
    </div>
  );
}

function shouldRenderArgInJsonViewer(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'object') return true;
  if (typeof value !== 'string') return false;

  const trimmed = value.trim();
  return (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))
  );
}

function groupRepeatedEntries(entries: ConsoleEntry[]): ConsoleEntry[] {
  const grouped: ConsoleEntry[] = [];

  for (const entry of entries) {
    const previous = grouped[grouped.length - 1];
    if (
      previous &&
      previous.level === entry.level &&
      previous.text === entry.text &&
      previous.source === entry.source &&
      !previous.stack &&
      !entry.stack
    ) {
      previous.repeatCount = (previous.repeatCount ?? 1) + 1;
      continue;
    }

    grouped.push({ ...entry, repeatCount: 1 });
  }

  return grouped;
}
