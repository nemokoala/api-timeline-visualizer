import { useEffect, useMemo, useState } from 'react';
import type {
  IndexedDbDatabaseSnapshot,
  IndexedDbStoreSnapshot,
  PageStorageSnapshot,
  StorageEntry,
} from '../types/storage';
import { canInspectPageStorage, inspectPageStorage } from '../utils/storageInspector';
import { textMatchesSearch } from '../utils/searchHighlight';
import { JsonViewer } from './JsonViewer';
import { formatLocaleDateTime } from './formatters';

type StorageViewProps = {
  searchText: string;
};

type StorageTab = 'local' | 'session' | 'indexeddb';

export function StorageView({ searchText }: StorageViewProps) {
  const [snapshot, setSnapshot] = useState<PageStorageSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<StorageTab>('local');
  const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(null);
  const [selectedIndexedDbRecord, setSelectedIndexedDbRecord] = useState<{
    databaseName: string;
    storeName: string;
    recordIndex: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextSnapshot = await inspectPageStorage();
      setSnapshot(nextSnapshot);
      setSelectedEntryKey(null);
      setSelectedIndexedDbRecord(null);
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
    () => filterEntries(snapshot?.localStorage ?? [], searchText),
    [searchText, snapshot],
  );
  const sessionEntries = useMemo(
    () => filterEntries(snapshot?.sessionStorage ?? [], searchText),
    [searchText, snapshot],
  );
  const indexedDatabases = useMemo(
    () => filterIndexedDB(snapshot?.indexedDB ?? [], searchText),
    [searchText, snapshot],
  );

  const activeEntries = activeTab === 'local' ? localEntries : sessionEntries;
  const selectedEntry = activeEntries.find((entry) => entry.key === selectedEntryKey) ?? activeEntries[0] ?? null;
  const selectedRecord = getSelectedRecord(indexedDatabases, selectedIndexedDbRecord);

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
          count={snapshot?.localStorage.length ?? 0}
          onClick={() => setActiveTab('local')}
        />
        <StorageTabButton
          active={activeTab === 'session'}
          label="sessionStorage"
          count={snapshot?.sessionStorage.length ?? 0}
          onClick={() => setActiveTab('session')}
        />
        <StorageTabButton
          active={activeTab === 'indexeddb'}
          label="IndexedDB"
          count={snapshot?.indexedDB.length ?? 0}
          onClick={() => setActiveTab('indexeddb')}
        />
      </div>

      {error ? <div className="storage-message is-error">{error}</div> : null}
      {snapshot?.errors.length ? (
        <div className="storage-message">{snapshot.errors.join(' ')}</div>
      ) : null}

      {activeTab === 'indexeddb' ? (
        <IndexedDbPane
          databases={indexedDatabases}
          selectedRecord={selectedIndexedDbRecord}
          onSelectRecord={setSelectedIndexedDbRecord}
          recordValue={selectedRecord?.value ?? null}
          searchText={searchText}
          isLoading={isLoading}
        />
      ) : (
        <WebStoragePane
          entries={activeEntries}
          selectedKey={selectedEntry?.key ?? null}
          onSelectKey={setSelectedEntryKey}
          selectedEntry={selectedEntry}
          searchText={searchText}
          isLoading={isLoading}
        />
      )}
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
  entries,
  selectedKey,
  selectedEntry,
  onSelectKey,
  searchText,
  isLoading,
}: {
  entries: StorageEntry[];
  selectedKey: string | null;
  selectedEntry: StorageEntry | null;
  onSelectKey: (key: string) => void;
  searchText: string;
  isLoading: boolean;
}) {
  if (!entries.length && !isLoading) {
    return <div className="storage-empty">No matching storage entries.</div>;
  }

  return (
    <div className="storage-split">
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
                className={entry.key === selectedKey ? 'selected' : ''}
                onClick={() => onSelectKey(entry.key)}
              >
                <td>{entry.key}</td>
                <td>{entry.value}</td>
                <td>{formatBytes(entry.size)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="storage-value-panel">
        <div className="storage-value-heading">
          <strong>{selectedEntry?.key ?? 'Value'}</strong>
          {selectedEntry ? <span>{formatBytes(selectedEntry.size)}</span> : null}
        </div>
        <JsonViewer
          instanceId={selectedEntry?.key}
          value={selectedEntry?.value ?? ''}
          searchText={searchText}
        />
      </div>
    </div>
  );
}

function IndexedDbPane({
  databases,
  selectedRecord,
  recordValue,
  onSelectRecord,
  searchText,
  isLoading,
}: {
  databases: IndexedDbDatabaseSnapshot[];
  selectedRecord: { databaseName: string; storeName: string; recordIndex: number } | null;
  recordValue: string | null;
  onSelectRecord: (record: { databaseName: string; storeName: string; recordIndex: number }) => void;
  searchText: string;
  isLoading: boolean;
}) {
  if (!databases.length && !isLoading) {
    return <div className="storage-empty">No matching IndexedDB databases.</div>;
  }

  return (
    <div className="storage-split">
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
                selectedRecord={selectedRecord}
                onSelectRecord={onSelectRecord}
              />
            ))}
          </section>
        ))}
      </div>
      <div className="storage-value-panel">
        <div className="storage-value-heading">
          <strong>Record value</strong>
          {selectedRecord ? (
            <span>
              {selectedRecord.databaseName} / {selectedRecord.storeName}
            </span>
          ) : null}
        </div>
        <JsonViewer
          instanceId={
            selectedRecord
              ? `${selectedRecord.databaseName}:${selectedRecord.storeName}:${selectedRecord.recordIndex}`
              : 'indexeddb-empty'
          }
          value={recordValue ?? 'Select a record to inspect its value.'}
          searchText={searchText}
        />
      </div>
    </div>
  );
}

function IndexedDbStore({
  databaseName,
  store,
  selectedRecord,
  onSelectRecord,
}: {
  databaseName: string;
  store: IndexedDbStoreSnapshot;
  selectedRecord: { databaseName: string; storeName: string; recordIndex: number } | null;
  onSelectRecord: (record: { databaseName: string; storeName: string; recordIndex: number }) => void;
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
              selectedRecord?.databaseName === databaseName &&
              selectedRecord.storeName === store.name &&
              selectedRecord.recordIndex === index;

            return (
              <tr
                key={`${record.key}:${index}`}
                className={isSelected ? 'selected' : ''}
                onClick={() => onSelectRecord({ databaseName, storeName: store.name, recordIndex: index })}
              >
                <td>{record.key}</td>
                <td>{record.value}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </details>
  );
}

function filterEntries(entries: StorageEntry[], searchText: string): StorageEntry[] {
  if (!searchText.trim()) return entries;
  return entries.filter((entry) => textMatchesSearch(`${entry.key} ${entry.value}`, searchText));
}

function filterIndexedDB(
  databases: IndexedDbDatabaseSnapshot[],
  searchText: string,
): IndexedDbDatabaseSnapshot[] {
  if (!searchText.trim()) return databases;

  return databases
    .map((database) => {
      const stores = database.stores
        .map((store) => ({
          ...store,
          records: store.records.filter((record) =>
            textMatchesSearch(`${database.name} ${store.name} ${record.key} ${record.value}`, searchText),
          ),
        }))
        .filter((store) => store.records.length > 0 || textMatchesSearch(`${database.name} ${store.name}`, searchText));

      return { ...database, stores };
    })
    .filter((database) => database.stores.length > 0 || textMatchesSearch(database.name, searchText));
}

function getSelectedRecord(
  databases: IndexedDbDatabaseSnapshot[],
  selectedRecord: { databaseName: string; storeName: string; recordIndex: number } | null,
) {
  if (!selectedRecord) return null;
  const database = databases.find((item) => item.name === selectedRecord.databaseName);
  const store = database?.stores.find((item) => item.name === selectedRecord.storeName);
  return store?.records[selectedRecord.recordIndex] ?? null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
