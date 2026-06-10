import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  IndexedDbDatabaseSnapshot,
  IndexedDbRecord,
  IndexedDbStoreSnapshot,
  PageStorageSnapshot,
  StorageEntry,
} from '../types/storage';
import { useSplitPanelLayout } from '../hooks/useSplitPanelLayout';
import { canInspectPageStorage, inspectPageStorage } from '../utils/storageInspector';
import { formatStorageValuePreview } from '../utils/storageBlobValue';
import { matchesIncludeExcludeFilters } from '../utils/textFilters';
import { scrollSearchHitIntoView } from '../utils/searchScroll';
import { useSearchOptions } from '../contexts/SearchOptionsContext';
import { highlightSearchText, textMatchesSearch, type SearchOptions } from '../utils/searchHighlight';
import {
  buildStorageSearchOccurrences,
  buildStorageSearchTargets,
  getSearchMatchIndexForStorageTarget,
  selectedItemToStorageTarget,
  storageTargetKey,
  storageTargetTab,
  storageTargetToSelectedItem,
  type StorageSearchOccurrence,
  type StorageSearchTarget,
} from '../utils/storageSearch';
import { DetailPanelCloseButton, SplitLayoutToggleButton } from './DetailPanelCloseButton';
import { DetailSection } from './DetailSection';
import { JsonViewer } from './JsonViewer';
import { SplitPanelResizer } from './SplitPanelResizer';
import { formatDateTime, formatLocaleDateTime } from './formatters';

type StorageViewProps = {
  searchText: string;
  searchMatchIndex: number;
  includeText: string;
  excludeText: string;
  onSearchOccurrencesChange: (occurrences: StorageSearchOccurrence[]) => void;
  onSearchMatchIndexChange: (index: number) => void;
};

type StorageTab = 'local' | 'session' | 'indexeddb';

type SelectedStorageItem =
  | { kind: 'local' | 'session'; key: string }
  | { kind: 'indexeddb'; databaseName: string; storeName: string; recordIndex: number };

export function StorageView({
  searchText,
  searchMatchIndex,
  includeText,
  excludeText,
  onSearchOccurrencesChange,
  onSearchMatchIndexChange,
}: StorageViewProps) {
  const searchOptions = useSearchOptions();
  const [snapshot, setSnapshot] = useState<PageStorageSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<StorageTab>('local');
  const [selectedItem, setSelectedItem] = useState<SelectedStorageItem | null>(null);
  const storageWorkspaceRef = useRef<HTMLDivElement>(null);
  const {
    isStacked: isSplitStacked,
    layoutStyle: splitLayoutStyle,
    startWidthResize,
    startHeightResize,
    resetWidth: resetSplitWidth,
    resetHeight: resetSplitHeight,
    toggleSplitLayout,
  } = useSplitPanelLayout(storageWorkspaceRef);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasSearch = Boolean(searchText.trim());

  const loadSnapshot = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextSnapshot = await inspectPageStorage();
      setSnapshot(nextSnapshot);
      setSelectedItem(null);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to inspect page storage.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canInspectPageStorage()) return;
    void loadSnapshot();
    // Load once when the storage workspace first mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const localEntries = useMemo(
    () => filterEntries(snapshot?.localStorage ?? [], searchText, includeText, excludeText, searchOptions),
    [excludeText, includeText, searchOptions, searchText, snapshot],
  );
  const sessionEntries = useMemo(
    () => filterEntries(snapshot?.sessionStorage ?? [], searchText, includeText, excludeText, searchOptions),
    [excludeText, includeText, searchOptions, searchText, snapshot],
  );
  const indexedDatabases = useMemo(
    () => filterIndexedDB(snapshot?.indexedDB ?? [], searchText, includeText, excludeText, searchOptions),
    [excludeText, includeText, searchOptions, searchText, snapshot],
  );

  const searchTargets = useMemo(
    () => buildStorageSearchTargets(localEntries, sessionEntries, indexedDatabases),
    [indexedDatabases, localEntries, sessionEntries],
  );

  const searchOccurrences = useMemo(() => {
    if (!hasSearch) return [];
    return buildStorageSearchOccurrences(
      searchTargets,
      localEntries,
      sessionEntries,
      indexedDatabases,
      searchText,
      searchOptions,
    );
  }, [hasSearch, indexedDatabases, localEntries, searchOptions, searchTargets, searchText, sessionEntries]);

  const activeSearchOccurrence = searchOccurrences[searchMatchIndex] ?? null;
  const searchFocusKey = `${searchMatchIndex}:${activeSearchOccurrence ? storageTargetKey(activeSearchOccurrence.target) : ''}`;

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

    const occurrence = searchOccurrences[clampedIndex];
    if (!occurrence) return;

    setActiveTab(storageTargetTab(occurrence.target));
    setSelectedItem(storageTargetToSelectedItem(occurrence.target));
  }, [hasSearch, onSearchMatchIndexChange, searchMatchIndex, searchOccurrences]);

  const selectedDetail = useMemo(
    () => resolveSelectedDetail(selectedItem, localEntries, sessionEntries, indexedDatabases),
    [indexedDatabases, localEntries, selectedItem, sessionEntries],
  );
  const hasDetail = Boolean(selectedDetail);

  useEffect(() => {
    if (!activeSearchOccurrence) return;

    const frameId = window.requestAnimationFrame(() => {
      const row = document.getElementById(
        `storage-row-${storageTargetKey(activeSearchOccurrence.target)}`,
      );

      document
        .querySelectorAll('.storage-table .search-highlight.is-active')
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

  useEffect(() => {
    if (!selectedItem) return;
    if (selectedDetail) return;
    setSelectedItem(null);
  }, [selectedDetail, selectedItem]);

  const handleSelectItem = (item: SelectedStorageItem) => {
    if (hasSearch) {
      const matchIndex = getSearchMatchIndexForStorageTarget(
        searchOccurrences,
        selectedItemToStorageTarget(item),
      );
      if (matchIndex !== null) {
        onSearchMatchIndexChange(matchIndex);
      }
    }

    setSelectedItem(item);
  };

  return (
    <section className="storage-panel">
      <div className="storage-header">
        <span className="storage-header-label">Storage</span>
        <span
          className="storage-header-origin"
          title={snapshot ? snapshot.origin : 'Inspect the active page storage for this DevTools target.'}
        >
          {snapshot ? snapshot.origin : 'Inspect the active page storage for this DevTools target.'}
        </span>
        {snapshot ? (
          <span
            className="storage-header-captured"
            title={formatLocaleDateTime(Date.parse(snapshot.capturedAt))}
          >
            {formatDateTime(Date.parse(snapshot.capturedAt))}
          </span>
        ) : null}
        <button
          className="toolbar-button storage-refresh-button"
          type="button"
          onClick={() => void loadSnapshot()}
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      <div className="storage-tabs" role="tablist" aria-label="Storage type">
        <StorageTabButton
          active={activeTab === 'local'}
          label="localStorage"
          count={localEntries.length}
          onClick={() => {
            setActiveTab('local');
            setSelectedItem(null);
          }}
        />
        <StorageTabButton
          active={activeTab === 'session'}
          label="sessionStorage"
          count={sessionEntries.length}
          onClick={() => {
            setActiveTab('session');
            setSelectedItem(null);
          }}
        />
        <StorageTabButton
          active={activeTab === 'indexeddb'}
          label="IndexedDB"
          count={indexedDatabases.length}
          onClick={() => {
            setActiveTab('indexeddb');
            setSelectedItem(null);
          }}
        />
      </div>

      {error ? <div className="storage-message is-error">{error}</div> : null}
      {snapshot?.errors.length ? (
        <div className="storage-message">{snapshot.errors.join(' ')}</div>
      ) : null}

      <div
        ref={storageWorkspaceRef}
        className={`storage-workspace ${hasDetail ? 'has-detail' : ''} ${hasDetail && isSplitStacked ? 'split-layout-stacked' : ''}`}
        style={hasDetail ? splitLayoutStyle : undefined}
      >
        {activeTab === 'indexeddb' ? (
          <IndexedDbPane
            databases={indexedDatabases}
            selectedItem={selectedItem}
            searchText={searchText}
            activeSearchTarget={activeSearchOccurrence?.target ?? null}
            onSelectRecord={handleSelectItem}
            isLoading={isLoading}
          />
        ) : (
          <WebStoragePane
            kind={activeTab}
            entries={activeTab === 'local' ? localEntries : sessionEntries}
            selectedItem={selectedItem}
            searchText={searchText}
            onSelectEntry={(key) => handleSelectItem({ kind: activeTab, key })}
            isLoading={isLoading}
          />
        )}

        {hasDetail ? (
          <>
            <SplitPanelResizer
              orientation={isSplitStacked ? 'horizontal' : 'vertical'}
              ariaLabel="Resize storage detail panel"
              onMouseDown={isSplitStacked ? startHeightResize : startWidthResize}
              onDoubleClick={isSplitStacked ? resetSplitHeight : resetSplitWidth}
            />
            <StorageDetailPanel
              detail={selectedDetail}
              searchText={searchText}
              searchOccurrenceIndex={activeSearchOccurrence?.occurrenceIndex ?? 0}
              searchFocusKey={searchFocusKey}
              isStacked={isSplitStacked}
              onToggleLayout={toggleSplitLayout}
              onClose={() => setSelectedItem(null)}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}

function StorageTabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button className={active ? 'active' : ''} type="button" role="tab" aria-selected={active} onClick={onClick}>
      <span>{label}</span>
      <span className="storage-tab-count">{count}</span>
    </button>
  );
}

function WebStoragePane({
  kind,
  entries,
  selectedItem,
  searchText,
  onSelectEntry,
  isLoading,
}: {
  kind: 'local' | 'session';
  entries: StorageEntry[];
  selectedItem: SelectedStorageItem | null;
  searchText: string;
  onSelectEntry: (key: string) => void;
  isLoading: boolean;
}) {
  const searchOptions = useSearchOptions();
  const hasSearch = Boolean(searchText.trim());

  if (!entries.length && !isLoading) {
    return <div className="storage-empty">No matching storage entries.</div>;
  }

  return (
    <div className="storage-table-wrap">
      <table className="storage-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.key}
              id={`storage-row-${storageTargetKey({ kind, key: entry.key })}`}
              className={selectedItem?.kind === kind && selectedItem.key === entry.key ? 'selected' : ''}
              onClick={() => onSelectEntry(entry.key)}
            >
              <td>{hasSearch ? highlightSearchText(entry.key, searchText, searchOptions) : entry.key}</td>
              <td>{hasSearch ? highlightSearchText(entry.value, searchText, searchOptions) : entry.value}</td>
              <td>{formatBytes(entry.size)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IndexedDbPane({
  databases,
  selectedItem,
  searchText,
  activeSearchTarget,
  onSelectRecord,
  isLoading,
}: {
  databases: IndexedDbDatabaseSnapshot[];
  selectedItem: SelectedStorageItem | null;
  searchText: string;
  activeSearchTarget: StorageSearchTarget | null;
  onSelectRecord: (record: SelectedStorageItem) => void;
  isLoading: boolean;
}) {
  const searchOptions = useSearchOptions();
  const hasSearch = Boolean(searchText.trim());

  if (!databases.length && !isLoading) {
    return <div className="storage-empty">No matching IndexedDB databases.</div>;
  }

  return (
    <div className="indexeddb-tree">
      {databases.map((database) => (
        <section className="indexeddb-database" key={database.name}>
          <h3>
            {hasSearch ? highlightSearchText(database.name, searchText, searchOptions) : database.name}
            {database.version ? <span>v{database.version}</span> : null}
          </h3>
          {database.error ? <p className="storage-inline-error">{database.error}</p> : null}
          {database.stores.map((store) => (
            <IndexedDbStore
              key={`${database.name}:${store.name}`}
              databaseName={database.name}
              store={store}
              selectedItem={selectedItem}
              searchText={searchText}
              activeSearchTarget={activeSearchTarget}
              onSelectRecord={onSelectRecord}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function IndexedDbStore({
  databaseName,
  store,
  selectedItem,
  searchText,
  activeSearchTarget,
  onSelectRecord,
}: {
  databaseName: string;
  store: IndexedDbStoreSnapshot;
  selectedItem: SelectedStorageItem | null;
  searchText: string;
  activeSearchTarget: StorageSearchTarget | null;
  onSelectRecord: (record: SelectedStorageItem) => void;
}) {
  const searchOptions = useSearchOptions();
  const hasSearch = Boolean(searchText.trim());
  const containsActiveTarget =
    activeSearchTarget?.kind === 'indexeddb' &&
    activeSearchTarget.databaseName === databaseName &&
    activeSearchTarget.storeName === store.name;
  const storeHaystack = store.records.map((record) => `${record.key} ${record.value}`).join(' ');
  const matchesSearch =
    hasSearch &&
    (textMatchesSearch(`${databaseName} ${store.name}`, searchText, searchOptions) ||
      textMatchesSearch(storeHaystack, searchText, searchOptions));
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (containsActiveTarget || matchesSearch) {
      setOpen(true);
    }
  }, [containsActiveTarget, matchesSearch, activeSearchTarget]);

  return (
    <details
      className="indexeddb-store"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>{hasSearch ? highlightSearchText(store.name, searchText, searchOptions) : store.name}</span>
        <span>{store.count ?? store.records.length} rows</span>
      </summary>
      {store.error ? <p className="storage-inline-error">{store.error}</p> : null}
      {store.truncated ? (
        <p className="storage-note">Showing the first {store.records.length} records.</p>
      ) : null}
      <table className="storage-table indexeddb-record-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {store.records.map((record, index) => {
            const isSelected =
              selectedItem?.kind === 'indexeddb' &&
              selectedItem.databaseName === databaseName &&
              selectedItem.storeName === store.name &&
              selectedItem.recordIndex === index;
            const target = {
              kind: 'indexeddb' as const,
              databaseName,
              storeName: store.name,
              recordIndex: index,
            };
            const preview = formatStorageValuePreview(record.value, formatBytes);

            return (
              <tr
                key={`${record.key}:${index}`}
                id={`storage-row-${storageTargetKey(target)}`}
                className={isSelected ? 'selected' : ''}
                onClick={() => onSelectRecord(target)}
              >
                <td>{hasSearch ? highlightSearchText(record.key, searchText, searchOptions) : record.key}</td>
                <td>{hasSearch ? highlightSearchText(preview, searchText, searchOptions) : preview}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </details>
  );
}

type StorageDetail =
  | {
      title: string;
      subtitle: string;
      metaRows: Array<[string, string]>;
      value: unknown;
      instanceId: string;
      blobPreviewRequest?: {
        databaseName: string;
        storeName: string;
        recordIndex: number;
      };
    }
  | null;

function StorageDetailPanel({
  detail,
  searchText,
  searchOccurrenceIndex,
  searchFocusKey,
  isStacked,
  onToggleLayout,
  onClose,
}: {
  detail: StorageDetail;
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
    if (!hasSearch || !detail) return;

    const frameId = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;

      document
        .querySelectorAll('.storage-table .search-highlight.is-active')
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
  }, [detail, hasSearch, searchFocusKey, searchOccurrenceIndex, searchText]);

  if (!detail) return null;

  const metaMatchesSearch =
    hasSearch &&
    (textMatchesSearch(detail.title, searchText, searchOptions) ||
      detail.metaRows.some(([, value]) => textMatchesSearch(value, searchText, searchOptions)));

  return (
    <aside className="storage-detail-panel" ref={panelRef}>
      <div className="storage-detail-title">
        <div>
          <span className="storage-detail-kicker">{detail.subtitle}</span>
          <h2 title={detail.title}>
            {hasSearch ? highlightSearchText(detail.title, searchText, searchOptions) : detail.title}
          </h2>
        </div>
        <div className="detail-panel-title-actions">
          <SplitLayoutToggleButton isStacked={isStacked} onClick={onToggleLayout} />
          <DetailPanelCloseButton onClick={onClose} label="Close storage detail" />
        </div>
      </div>
      <DetailSection
        sectionId={`${detail.instanceId}:meta`}
        title="Details"
        defaultOpen={false}
        expandForSearch={metaMatchesSearch}
        searchExpandToken={searchFocusKey}
      >
        <dl className="definition-list storage-detail-meta">
          {detail.metaRows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{hasSearch ? highlightSearchText(value, searchText, searchOptions) : value}</dd>
            </div>
          ))}
        </dl>
      </DetailSection>
      <div className="storage-detail-value">
        <JsonViewer
          instanceId={detail.instanceId}
          value={detail.value}
          searchText={searchText}
          searchFocusKey={searchFocusKey}
          recordKey={detail.title}
          blobPreviewRequest={detail.blobPreviewRequest}
        />
      </div>
    </aside>
  );
}

function resolveSelectedDetail(
  selectedItem: SelectedStorageItem | null,
  localEntries: StorageEntry[],
  sessionEntries: StorageEntry[],
  indexedDatabases: IndexedDbDatabaseSnapshot[],
): StorageDetail {
  if (!selectedItem) return null;

  if (selectedItem.kind === 'local' || selectedItem.kind === 'session') {
    const entries = selectedItem.kind === 'local' ? localEntries : sessionEntries;
    const entry = entries.find((item) => item.key === selectedItem.key);
    if (!entry) return null;

    return {
      title: entry.key,
      subtitle: selectedItem.kind === 'local' ? 'localStorage' : 'sessionStorage',
      metaRows: [
        ['Key', entry.key],
        ['Size', formatBytes(entry.size)],
      ],
      value: entry.value,
      instanceId: `${selectedItem.kind}:${entry.key}`,
    };
  }

  if (selectedItem.kind !== 'indexeddb') return null;

  const database = indexedDatabases.find((item) => item.name === selectedItem.databaseName);
  const store = database?.stores.find((item) => item.name === selectedItem.storeName);
  const record = store?.records[selectedItem.recordIndex];
  if (!database || !store || !record) return null;

  return {
    title: record.key,
    subtitle: `${database.name} / ${store.name}`,
    metaRows: [
      ['Database', database.name],
      ['Store', store.name],
      ['Record', String(selectedItem.recordIndex + 1)],
      ['Key path', store.keyPath ?? 'none'],
    ],
    value: record.value,
    instanceId: `indexeddb:${database.name}:${store.name}:${selectedItem.recordIndex}`,
    blobPreviewRequest: {
      databaseName: database.name,
      storeName: store.name,
      recordIndex: selectedItem.recordIndex,
    },
  };
}

function filterEntries(
  entries: StorageEntry[],
  searchText: string,
  includeText: string,
  excludeText: string,
  searchOptions: SearchOptions,
): StorageEntry[] {
  return entries.filter((entry) => {
    const haystack = `${entry.key} ${entry.value}`;
    if (!matchesStorageFilters(haystack, includeText, excludeText, searchText, searchOptions)) return false;
    return true;
  });
}

function filterIndexedDB(
  databases: IndexedDbDatabaseSnapshot[],
  searchText: string,
  includeText: string,
  excludeText: string,
  searchOptions: SearchOptions,
): IndexedDbDatabaseSnapshot[] {
  return databases
    .filter((database) => matchesIncludeExcludeFilters(database.name, includeText, excludeText))
    .map((database) => {
      const stores = database.stores
        .filter((store) =>
          matchesIncludeExcludeFilters(`${database.name} ${store.name}`, includeText, excludeText),
        )
        .map((store) => ({
          ...store,
          records: filterIndexedDbRecords(database, store, searchText, includeText, excludeText, searchOptions),
        }))
        .filter((store) => {
          if (store.records.length > 0) return true;
          if (!searchText.trim() && !includeText.trim()) return true;
          return textMatchesSearch(`${database.name} ${store.name}`, searchText, searchOptions);
        });

      return { ...database, stores };
    })
    .filter((database) => {
      if (database.stores.length > 0) return true;
      if (!searchText.trim() && !includeText.trim()) return true;
      return textMatchesSearch(database.name, searchText, searchOptions);
    });
}

function filterIndexedDbRecords(
  database: IndexedDbDatabaseSnapshot,
  store: IndexedDbStoreSnapshot,
  searchText: string,
  includeText: string,
  excludeText: string,
  searchOptions: SearchOptions,
): IndexedDbRecord[] {
  return store.records.filter((record) => {
    const haystack = `${database.name} ${store.name} ${record.key} ${record.value}`;
    return matchesStorageFilters(haystack, includeText, excludeText, searchText, searchOptions);
  });
}

function matchesStorageFilters(
  haystack: string,
  includeText: string,
  excludeText: string,
  searchText: string,
  searchOptions: SearchOptions,
): boolean {
  if (!matchesIncludeExcludeFilters(haystack, includeText, excludeText)) return false;
  if (!searchText.trim()) return true;
  return textMatchesSearch(haystack, searchText, searchOptions);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
