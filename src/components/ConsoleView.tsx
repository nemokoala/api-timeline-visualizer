import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { ConsoleEntry, ConsoleLevelFilter } from '../types/console';
import { useSplitPanelLayout } from '../hooks/useSplitPanelLayout';
import { clearInspectedConsoleBuffer } from '../utils/consoleInspector';
import { scrollSearchHitIntoView } from '../utils/searchScroll';
import { useSearchOptions } from '../contexts/SearchOptionsContext';
import { highlightSearchText, textMatchesSearch } from '../utils/searchHighlight';
import { matchesIncludeExcludeFilters } from '../utils/textFilters';
import {
  buildConsoleSearchOccurrences,
  consoleArgsMatchSearch,
  getSearchMatchIndexForConsoleEntry,
  type ConsoleSearchOccurrence,
} from '../utils/consoleSearch';
import { formatConsoleMessagePreview } from '../utils/consoleMessagePreview';
import { DetailPanelCloseButton, SplitLayoutToggleButton } from './DetailPanelCloseButton';
import { DetailSection } from './DetailSection';
import { JsonViewer } from './JsonViewer';
import { SplitPanelResizer } from './SplitPanelResizer';
import { formatDateTime } from './formatters';
import { ColumnMenu } from './ColumnMenu';
import { Button } from './ui/Button';

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
type ColumnVisibility = Record<ConsoleColumnId, boolean>;

const CONSOLE_COLUMNS: Array<{ id: ConsoleColumnId; label: string }> = [
  { id: 'level', label: 'Level' },
  { id: 'timestamp', label: 'Timestamp' },
  { id: 'source', label: 'Source' },
];

const COLUMNS_STORAGE_KEY = 'console-column-visibility';
const WRAP_LINES_STORAGE_KEY = 'console-wrap-lines';
const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = { level: true, timestamp: true, source: true };

function loadColumnVisibility(): ColumnVisibility {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMN_VISIBILITY;
    const parsed = JSON.parse(raw) as Partial<ColumnVisibility>;
    return { ...DEFAULT_COLUMN_VISIBILITY, ...parsed };
  } catch {
    return DEFAULT_COLUMN_VISIBILITY;
  }
}

function loadWrapLines(): boolean {
  try {
    return localStorage.getItem(WRAP_LINES_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function buildGridStyle(vis: ColumnVisibility): { gridTemplateColumns: string } {
  const tracks: string[] = [];
  if (vis.level) tracks.push('56px');
  if (vis.timestamp) tracks.push('88px');
  tracks.push('minmax(0, 1fr)');
  tracks.push('auto');
  if (vis.source) tracks.push('auto');
  return { gridTemplateColumns: tracks.join(' ') };
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
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(loadColumnVisibility);
  const [columnMenu, setColumnMenu] = useState<{ x: number; y: number } | null>(null);
  const consoleWorkspaceRef = useRef<HTMLDivElement>(null);
  const logListRef = useRef<HTMLDivElement>(null);

  const gridStyle = buildGridStyle(columnVisibility);

  const handleColumnToggle = (col: ConsoleColumnId) => {
    setColumnVisibility((prev) => {
      const next = { ...prev, [col]: !prev[col] };
      localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

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
      const row = document.getElementById(`console-log-${activeSearchOccurrence.entryId}`);

      // Always scroll the list to the active hit, even while a detail panel is
      // open — otherwise navigating hits leaves the list (and the detail panel,
      // which stays on the clicked entry) frozen in place.
      if (row) scrollSearchHitIntoView(row);

      document
        .querySelectorAll('.console-log-list .search-highlight.is-active')
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
        <div className="console-toolbar-filters pill-tabs" role="tablist" aria-label="Console level filter">
          {LEVEL_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              role="tab"
              aria-selected={levelFilter === filter.value}
              className={levelFilter === filter.value ? 'active' : ''}
              onClick={() => setLevelFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="console-toolbar-actions">
          <label className="toggle-control">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(event) => setAutoScroll(event.currentTarget.checked)}
            />
            <span>Auto-scroll</span>
          </label>
          <label className="toggle-control">
            <input
              type="checkbox"
              checked={wrapLines}
              onChange={(event) => {
                const next = event.currentTarget.checked;
                setWrapLines(next);
                localStorage.setItem(WRAP_LINES_STORAGE_KEY, String(next));
              }}
            />
            <span>Wrap lines</span>
          </label>
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
        <div className={`console-log-list ${wrapLines ? 'wrap-lines' : ''}`} ref={logListRef}>
          <div
            className="console-log-header"
            style={gridStyle}
            onContextMenu={handleColumnContextMenu}
            title="우클릭: 열 표시 설정"
          >
            {columnVisibility.level && <span className="console-log-header-cell">Level</span>}
            {columnVisibility.timestamp && <span className="console-log-header-cell">Timestamp</span>}
            <span className="console-log-header-cell">Message</span>
            <span />
            {columnVisibility.source && <span className="console-log-header-cell">Source</span>}
          </div>
          {!displayEntries.length ? (
            <div className="console-empty">No console output yet. Logs appear after the panel opens.</div>
          ) : (
            displayEntries.map((entry) => (
              <ConsoleLogRow
                key={entry.id}
                entry={entry}
                selected={selectedEntryId === entry.id}
                searchText={searchText}
                columnVisibility={columnVisibility}
                gridStyle={gridStyle}
                onSelect={() => handleSelectEntry(entry.id)}
              />
            ))
          )}
        </div>

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
          visibility={columnVisibility}
          position={columnMenu}
          minVisible={0}
          onToggle={handleColumnToggle}
          onClose={() => setColumnMenu(null)}
        />
      ) : null}
    </section>
  );
}

function ConsoleLogRow({
  entry,
  selected,
  searchText,
  columnVisibility,
  gridStyle,
  onSelect,
}: {
  entry: ConsoleEntry;
  selected: boolean;
  searchText: string;
  columnVisibility: ColumnVisibility;
  gridStyle: { gridTemplateColumns: string };
  onSelect: () => void;
}) {
  const searchOptions = useSearchOptions();
  const hasSearch = Boolean(searchText.trim());
  const levelClass = `is-${entry.level}`;
  const displayText = formatConsoleMessagePreview(entry.text);

  return (
    <button
      id={`console-log-${entry.id}`}
      type="button"
      className={`console-log-row ${levelClass} ${selected ? 'selected' : ''}`}
      style={gridStyle}
      onClick={onSelect}
    >
      {columnVisibility.level && (
        <span className={`console-level-badge ${levelClass}`}>{entry.level}</span>
      )}
      {columnVisibility.timestamp && (
        <span className="console-log-timestamp">{formatDateTime(entry.timestamp)}</span>
      )}
      <span className="console-log-message" title={entry.text}>
        {hasSearch ? highlightSearchText(displayText, searchText, searchOptions) : displayText}
      </span>
      <span>
        {entry.repeatCount && entry.repeatCount > 1 ? (
          <span className="console-repeat-badge">{entry.repeatCount}</span>
        ) : null}
      </span>
      {columnVisibility.source && (
        <span className="console-log-source" title={entry.source ?? ''}>
          {entry.source
            ? hasSearch
              ? highlightSearchText(entry.source, searchText, searchOptions)
              : entry.source
            : null}
        </span>
      )}
    </button>
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
