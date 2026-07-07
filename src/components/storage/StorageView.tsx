import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type {
  IndexedDbDatabaseSnapshot,
  IndexedDbRecord,
  IndexedDbStoreSnapshot,
  PageStorageSnapshot,
  StorageEntry,
} from "../../types/storage";
import { useSplitPanelLayout } from "../../hooks/useSplitPanelLayout";
import {
  canInspectPageStorage,
  deleteIndexedDbRecord,
  inspectPageStorage,
  removeWebStorageItem,
  setWebStorageItem,
} from "../../utils/storageInspector";
import { getMockStorageSnapshot, shouldUseMockData } from "../../mocks/mockData";
import { formatStorageValuePreview } from "../../utils/storageBlobValue";
import { matchesIncludeExcludeFilters } from "../../utils/textFilters";
import { scrollSearchHitIntoView } from "../../utils/searchScroll";
import { useSearchOptions } from "../../contexts/SearchOptionsContext";
import {
  highlightSearchText,
  textMatchesSearch,
  type SearchOptions,
} from "../../utils/searchHighlight";
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
} from "../../utils/storageSearch";
import { ColumnMenu } from "../shared/ColumnMenu";
import { DataTable } from "../shared/DataTable";
import { getTablePrefs, saveTablePrefs, type TablePrefs } from "../../utils/tablePrefs";
import type { ColumnDef, ColumnSizingState, OnChangeFn } from "@tanstack/react-table";
import {
  DetailPanelCloseButton,
  SplitLayoutToggleButton,
} from "../shared/DetailPanelCloseButton";
import { DetailSection } from "../shared/DetailSection";
import { JsonViewer } from "../shared/JsonViewer";
import { SplitPanelResizer } from "../shared/SplitPanelResizer";
import { formatDateTime, formatLocaleDateTime } from "../../utils/formatters";
import { Button, IconButton } from "../ui/Button";

type StorageViewProps = {
  searchText: string;
  searchMatchIndex: number;
  includeText: string;
  excludeText: string;
  onSearchOccurrencesChange: (occurrences: StorageSearchOccurrence[]) => void;
  onSearchMatchIndexChange: (index: number) => void;
};

type StorageTab = "local" | "session" | "indexeddb";

type WebStorageColumnId = "key" | "value" | "size";
type IndexedDbColumnId = "key" | "value";
type WebStorageColumnVisibility = Record<WebStorageColumnId, boolean>;
type IndexedDbColumnVisibility = Record<IndexedDbColumnId, boolean>;

const WEB_STORAGE_COLUMNS: Array<{ id: WebStorageColumnId; label: string }> = [
  { id: "key", label: "Key" },
  { id: "value", label: "Value" },
  { id: "size", label: "Size" },
];

const INDEXED_DB_RECORD_COLUMNS: Array<{
  id: IndexedDbColumnId;
  label: string;
}> = [
  { id: "key", label: "Key" },
  { id: "value", label: "Value" },
];

const WEB_PREFS_KEY = "storage-web-table-prefs";
const IDB_PREFS_KEY = "storage-idb-table-prefs";

const WEB_DEFAULT_PREFS: TablePrefs = {
  columnVisibility: { key: true, value: true, size: true },
  columnWidths: { key: 200, size: 80, actions: 44 },
};
const IDB_DEFAULT_PREFS: TablePrefs = {
  columnVisibility: { key: true, value: true },
  columnWidths: { key: 200, actions: 44 },
};

type SelectedStorageItem =
  | { kind: "local" | "session"; key: string }
  | {
      kind: "indexeddb";
      databaseName: string;
      storeName: string;
      recordIndex: number;
    };

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
  const [activeTab, setActiveTab] = useState<StorageTab>("local");
  const [selectedItem, setSelectedItem] = useState<SelectedStorageItem | null>(
    null,
  );
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
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const canEdit = canInspectPageStorage();
  const hasSearch = Boolean(searchText.trim());

  const loadSnapshot = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextSnapshot = await inspectPageStorage();
      setSnapshot(nextSnapshot);
      setSelectedItem(null);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to inspect page storage.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canInspectPageStorage()) {
      // 로컬 개발: DevTools가 없으면 목업 스냅샷으로 채운다.
      if (shouldUseMockData()) setSnapshot(getMockStorageSnapshot());
      return;
    }
    void loadSnapshot();
    // Load once when the storage workspace first mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const localEntries = useMemo(
    () =>
      filterEntries(
        snapshot?.localStorage ?? [],
        searchText,
        includeText,
        excludeText,
        searchOptions,
      ),
    [excludeText, includeText, searchOptions, searchText, snapshot],
  );
  const sessionEntries = useMemo(
    () =>
      filterEntries(
        snapshot?.sessionStorage ?? [],
        searchText,
        includeText,
        excludeText,
        searchOptions,
      ),
    [excludeText, includeText, searchOptions, searchText, snapshot],
  );
  const indexedDatabases = useMemo(
    () =>
      filterIndexedDB(
        snapshot?.indexedDB ?? [],
        searchText,
        includeText,
        excludeText,
        searchOptions,
      ),
    [excludeText, includeText, searchOptions, searchText, snapshot],
  );

  const searchTargets = useMemo(
    () =>
      buildStorageSearchTargets(localEntries, sessionEntries, indexedDatabases),
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
  }, [
    hasSearch,
    indexedDatabases,
    localEntries,
    searchOptions,
    searchTargets,
    searchText,
    sessionEntries,
  ]);

  const activeSearchOccurrence = searchOccurrences[searchMatchIndex] ?? null;
  const searchFocusKey = `${searchMatchIndex}:${activeSearchOccurrence ? storageTargetKey(activeSearchOccurrence.target) : ""}`;

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
  }, [
    hasSearch,
    onSearchMatchIndexChange,
    searchMatchIndex,
    searchOccurrences,
  ]);

  const selectedDetail = useMemo(
    () =>
      resolveSelectedDetail(
        selectedItem,
        localEntries,
        sessionEntries,
        indexedDatabases,
      ),
    [indexedDatabases, localEntries, selectedItem, sessionEntries],
  );
  const hasDetail = Boolean(selectedDetail);

  useEffect(() => {
    if (!activeSearchOccurrence) return;

    const frameId = window.requestAnimationFrame(() => {
      const rowId = `storage-row-${storageTargetKey(activeSearchOccurrence.target)}`;
      const row = document.querySelector<HTMLElement>(
        `.storage-panel [data-row-id="${CSS.escape(rowId)}"]`,
      );

      document
        .querySelectorAll(".storage-panel .search-highlight.is-active")
        .forEach((mark) => mark.classList.remove("is-active"));

      if (!hasDetail) {
        if (row) scrollSearchHitIntoView(row);

        const rowMarks = row?.querySelectorAll(".search-highlight");
        rowMarks?.forEach((mark, index) => {
          mark.classList.toggle(
            "is-active",
            index === activeSearchOccurrence.occurrenceIndex,
          );
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
    // 같은 행을 다시 누르면 세부 패널을 닫는다(토글).
    if (
      selectedItem &&
      storageTargetKey(selectedItemToStorageTarget(item)) ===
        storageTargetKey(selectedItemToStorageTarget(selectedItem))
    ) {
      setSelectedItem(null);
      return;
    }

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

  const runMutation = async (
    mutation: () => Promise<void>,
  ): Promise<boolean> => {
    setMutationError(null);
    setIsMutating(true);
    try {
      await mutation();
      await loadSnapshot();
      return true;
    } catch (mutationFailure) {
      const message =
        mutationFailure instanceof Error
          ? mutationFailure.message
          : "Storage operation failed.";
      setMutationError(message);
      return false;
    } finally {
      setIsMutating(false);
    }
  };

  const handleSaveWebEntry = (
    kind: "local" | "session",
    key: string,
    value: string,
  ) => runMutation(() => setWebStorageItem(kind, key, value));

  const handleDeleteWebEntry = (kind: "local" | "session", key: string) => {
    const label = kind === "local" ? "localStorage" : "sessionStorage";
    if (!window.confirm(`Delete "${key}" from ${label}?`)) return;
    void runMutation(() => removeWebStorageItem(kind, key));
  };

  const handleDeleteIdbRecord = (
    databaseName: string,
    storeName: string,
    recordKey: string,
  ) => {
    if (
      !window.confirm(`Delete this record from ${databaseName} / ${storeName}?`)
    )
      return;
    void runMutation(() =>
      deleteIndexedDbRecord(databaseName, storeName, recordKey),
    );
  };

  return (
    <section className="storage-panel">
      <div className="storage-header">
        <span className="storage-header-label">Storage</span>
        <span
          className="storage-header-origin"
          title={
            snapshot
              ? snapshot.origin
              : "Inspect the active page storage for this DevTools target."
          }
        >
          {snapshot
            ? snapshot.origin
            : "Inspect the active page storage for this DevTools target."}
        </span>
        {snapshot ? (
          <span
            className="storage-header-captured"
            title={formatLocaleDateTime(Date.parse(snapshot.capturedAt))}
          >
            {formatDateTime(Date.parse(snapshot.capturedAt))}
          </span>
        ) : null}
        <Button
          size="sm"
          className="storage-refresh-button"
          onClick={() => void loadSnapshot()}
          disabled={isLoading}
        >
          {isLoading ? "Refreshing" : "Refresh"}
        </Button>
      </div>

      <div
        className="storage-tabs pill-tabs"
        role="tablist"
        aria-label="Storage type"
      >
        <StorageTabButton
          active={activeTab === "local"}
          label="localStorage"
          count={localEntries.length}
          onClick={() => {
            setActiveTab("local");
            setSelectedItem(null);
          }}
        />
        <StorageTabButton
          active={activeTab === "session"}
          label="sessionStorage"
          count={sessionEntries.length}
          onClick={() => {
            setActiveTab("session");
            setSelectedItem(null);
          }}
        />
        <StorageTabButton
          active={activeTab === "indexeddb"}
          label="IndexedDB"
          count={indexedDatabases.length}
          onClick={() => {
            setActiveTab("indexeddb");
            setSelectedItem(null);
          }}
        />
      </div>

      {error ? <div className="storage-message is-error">{error}</div> : null}
      {mutationError ? (
        <div className="storage-message is-error">{mutationError}</div>
      ) : null}
      {snapshot?.errors.length ? (
        <div className="storage-message">{snapshot.errors.join(" ")}</div>
      ) : null}

      <div
        ref={storageWorkspaceRef}
        className={`storage-workspace ${hasDetail ? "has-detail" : ""} ${hasDetail && isSplitStacked ? "split-layout-stacked" : ""}`}
        style={hasDetail ? splitLayoutStyle : undefined}
      >
        {activeTab === "indexeddb" ? (
          <IndexedDbPane
            databases={indexedDatabases}
            selectedItem={selectedItem}
            searchText={searchText}
            activeSearchTarget={activeSearchOccurrence?.target ?? null}
            onSelectRecord={handleSelectItem}
            isLoading={isLoading}
            canEdit={canEdit}
            isMutating={isMutating}
            onDeleteRecord={handleDeleteIdbRecord}
          />
        ) : (
          <WebStoragePane
            kind={activeTab}
            entries={activeTab === "local" ? localEntries : sessionEntries}
            selectedItem={selectedItem}
            searchText={searchText}
            onSelectEntry={(key) => handleSelectItem({ kind: activeTab, key })}
            isLoading={isLoading}
            canEdit={canEdit}
            isMutating={isMutating}
            onDeleteEntry={(key) => handleDeleteWebEntry(activeTab, key)}
            onAddEntry={(key, value) =>
              handleSaveWebEntry(activeTab, key, value)
            }
          />
        )}

        {hasDetail ? (
          <>
            <SplitPanelResizer
              orientation={isSplitStacked ? "horizontal" : "vertical"}
              ariaLabel="Resize storage detail panel"
              onMouseDown={
                isSplitStacked ? startHeightResize : startWidthResize
              }
              onDoubleClick={
                isSplitStacked ? resetSplitHeight : resetSplitWidth
              }
            />
            <StorageDetailPanel
              detail={selectedDetail}
              searchText={searchText}
              searchOccurrenceIndex={
                activeSearchOccurrence?.occurrenceIndex ?? 0
              }
              searchFocusKey={searchFocusKey}
              isStacked={isSplitStacked}
              canEdit={canEdit}
              isMutating={isMutating}
              onSaveValue={(value) =>
                selectedDetail?.editTarget
                  ? handleSaveWebEntry(
                      selectedDetail.editTarget.kind,
                      selectedDetail.editTarget.key,
                      value,
                    )
                  : Promise.resolve(false)
              }
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
    <button
      className={active ? "active" : ""}
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
    >
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
  canEdit,
  isMutating,
  onDeleteEntry,
  onAddEntry,
}: {
  kind: "local" | "session";
  entries: StorageEntry[];
  selectedItem: SelectedStorageItem | null;
  searchText: string;
  onSelectEntry: (key: string) => void;
  isLoading: boolean;
  canEdit: boolean;
  isMutating: boolean;
  onDeleteEntry: (key: string) => void;
  onAddEntry: (key: string, value: string) => Promise<boolean>;
}) {
  const searchOptions = useSearchOptions();
  const [tablePrefs, setTablePrefs] = useState<TablePrefs>(() =>
    getTablePrefs(WEB_PREFS_KEY, WEB_DEFAULT_PREFS),
  );
  const [columnMenu, setColumnMenu] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const persistTablePrefs = (next: TablePrefs) => {
    setTablePrefs(next);
    saveTablePrefs(WEB_PREFS_KEY, next);
  };

  const handleColumnToggle = (col: WebStorageColumnId) => {
    persistTablePrefs({
      ...tablePrefs,
      columnVisibility: {
        ...tablePrefs.columnVisibility,
        [col]: !tablePrefs.columnVisibility[col],
      },
    });
  };

  const handleColumnSizingChange: OnChangeFn<ColumnSizingState> = (updater) => {
    const next = typeof updater === "function" ? updater(tablePrefs.columnWidths) : updater;
    persistTablePrefs({ ...tablePrefs, columnWidths: next });
  };

  const handleColumnContextMenu = (event: ReactMouseEvent) => {
    event.preventDefault();
    setColumnMenu({ x: event.clientX, y: event.clientY });
  };

  const handleAdd = async () => {
    if (!newKey || isMutating) return;
    const ok = await onAddEntry(newKey, newValue);
    if (ok) {
      setNewKey("");
      setNewValue("");
      setAdding(false);
    }
  };

  const columns = useMemo<ColumnDef<StorageEntry, unknown>[]>(() => {
    const cols: ColumnDef<StorageEntry, unknown>[] = [
      {
        id: "key",
        header: "Key",
        size: 200,
        minSize: 80,
        cell: ({ row }) =>
          searchText.trim()
            ? highlightSearchText(row.original.key, searchText, searchOptions)
            : row.original.key,
      },
      {
        id: "value",
        header: "Value",
        enableResizing: false,
        meta: { flex: true, minWidth: 160 },
        cell: ({ row }) =>
          searchText.trim()
            ? highlightSearchText(row.original.value, searchText, searchOptions)
            : row.original.value,
      },
      {
        id: "size",
        header: "Size",
        size: 80,
        minSize: 56,
        cell: ({ row }) => formatBytes(row.original.size),
      },
    ];
    if (canEdit) {
      cols.push({
        id: "actions",
        header: "",
        size: 44,
        minSize: 44,
        enableResizing: false,
        meta: { cellClassName: "storage-actions-cell" },
        cell: ({ row }) => (
          <RowDeleteButton
            label={`Delete ${row.original.key}`}
            disabled={isMutating}
            onDelete={() => onDeleteEntry(row.original.key)}
          />
        ),
      });
    }
    return cols;
  }, [canEdit, isMutating, onDeleteEntry, searchOptions, searchText]);

  return (
    <>
      <div className="storage-table-wrap">
        {canEdit ? (
          <div className="storage-add">
            {adding ? (
              <div className="storage-add-form">
                <input
                  className="input input-md storage-add-input"
                  placeholder="Key"
                  value={newKey}
                  onChange={(event) => setNewKey(event.currentTarget.value)}
                  autoFocus
                />
                <input
                  className="input input-md storage-add-input"
                  placeholder="Value"
                  value={newValue}
                  onChange={(event) => setNewValue(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleAdd();
                    if (event.key === "Escape") setAdding(false);
                  }}
                />
                <Button
                  onClick={() => void handleAdd()}
                  disabled={!newKey || isMutating}
                >
                  Add
                </Button>
                <Button onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => setAdding(true)}>
                + Add entry
              </Button>
            )}
          </div>
        ) : null}
        <DataTable
          ariaLabel={`${kind}Storage entries`}
          columns={columns}
          data={entries}
          getRowId={(entry) => `storage-row-${storageTargetKey({ kind, key: entry.key })}`}
          columnSizing={tablePrefs.columnWidths}
          onColumnSizingChange={handleColumnSizingChange}
          columnVisibility={tablePrefs.columnVisibility}
          selectedRowId={
            selectedItem?.kind === kind
              ? `storage-row-${storageTargetKey({ kind, key: selectedItem.key })}`
              : null
          }
          onRowClick={(entry) => onSelectEntry(entry.key)}
          onHeaderContextMenu={handleColumnContextMenu}
          emptyState={isLoading ? "Loading…" : "No matching storage entries."}
        />
      </div>
      {columnMenu ? (
        <ColumnMenu
          columns={WEB_STORAGE_COLUMNS}
          visibility={tablePrefs.columnVisibility as WebStorageColumnVisibility}
          position={columnMenu}
          onToggle={handleColumnToggle}
          onClose={() => setColumnMenu(null)}
        />
      ) : null}
    </>
  );
}

function RowDeleteButton({
  label,
  disabled,
  onDelete,
}: {
  label: string;
  disabled: boolean;
  onDelete: () => void;
}) {
  return (
    <IconButton
      ghost
      tone="danger"
      className="storage-row-delete"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onDelete();
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    </IconButton>
  );
}

function IndexedDbPane({
  databases,
  selectedItem,
  searchText,
  activeSearchTarget,
  onSelectRecord,
  isLoading,
  canEdit,
  isMutating,
  onDeleteRecord,
}: {
  databases: IndexedDbDatabaseSnapshot[];
  selectedItem: SelectedStorageItem | null;
  searchText: string;
  activeSearchTarget: StorageSearchTarget | null;
  onSelectRecord: (record: SelectedStorageItem) => void;
  isLoading: boolean;
  canEdit: boolean;
  isMutating: boolean;
  onDeleteRecord: (
    databaseName: string,
    storeName: string,
    recordKey: string,
  ) => void;
}) {
  const searchOptions = useSearchOptions();
  const hasSearch = Boolean(searchText.trim());
  const [tablePrefs, setTablePrefs] = useState<TablePrefs>(() =>
    getTablePrefs(IDB_PREFS_KEY, IDB_DEFAULT_PREFS),
  );
  const [columnMenu, setColumnMenu] = useState<{ x: number; y: number } | null>(
    null,
  );

  const persistTablePrefs = (next: TablePrefs) => {
    setTablePrefs(next);
    saveTablePrefs(IDB_PREFS_KEY, next);
  };

  const handleColumnToggle = (col: IndexedDbColumnId) => {
    persistTablePrefs({
      ...tablePrefs,
      columnVisibility: {
        ...tablePrefs.columnVisibility,
        [col]: !tablePrefs.columnVisibility[col],
      },
    });
  };

  const handleColumnSizingChange: OnChangeFn<ColumnSizingState> = (updater) => {
    const next = typeof updater === "function" ? updater(tablePrefs.columnWidths) : updater;
    persistTablePrefs({ ...tablePrefs, columnWidths: next });
  };

  const handleColumnContextMenu = (event: ReactMouseEvent) => {
    event.preventDefault();
    setColumnMenu({ x: event.clientX, y: event.clientY });
  };

  if (!databases.length && !isLoading) {
    return (
      <div className="storage-empty">No matching IndexedDB databases.</div>
    );
  }

  return (
    <>
      <div className="indexeddb-tree">
        {databases.map((database) => (
          <section className="indexeddb-database" key={database.name}>
            <h3>
              {hasSearch
                ? highlightSearchText(database.name, searchText, searchOptions)
                : database.name}
              {database.version ? <span>v{database.version}</span> : null}
            </h3>
            {database.error ? (
              <p className="storage-inline-error">{database.error}</p>
            ) : null}
            {database.stores.map((store) => (
              <IndexedDbStore
                key={`${database.name}:${store.name}`}
                databaseName={database.name}
                store={store}
                selectedItem={selectedItem}
                searchText={searchText}
                activeSearchTarget={activeSearchTarget}
                columnVisibility={tablePrefs.columnVisibility}
                columnSizing={tablePrefs.columnWidths}
                onColumnSizingChange={handleColumnSizingChange}
                onSelectRecord={onSelectRecord}
                onColumnContextMenu={handleColumnContextMenu}
                canEdit={canEdit}
                isMutating={isMutating}
                onDeleteRecord={onDeleteRecord}
              />
            ))}
          </section>
        ))}
      </div>
      {columnMenu ? (
        <ColumnMenu
          columns={INDEXED_DB_RECORD_COLUMNS}
          visibility={tablePrefs.columnVisibility as IndexedDbColumnVisibility}
          position={columnMenu}
          onToggle={handleColumnToggle}
          onClose={() => setColumnMenu(null)}
        />
      ) : null}
    </>
  );
}

function IndexedDbStore({
  databaseName,
  store,
  selectedItem,
  searchText,
  activeSearchTarget,
  columnVisibility,
  columnSizing,
  onColumnSizingChange,
  onSelectRecord,
  onColumnContextMenu,
  canEdit,
  isMutating,
  onDeleteRecord,
}: {
  databaseName: string;
  store: IndexedDbStoreSnapshot;
  selectedItem: SelectedStorageItem | null;
  searchText: string;
  activeSearchTarget: StorageSearchTarget | null;
  columnVisibility: Record<string, boolean>;
  columnSizing: ColumnSizingState;
  onColumnSizingChange: OnChangeFn<ColumnSizingState>;
  onSelectRecord: (record: SelectedStorageItem) => void;
  onColumnContextMenu: (event: ReactMouseEvent) => void;
  canEdit: boolean;
  isMutating: boolean;
  onDeleteRecord: (
    databaseName: string,
    storeName: string,
    recordKey: string,
  ) => void;
}) {
  const searchOptions = useSearchOptions();
  const hasSearch = Boolean(searchText.trim());
  const columns = useMemo<ColumnDef<{ record: IndexedDbRecord; index: number }, unknown>[]>(() => {
    const cols: ColumnDef<{ record: IndexedDbRecord; index: number }, unknown>[] = [
      {
        id: "key",
        header: "Key",
        size: 200,
        minSize: 80,
        cell: ({ row }) =>
          searchText.trim()
            ? highlightSearchText(row.original.record.key, searchText, searchOptions)
            : row.original.record.key,
      },
      {
        id: "value",
        header: "Value",
        enableResizing: false,
        meta: { flex: true, minWidth: 160 },
        cell: ({ row }) => {
          const preview = formatStorageValuePreview(row.original.record.value, formatBytes);
          return searchText.trim()
            ? highlightSearchText(preview, searchText, searchOptions)
            : preview;
        },
      },
    ];
    if (canEdit) {
      cols.push({
        id: "actions",
        header: "",
        size: 44,
        minSize: 44,
        enableResizing: false,
        meta: { cellClassName: "storage-actions-cell" },
        cell: ({ row }) => (
          <RowDeleteButton
            label="Delete record"
            disabled={isMutating}
            onDelete={() => onDeleteRecord(databaseName, store.name, row.original.record.key)}
          />
        ),
      });
    }
    return cols;
  }, [canEdit, databaseName, isMutating, onDeleteRecord, searchOptions, searchText, store.name]);
  const containsActiveTarget =
    activeSearchTarget?.kind === "indexeddb" &&
    activeSearchTarget.databaseName === databaseName &&
    activeSearchTarget.storeName === store.name;
  const storeHaystack = store.records
    .map((record) => `${record.key} ${record.value}`)
    .join(" ");
  const matchesSearch =
    hasSearch &&
    (textMatchesSearch(
      `${databaseName} ${store.name}`,
      searchText,
      searchOptions,
    ) ||
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
        <span>
          {hasSearch
            ? highlightSearchText(store.name, searchText, searchOptions)
            : store.name}
        </span>
        <span>{store.count ?? store.records.length} rows</span>
      </summary>
      {store.error ? (
        <p className="storage-inline-error">{store.error}</p>
      ) : null}
      {store.truncated ? (
        <p className="storage-note">
          Showing the first {store.records.length} records.
        </p>
      ) : null}
      <DataTable
        className="indexeddb-record-table"
        ariaLabel={`${store.name} records`}
        columns={columns}
        data={store.records.map((record, index) => ({ record, index }))}
        getRowId={(row) =>
          `storage-row-${storageTargetKey({
            kind: "indexeddb",
            databaseName,
            storeName: store.name,
            recordIndex: row.index,
          })}`
        }
        columnSizing={columnSizing}
        onColumnSizingChange={onColumnSizingChange}
        columnVisibility={columnVisibility}
        selectedRowId={
          selectedItem?.kind === "indexeddb" &&
          selectedItem.databaseName === databaseName &&
          selectedItem.storeName === store.name
            ? `storage-row-${storageTargetKey({
                kind: "indexeddb",
                databaseName,
                storeName: store.name,
                recordIndex: selectedItem.recordIndex,
              })}`
            : null
        }
        onRowClick={(row) =>
          onSelectRecord({
            kind: "indexeddb",
            databaseName,
            storeName: store.name,
            recordIndex: row.index,
          })
        }
        onHeaderContextMenu={onColumnContextMenu}
        emptyState="No records."
      />
    </details>
  );
}

type StorageDetail = {
  title: string;
  subtitle: string;
  metaRows: Array<[string, string]>;
  value: unknown;
  instanceId: string;
  /** 값 편집이 가능한 웹 스토리지 항목이면 대상 정보. IndexedDB는 없음. */
  editTarget?: { kind: "local" | "session"; key: string };
  blobPreviewRequest?: {
    databaseName: string;
    storeName: string;
    recordIndex: number;
  };
} | null;

function StorageDetailPanel({
  detail,
  searchText,
  searchOccurrenceIndex,
  searchFocusKey,
  isStacked,
  canEdit,
  isMutating,
  onSaveValue,
  onToggleLayout,
  onClose,
}: {
  detail: StorageDetail;
  searchText: string;
  searchOccurrenceIndex: number;
  searchFocusKey: string;
  isStacked: boolean;
  canEdit: boolean;
  isMutating: boolean;
  onSaveValue: (value: string) => Promise<boolean>;
  onToggleLayout: () => void;
  onClose: () => void;
}) {
  const searchOptions = useSearchOptions();
  const panelRef = useRef<HTMLElement>(null);
  const hasSearch = Boolean(searchText.trim());
  const editTarget = detail?.editTarget ?? null;
  const editable = canEdit && Boolean(editTarget);
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState("");

  // 선택 항목이 바뀌면 편집 모드를 닫는다.
  useEffect(() => {
    setIsEditing(false);
  }, [detail?.instanceId]);

  const startEditing = () => {
    setDraftValue(
      typeof detail?.value === "string"
        ? detail.value
        : String(detail?.value ?? ""),
    );
    setIsEditing(true);
  };

  const saveEditing = async () => {
    const ok = await onSaveValue(draftValue);
    if (ok) setIsEditing(false);
  };

  useEffect(() => {
    if (!hasSearch || !detail) return;

    const frameId = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;

      document
        .querySelectorAll(".storage-panel .search-highlight.is-active")
        .forEach((mark) => mark.classList.remove("is-active"));

      const marks = panel.querySelectorAll(".search-highlight");
      marks.forEach((mark, index) => {
        mark.classList.toggle("is-active", index === searchOccurrenceIndex);
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
      detail.metaRows.some(([, value]) =>
        textMatchesSearch(value, searchText, searchOptions),
      ));

  return (
    <aside className="storage-detail-panel" ref={panelRef}>
      <div className="detail-title-bar">
        <div>
          <span className="detail-kicker">{detail.subtitle}</span>
          <h2 title={detail.title}>
            {hasSearch
              ? highlightSearchText(detail.title, searchText, searchOptions)
              : detail.title}
          </h2>
        </div>
        <div className="detail-panel-title-actions">
          {editable && !isEditing ? (
            <Button size="sm" onClick={startEditing}>
              Edit
            </Button>
          ) : null}
          <SplitLayoutToggleButton
            isStacked={isStacked}
            onClick={onToggleLayout}
          />
          <DetailPanelCloseButton
            onClick={onClose}
            label="Close storage detail"
          />
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
              <dd>
                {hasSearch
                  ? highlightSearchText(value, searchText, searchOptions)
                  : value}
              </dd>
            </div>
          ))}
        </dl>
      </DetailSection>
      <div className="storage-detail-value">
        {isEditing ? (
          <div className="storage-edit">
            <textarea
              className="input storage-edit-textarea"
              value={draftValue}
              onChange={(event) => setDraftValue(event.currentTarget.value)}
              spellCheck={false}
              autoFocus
            />
            <div className="storage-edit-actions">
              <Button onClick={() => void saveEditing()} disabled={isMutating}>
                Save
              </Button>
              <Button onClick={() => setIsEditing(false)} disabled={isMutating}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <JsonViewer
            instanceId={detail.instanceId}
            value={detail.value}
            searchText={searchText}
            searchFocusKey={searchFocusKey}
            recordKey={detail.title}
            blobPreviewRequest={detail.blobPreviewRequest}
          />
        )}
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

  if (selectedItem.kind === "local" || selectedItem.kind === "session") {
    const entries =
      selectedItem.kind === "local" ? localEntries : sessionEntries;
    const entry = entries.find((item) => item.key === selectedItem.key);
    if (!entry) return null;

    return {
      title: entry.key,
      subtitle:
        selectedItem.kind === "local" ? "localStorage" : "sessionStorage",
      metaRows: [
        ["Key", entry.key],
        ["Size", formatBytes(entry.size)],
      ],
      value: entry.value,
      instanceId: `${selectedItem.kind}:${entry.key}`,
      editTarget: { kind: selectedItem.kind, key: entry.key },
    };
  }

  if (selectedItem.kind !== "indexeddb") return null;

  const database = indexedDatabases.find(
    (item) => item.name === selectedItem.databaseName,
  );
  const store = database?.stores.find(
    (item) => item.name === selectedItem.storeName,
  );
  const record = store?.records[selectedItem.recordIndex];
  if (!database || !store || !record) return null;

  return {
    title: record.key,
    subtitle: `${database.name} / ${store.name}`,
    metaRows: [
      ["Database", database.name],
      ["Store", store.name],
      ["Record", String(selectedItem.recordIndex + 1)],
      ["Key path", store.keyPath ?? "none"],
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
    if (
      !matchesStorageFilters(
        haystack,
        includeText,
        excludeText,
        searchText,
        searchOptions,
      )
    )
      return false;
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
    .filter((database) =>
      matchesIncludeExcludeFilters(database.name, includeText, excludeText),
    )
    .map((database) => {
      const stores = database.stores
        .filter((store) =>
          matchesIncludeExcludeFilters(
            `${database.name} ${store.name}`,
            includeText,
            excludeText,
          ),
        )
        .map((store) => ({
          ...store,
          records: filterIndexedDbRecords(
            database,
            store,
            searchText,
            includeText,
            excludeText,
            searchOptions,
          ),
        }))
        .filter((store) => {
          if (store.records.length > 0) return true;
          if (!searchText.trim() && !includeText.trim()) return true;
          return textMatchesSearch(
            `${database.name} ${store.name}`,
            searchText,
            searchOptions,
          );
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
    return matchesStorageFilters(
      haystack,
      includeText,
      excludeText,
      searchText,
      searchOptions,
    );
  });
}

function matchesStorageFilters(
  haystack: string,
  includeText: string,
  excludeText: string,
  searchText: string,
  searchOptions: SearchOptions,
): boolean {
  if (!matchesIncludeExcludeFilters(haystack, includeText, excludeText))
    return false;
  if (!searchText.trim()) return true;
  return textMatchesSearch(haystack, searchText, searchOptions);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
