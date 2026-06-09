import { useEffect, useMemo, useRef, useState } from 'react';
import type { ConsoleEntry, ConsoleLevelFilter } from '../types/console';
import { useSplitPanelLayout } from '../hooks/useSplitPanelLayout';
import {
  clearInspectedConsoleBuffer,
  setConsolePreserveLog,
} from '../utils/consoleInspector';
import { scrollSearchHitIntoView } from '../utils/searchScroll';
import { highlightSearchText, textMatchesSearch } from '../utils/searchHighlight';
import {
  buildConsoleSearchOccurrences,
  consoleArgsMatchSearch,
  getSearchMatchIndexForConsoleEntry,
  matchesConsoleSearch,
  type ConsoleSearchOccurrence,
} from '../utils/consoleSearch';
import { DetailPanelCloseButton } from './DetailPanelCloseButton';
import { DetailSection } from './DetailSection';
import { JsonViewer } from './JsonViewer';
import { SplitPanelResizer } from './SplitPanelResizer';
import { formatDateTime } from './formatters';

type ConsoleViewProps = {
  entries: ConsoleEntry[];
  selectedEntryId: string | null;
  searchText: string;
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

export function ConsoleView({
  entries,
  selectedEntryId,
  searchText,
  searchMatchIndex,
  onEntriesChange,
  onSelectedEntryIdChange,
  onSearchOccurrencesChange,
  onSearchMatchIndexChange,
}: ConsoleViewProps) {
  const [levelFilter, setLevelFilter] = useState<ConsoleLevelFilter>('all');
  const [preserveLog, setPreserveLog] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const consoleWorkspaceRef = useRef<HTMLDivElement>(null);
  const logListRef = useRef<HTMLDivElement>(null);
  const {
    isStacked: isSplitStacked,
    layoutStyle: splitLayoutStyle,
    startWidthResize,
    startHeightResize,
    resetWidth: resetSplitWidth,
    resetHeight: resetSplitHeight,
  } = useSplitPanelLayout(consoleWorkspaceRef);

  const hasSearch = Boolean(searchText.trim());

  const displayEntries = useMemo(() => {
    const filtered = entries.filter((entry) => {
      if (entry.level === 'clear') return false;
      if (levelFilter !== 'all' && entry.level !== levelFilter) return false;
      if (!hasSearch) return true;
      return matchesConsoleSearch(entry, searchText);
    });

    return groupRepeatedEntries(filtered);
  }, [entries, hasSearch, levelFilter, searchText]);

  const searchOccurrences = useMemo(() => {
    if (!hasSearch) return [];
    return buildConsoleSearchOccurrences(displayEntries, searchText);
  }, [displayEntries, hasSearch, searchText]);

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
    void setConsolePreserveLog(preserveLog);
  }, [preserveLog]);

  useEffect(() => {
    if (!hasSearch || !searchOccurrences.length) return;

    const clampedIndex = searchMatchIndex % searchOccurrences.length;
    if (clampedIndex !== searchMatchIndex) {
      onSearchMatchIndexChange(clampedIndex);
      return;
    }

    const occurrence = searchOccurrences[clampedIndex];
    if (!occurrence) return;

    onSelectedEntryIdChange(occurrence.entryId);
  }, [hasSearch, onSearchMatchIndexChange, onSelectedEntryIdChange, searchMatchIndex, searchOccurrences]);

  useEffect(() => {
    if (!selectedEntryId) return;
    if (displayEntries.some((entry) => entry.id === selectedEntryId)) return;
    onSelectedEntryIdChange(null);
  }, [displayEntries, onSelectedEntryIdChange, selectedEntryId]);

  useEffect(() => {
    if (!autoScroll || !logListRef.current) return;
    logListRef.current.scrollTop = logListRef.current.scrollHeight;
  }, [autoScroll, displayEntries.length]);

  useEffect(() => {
    if (!activeSearchOccurrence) return;

    const frameId = window.requestAnimationFrame(() => {
      const row = document.getElementById(`console-log-${activeSearchOccurrence.entryId}`);

      document
        .querySelectorAll('.console-log-list .search-highlight.is-active')
        .forEach((mark) => mark.classList.remove('is-active'));

      if (!hasDetail) {
        if (row) scrollSearchHitIntoView(row);

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
        <div className="console-toolbar-filters" role="tablist" aria-label="Console level filter">
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
              checked={preserveLog}
              onChange={(event) => setPreserveLog(event.currentTarget.checked)}
            />
            <span>Preserve log</span>
          </label>
          <label className="toggle-control">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(event) => setAutoScroll(event.currentTarget.checked)}
            />
            <span>Auto-scroll</span>
          </label>
          <button className="clear-button" type="button" onClick={() => void handleClear()} disabled={!entries.length}>
            Clear
          </button>
        </div>
      </div>

      <div
        ref={consoleWorkspaceRef}
        className={`console-workspace ${hasDetail ? 'has-detail' : ''} ${hasDetail && isSplitStacked ? 'split-layout-stacked' : ''}`}
        style={hasDetail ? splitLayoutStyle : undefined}
      >
        <div className="console-log-list" ref={logListRef}>
          {!displayEntries.length ? (
            <div className="console-empty">No console output yet. Logs appear after the panel opens.</div>
          ) : (
            displayEntries.map((entry) => (
              <ConsoleLogRow
                key={entry.id}
                entry={entry}
                selected={selectedEntryId === entry.id}
                searchText={searchText}
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
              onClose={() => onSelectedEntryIdChange(null)}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}

function ConsoleLogRow({
  entry,
  selected,
  searchText,
  onSelect,
}: {
  entry: ConsoleEntry;
  selected: boolean;
  searchText: string;
  onSelect: () => void;
}) {
  const hasSearch = Boolean(searchText.trim());
  const levelClass = `is-${entry.level}`;

  return (
    <button
      id={`console-log-${entry.id}`}
      type="button"
      className={`console-log-row ${levelClass} ${selected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <span className={`console-level-badge ${levelClass}`}>{entry.level}</span>
      <span className="console-log-timestamp">{formatDateTime(entry.timestamp)}</span>
      <span className="console-log-message" title={entry.text}>
        {hasSearch ? highlightSearchText(entry.text, searchText) : entry.text}
      </span>
      {entry.repeatCount && entry.repeatCount > 1 ? (
        <span className="console-repeat-badge">{entry.repeatCount}</span>
      ) : null}
      {entry.source ? (
        <span className="console-log-source" title={entry.source}>
          {hasSearch ? highlightSearchText(entry.source, searchText) : entry.source}
        </span>
      ) : null}
    </button>
  );
}

function ConsoleDetailPanel({
  entry,
  searchText,
  searchOccurrenceIndex,
  searchFocusKey,
  onClose,
}: {
  entry: ConsoleEntry;
  searchText: string;
  searchOccurrenceIndex: number;
  searchFocusKey: string;
  onClose: () => void;
}) {
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

  const argsMatchesSearch = hasSearch && consoleArgsMatchSearch(entry.args, searchText);
  const summaryMatchesSearch =
    hasSearch &&
    (textMatchesSearch(entry.level, searchText) ||
      (entry.source ? textMatchesSearch(entry.source, searchText) : false) ||
      (entry.args.length === 0 && textMatchesSearch(entry.text, searchText)));

  const stackMatchesSearch = hasSearch && entry.stack ? textMatchesSearch(entry.stack, searchText) : false;

  return (
    <aside className="console-detail-panel" ref={panelRef}>
      <div className="console-detail-title">
        <div>
          <span className="console-detail-kicker">{entry.level}</span>
          <h2 title={entry.text}>{entry.text}</h2>
        </div>
        <div className="detail-panel-title-actions">
          <span className="console-detail-timestamp">{formatDateTime(entry.timestamp)}</span>
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
            <dd>{hasSearch ? highlightSearchText(entry.level, searchText) : entry.level}</dd>
          </div>
          {entry.args.length === 0 ? (
            <div>
              <dt>Message</dt>
              <dd>{hasSearch ? highlightSearchText(entry.text, searchText) : entry.text}</dd>
            </div>
          ) : null}
          {entry.source ? (
            <div>
              <dt>Source</dt>
              <dd>{hasSearch ? highlightSearchText(entry.source, searchText) : entry.source}</dd>
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
            {hasSearch ? highlightSearchText(entry.stack, searchText) : entry.stack}
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
        {hasSearch ? highlightSearchText(display, searchText) : display}
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
