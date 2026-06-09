import { useEffect, useMemo, useState } from 'react';
import type {
  IndexedDbDatabaseSnapshot,
  IndexedDbRecord,
  IndexedDbStoreSnapshot,
  PageStorageSnapshot,
  StorageEntry,
} from '../types/storage';
import { canInspectPageStorage, inspectPageStorage } from '../utils/storageInspector';
import { formatStorageValuePreview } from '../utils/storageBlobValue';
import { textMatchesSearch } from '../utils/searchHighlight';
import { JsonViewer } from './JsonViewer';
import { formatLocaleDateTime } from './formatters';

type StorageViewProps = {
  searchText: string;
  excludeText: string;
};

type StorageTab = 'local' | 'session' | 'indexeddb';

type SelectedStorageItem =
  | { kind: 'local' | 'session'; key: string }
  | { kind: 'indexeddb'; databaseName: string; storeName: string; recordIndex: number };

export function StorageView({ searchText, excludeText }: StorageViewProps) {
  const [snapshot, setSnapshot] = useState<PageStorageSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<StorageTab>('local');
  const [selectedItem, setSelectedItem] = useState<SelectedStorageItem | null>(null);
  const [detailPanelWidth, setDetailPanelWidth] = useState(460);
  const [isResizingDetail, setIsResizingDetail] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!isResizingDetail) return;

    const handleMouseMove = (event: MouseEvent) => {
      const nextWidth = window.innerWidth - event.clientX;
      setDetailPanelWidth(clamp(nextWidth, 320, Math.min(820, window.innerWidth * 0.72)));
    };

    const handleMouseUp = () => {
      setIsResizingDetail(false);
    };

    document.body.classList.add('resizing-detail-panel');
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.classList.remove('resizing-detail-panel');
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingDetail]);

  const localEntries = useMemo(
    () => filterEntries(snapshot?.localStorage ?? [], searchText, excludeText),
    [excludeText, searchText, snapshot],
  );
  const sessionEntries = useMemo(
    () => filterEntries(snapshot?.sessionStorage ?? [], searchText, excludeText),
    [excludeText, searchText, snapshot],
  );
  const indexedDatabases = useMemo(
    () => filterIndexedDB(snapshot?.indexedDB ?? [], searchText, excludeText),
    [excludeText, searchText, snapshot],
  );

  const selectedDetail = useMemo(
    () => resolveSelectedDetail(selectedItem, localEntries, sessionEntries, indexedDatabases),
    [indexedDatabases, localEntries, selectedItem, sessionEntries],
  );

  useEffect(() => {
    if (!selectedItem) return;
    if (selectedDetail) return;
    setSelectedItem(null);
  }, [selectedDetail, selectedItem]);

  const hasDetail = Boolean(selectedDetail);

  return (
    <section className="storage-panel">
      <div className="storage-header">
        <div className="storage-title">
          <h2>Storage</h2>
          <p>{snapshot ? snapshot.origin : 'Inspect the active page storage for this DevTools target.'}</p>
        </div>
        <div className="storage-actions">
          {snapshot ? <span>{formatLocaleDateTime(Date.parse(snapshot.capturedAt))}</span> : null}
          <button className="toolbar-button" type="button" onClick={() => void loadSnapshot()} disabled={isLoading}>
            {isLoading ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
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
        className={`storage-workspace ${hasDetail ? 'has-detail' : ''}`}
        style={{
          gridTemplateColumns: hasDetail ? `minmax(0, 1fr) 8px minmax(320px, ${detailPanelWidth}px)` : 'minmax(0, 1fr)',
        }}
      >
        {activeTab === 'indexeddb' ? (
          <IndexedDbPane
            databases={indexedDatabases}
            selectedItem={selectedItem}
            onSelectRecord={(record) => setSelectedItem(record)}
            isLoading={isLoading}
          />
        ) : (
          <WebStoragePane
            kind={activeTab}
            entries={activeTab === 'local' ? localEntries : sessionEntries}
            selectedItem={selectedItem}
            onSelectEntry={(key) => setSelectedItem({ kind: activeTab, key })}
            isLoading={isLoading}
          />
        )}

        {hasDetail ? (
          <>
            <button
              className="detail-resizer"
              type="button"
              aria-label="Resize storage detail panel"
              onMouseDown={(event) => {
                event.preventDefault();
                setIsResizingDetail(true);
              }}
              onDoubleClick={() => setDetailPanelWidth(460)}
            />
            <StorageDetailPanel detail={selectedDetail} searchText={searchText} />
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
  onSelectEntry,
  isLoading,
}: {
  kind: 'local' | 'session';
  entries: StorageEntry[];
  selectedItem: SelectedStorageItem | null;
  onSelectEntry: (key: string) => void;
  isLoading: boolean;
}) {
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
              className={selectedItem?.kind === kind && selectedItem.key === entry.key ? 'selected' : ''}
              onClick={() => onSelectEntry(entry.key)}
            >
              <td>{entry.key}</td>
              <td>{entry.value}</td>
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
  onSelectRecord,
  isLoading,
}: {
  databases: IndexedDbDatabaseSnapshot[];
  selectedItem: SelectedStorageItem | null;
  onSelectRecord: (record: SelectedStorageItem) => void;
  isLoading: boolean;
}) {
  if (!databases.length && !isLoading) {
    return <div className="storage-empty">No matching IndexedDB databases.</div>;
  }

  return (
    <div className="indexeddb-tree">
      {databases.map((database) => (
        <section className="indexeddb-database" key={database.name}>
          <h3>
            {database.name}
            {database.version ? <span>v{database.version}</span> : null}
          </h3>
          {database.error ? <p className="storage-inline-error">{database.error}</p> : null}
          {database.stores.map((store) => (
            <IndexedDbStore
              key={`${database.name}:${store.name}`}
              databaseName={database.name}
              store={store}
              selectedItem={selectedItem}
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
  onSelectRecord,
}: {
  databaseName: string;
  store: IndexedDbStoreSnapshot;
  selectedItem: SelectedStorageItem | null;
  onSelectRecord: (record: SelectedStorageItem) => void;
}) {
  return (
    <details className="indexeddb-store" open>
      <summary>
        <span>{store.name}</span>
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

            return (
              <tr
                key={`${record.key}:${index}`}
                className={isSelected ? 'selected' : ''}
                onClick={() =>
                  onSelectRecord({
                    kind: 'indexeddb',
                    databaseName,
                    storeName: store.name,
                    recordIndex: index,
                  })
                }
              >
                <td>{record.key}</td>
                <td>{formatStorageValuePreview(record.value, formatBytes)}</td>
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

function StorageDetailPanel({ detail, searchText }: { detail: StorageDetail; searchText: string }) {
  if (!detail) return null;

  return (
    <aside className="storage-detail-panel">
      <div className="storage-detail-title">
        <div>
          <span className="storage-detail-kicker">{detail.subtitle}</span>
          <h2>{detail.title}</h2>
        </div>
      </div>
      <dl className="definition-list storage-detail-meta">
        {detail.metaRows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="storage-detail-value">
        <JsonViewer
          instanceId={detail.instanceId}
          value={detail.value}
          searchText={searchText}
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

function filterEntries(entries: StorageEntry[], searchText: string, excludeText: string): StorageEntry[] {
  return entries.filter((entry) => {
    const haystack = `${entry.key} ${entry.value}`;
    if (matchesAnyExclude(haystack, excludeText)) return false;
    if (!searchText.trim()) return true;
    return textMatchesSearch(haystack, searchText);
  });
}

function filterIndexedDB(
  databases: IndexedDbDatabaseSnapshot[],
  searchText: string,
  excludeText: string,
): IndexedDbDatabaseSnapshot[] {
  return databases
    .filter((database) => !matchesAnyExclude(database.name, excludeText))
    .map((database) => {
      const stores = database.stores
        .filter((store) => !matchesAnyExclude(`${database.name} ${store.name}`, excludeText))
        .map((store) => ({
          ...store,
          records: filterIndexedDbRecords(database, store, searchText, excludeText),
        }))
        .filter((store) => {
          if (store.records.length > 0) return true;
          if (!searchText.trim()) return true;
          return textMatchesSearch(`${database.name} ${store.name}`, searchText);
        });

      return { ...database, stores };
    })
    .filter((database) => {
      if (database.stores.length > 0) return true;
      if (!searchText.trim()) return true;
      return textMatchesSearch(database.name, searchText);
    });
}

function filterIndexedDbRecords(
  database: IndexedDbDatabaseSnapshot,
  store: IndexedDbStoreSnapshot,
  searchText: string,
  excludeText: string,
): IndexedDbRecord[] {
  return store.records.filter((record) => {
    const haystack = `${database.name} ${store.name} ${record.key} ${record.value}`;
    if (matchesAnyExclude(haystack, excludeText)) return false;
    if (!searchText.trim()) return true;
    return textMatchesSearch(haystack, searchText);
  });
}

function matchesAnyExclude(text: string, excludeText: string): boolean {
  const terms = getFilterTerms(excludeText);
  if (!terms.length) return false;
  const haystack = text.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

function getFilterTerms(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[,\s]+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
