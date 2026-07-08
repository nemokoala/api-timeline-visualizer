import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
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
import { JsonViewer } from '../shared/JsonViewer';
import { SplitPanelResizer } from '../shared/SplitPanelResizer';
import { formatDateTime } from '../../utils/formatters';
import { ColumnMenu } from '../shared/ColumnMenu';
import { DataTable } from '../shared/DataTable';
import { getTablePrefs, saveTablePrefs, type TablePrefs } from '../../utils/tablePrefs';
import type { ColumnDef, ColumnSizingState, OnChangeFn } from '@tanstack/react-table';
import { Button } from '../ui/Button';
import { PillTabs } from '../ui/PillTabs';
import { ToggleControl } from '../ui/ToggleControl';

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
  const consoleWorkspaceRef = useRef<HTMLDivElement>(null);
  const logListRef = useRef<HTMLDivElement | null>(null);

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
          <span className={`console-level-badge is-${row.original.level}`}>{row.original.level}</span>
        ),
      },
      {
        id: 'timestamp',
        header: 'Time',
        size: 96,
        minSize: 72,
        cell: ({ row }) => (
          <span className="console-log-timestamp">{formatDateTime(row.original.timestamp)}</span>
        ),
      },
      {
        id: 'message',
        header: 'Message',
        enableResizing: false,
        meta: { flex: true, minWidth: 160 },
        cell: ({ row }) => {
          const preview = formatConsoleMessagePreview(row.original.text);
          return (
            <span className="console-log-message" title={row.original.text}>
              {searchText.trim() ? highlightSearchText(preview, searchText, searchOptions) : preview}
            </span>
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
            <span className="console-repeat-badge">{row.original.repeatCount}</span>
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
            <span className="console-log-source" title={source}>
              {searchText.trim() ? highlightSearchText(source, searchText, searchOptions) : source}
            </span>
          );
        },
      },
    ],
    [searchOptions, searchText],
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
        const rowMarks = row?.querySelectorAll('.search-highlight');
        rowMarks?.forEach((mark, index) => {
          mark.classList.toggle('is-active', index === activeSearchOccurrence.occurrenceIndex);
        });
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeSearchOccurrence, hasDetail, searchMatchIndex]);

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
    <section className="console-panel">
      <div className="console-toolbar">
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
        className={`console-workspace ${hasDetail ? 'has-detail' : ''} ${hasDetail && isSplitStacked ? 'split-layout-stacked' : ''}`}
        style={hasDetail ? splitLayoutStyle : undefined}
      >
        <DataTable
          ariaLabel="Console logs"
          className={`console-log-list ${wrapLines ? 'wrap-lines' : ''}`}
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
          rowClassName={(entry) => `is-${entry.level}`}
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
    <aside className="console-detail-panel" ref={panelRef}>
      <div className="detail-title-bar">
        <div>
          <span className="detail-kicker detail-kicker-caps">{entry.level}</span>
          <h2 title={entry.text}>{entry.text}</h2>
        </div>
        <div className="detail-panel-title-actions">
          <span className="console-detail-timestamp">{formatDateTime(entry.timestamp)}</span>
          <SplitLayoutToggleButton isStacked={isStacked} onClick={onToggleLayout} />
          <DetailPanelCloseButton onClick={onClose} label="Close log detail" />
        </div>
      </div>

      <DetailSection
        sectionId={`${entry.id}:summary`}
        title="Summary"
        defaultOpen
        expandForSearch={summaryMatchesSearch}
        searchExpandToken={searchFocusKey}
      >
        <dl className="definition-list console-detail-meta">
          <div>
            <dt>Level</dt>
            <dd>{hasSearch ? highlightSearchText(entry.level, searchText, searchOptions) : entry.level}</dd>
          </div>
          {entry.args.length === 0 ? (
            <div>
              <dt>Message</dt>
              <dd>{hasSearch ? highlightSearchText(entry.text, searchText, searchOptions) : entry.text}</dd>
            </div>
          ) : null}
          {entry.source ? (
            <div>
              <dt>Source</dt>
              <dd>{hasSearch ? highlightSearchText(entry.source, searchText, searchOptions) : entry.source}</dd>
            </div>
          ) : null}
          {entry.repeatCount && entry.repeatCount > 1 ? (
            <div>
              <dt>Repeated</dt>
              <dd>{entry.repeatCount} times</dd>
            </div>
          ) : null}
        </dl>
      </DetailSection>

      <DetailSection
        sectionId={`${entry.id}:args`}
        title={`Arguments (${entry.args.length})`}
        defaultOpen
        expandForSearch={argsMatchesSearch}
        searchExpandToken={searchFocusKey}
      >
        <div className="console-arg-stack">
          {entry.args.length === 0 ? (
            <p className="console-arg-empty">No arguments.</p>
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
          expandForSearch={stackMatchesSearch}
          searchExpandToken={searchFocusKey}
        >
          <pre className="console-stack-trace">
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
      <div className="console-arg-block">
        <div className="console-arg-label">arg[{index}]</div>
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
    <div className="console-arg-block">
      <div className="console-arg-label">arg[{index}]</div>
      <pre className="console-arg-primitive">
        {hasSearch ? highlightSearchText(display, searchText, searchOptions) : display}
      </pre>
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
