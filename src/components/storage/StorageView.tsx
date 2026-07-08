import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type {
  CookieEntry,
  CookieSameSite,
  CookieSnapshot,
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
import {
  canInspectCookies,
  inspectCookies,
  removeCookie,
  setCookie,
  type CookieWriteInput,
} from "../../utils/cookieInspector";
import {
  getMockCookieSnapshot,
  getMockStorageSnapshot,
  shouldUseMockData,
} from "../../mocks/mockData";
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

type StorageTab = "local" | "session" | "cookies" | "indexeddb";

type WebStorageColumnId = "key" | "value" | "size";
type IndexedDbColumnId = "key" | "value";
type CookieColumnId =
  | "name"
  | "value"
  | "domain"
  | "path"
  | "expires"
  | "size"
  | "sameSite"
  | "httpOnly"
  | "secure";
type WebStorageColumnVisibility = Record<WebStorageColumnId, boolean>;
type IndexedDbColumnVisibility = Record<IndexedDbColumnId, boolean>;
type CookieColumnVisibility = Record<CookieColumnId, boolean>;

const WEB_STORAGE_COLUMNS: Array<{ id: WebStorageColumnId; label: string }> = [
  { id: "key", label: "Key" },
  { id: "value", label: "Value" },
  { id: "size", label: "Size" },
];

const COOKIE_COLUMNS: Array<{ id: CookieColumnId; label: string }> = [
  { id: "name", label: "Name" },
  { id: "value", label: "Value" },
  { id: "domain", label: "Domain" },
  { id: "path", label: "Path" },
  { id: "expires", label: "Expires" },
  { id: "size", label: "Size" },
  { id: "sameSite", label: "SameSite" },
  { id: "httpOnly", label: "HttpOnly" },
  { id: "secure", label: "Secure" },
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
const COOKIE_PREFS_KEY = "storage-cookie-table-prefs";

const WEB_DEFAULT_PREFS: TablePrefs = {
  columnVisibility: { key: true, value: true, size: true },
  columnWidths: { key: 200, size: 80, actions: 44 },
};
const IDB_DEFAULT_PREFS: TablePrefs = {
  columnVisibility: { key: true, value: true },
  columnWidths: { key: 200, actions: 44 },
};
const COOKIE_DEFAULT_PREFS: TablePrefs = {
  columnVisibility: {
    name: true,
    value: true,
    domain: true,
    path: true,
    expires: true,
    size: true,
    sameSite: false,
    httpOnly: false,
    secure: false,
  },
  columnWidths: {
    name: 160,
    domain: 160,
    path: 100,
    expires: 160,
    size: 64,
    sameSite: 90,
    httpOnly: 80,
    secure: 70,
    actions: 44,
  },
};

type SelectedStorageItem =
  | { kind: "local" | "session"; key: string }
  | { kind: "cookie"; name: string; domain: string; path: string }
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
  const [cookieSnapshot, setCookieSnapshot] = useState<CookieSnapshot | null>(
    null,
  );
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
  const canEditCookies = canInspectCookies();
  const hasSearch = Boolean(searchText.trim());

  const loadSnapshot = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [nextSnapshot] = await Promise.all([
        inspectPageStorage(),
        loadCookieSnapshot(),
      ]);
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

  // 쿠키는 별도 파이프라인(백그라운드 워커)이라 스토리지 스냅샷과 독립적으로 읽는다.
  const loadCookieSnapshot = async () => {
    if (!canInspectCookies()) return;
    try {
      setCookieSnapshot(await inspectCookies());
    } catch (cookieError) {
      const message =
        cookieError instanceof Error
          ? cookieError.message
          : "Failed to read cookies.";
      setCookieSnapshot({
        url: "",
        capturedAt: new Date().toISOString(),
        cookies: [],
        errors: [message],
      });
    }
  };

  useEffect(() => {
    if (!canInspectPageStorage()) {
      // 로컬 개발: DevTools가 없으면 목업 스냅샷으로 채운다.
      if (shouldUseMockData()) {
        setSnapshot(getMockStorageSnapshot());
        setCookieSnapshot(getMockCookieSnapshot());
      }
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
  const cookieEntries = useMemo(
    () =>
      filterCookies(
        cookieSnapshot?.cookies ?? [],
        searchText,
        includeText,
        excludeText,
        searchOptions,
      ),
    [cookieSnapshot, excludeText, includeText, searchOptions, searchText],
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
      buildStorageSearchTargets(
        localEntries,
        sessionEntries,
        cookieEntries,
        indexedDatabases,
      ),
    [cookieEntries, indexedDatabases, localEntries, sessionEntries],
  );

  const searchOccurrences = useMemo(() => {
    if (!hasSearch) return [];
    return buildStorageSearchOccurrences(
      searchTargets,
      localEntries,
      sessionEntries,
      cookieEntries,
      indexedDatabases,
      searchText,
      searchOptions,
    );
  }, [
    cookieEntries,
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
        cookieEntries,
        indexedDatabases,
      ),
    [cookieEntries, indexedDatabases, localEntries, selectedItem, sessionEntries],
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

  const handleSaveCookie = (cookie: CookieWriteInput) =>
    runMutation(() => setCookie(cookie));

  const handleDeleteCookie = (cookie: CookieEntry) => {
    if (!window.confirm(`Delete cookie "${cookie.name}" from ${cookie.domain}?`))
      return;
    void runMutation(() =>
      removeCookie({
        name: cookie.name,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
      }),
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
          active={activeTab === "cookies"}
          label="Cookies"
          count={cookieEntries.length}
          onClick={() => {
            setActiveTab("cookies");
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
      {activeTab === "cookies" && cookieSnapshot?.errors.length ? (
        <div className="storage-message is-error">
          {cookieSnapshot.errors.join(" ")}
        </div>
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
        ) : activeTab === "cookies" ? (
          <CookiePane
            entries={cookieEntries}
            selectedItem={selectedItem}
            searchText={searchText}
            defaultDomain={cookieSnapshot?.url ?? snapshot?.origin ?? ""}
            onSelectCookie={(cookie) =>
              handleSelectItem({
                kind: "cookie",
                name: cookie.name,
                domain: cookie.domain,
                path: cookie.path,
              })
            }
            isLoading={isLoading}
            canEdit={canEditCookies}
            isMutating={isMutating}
            onDeleteCookie={handleDeleteCookie}
            onAddCookie={handleSaveCookie}
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
              canEdit={selectedDetail?.cookie ? canEditCookies : canEdit}
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
              onSaveCookie={handleSaveCookie}
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

function CookiePane({
  entries,
  selectedItem,
  searchText,
  defaultDomain,
  onSelectCookie,
  isLoading,
  canEdit,
  isMutating,
  onDeleteCookie,
  onAddCookie,
}: {
  entries: CookieEntry[];
  selectedItem: SelectedStorageItem | null;
  searchText: string;
  defaultDomain: string;
  onSelectCookie: (cookie: CookieEntry) => void;
  isLoading: boolean;
  canEdit: boolean;
  isMutating: boolean;
  onDeleteCookie: (cookie: CookieEntry) => void;
  onAddCookie: (cookie: CookieWriteInput) => Promise<boolean>;
}) {
  const searchOptions = useSearchOptions();
  const [tablePrefs, setTablePrefs] = useState<TablePrefs>(() =>
    getTablePrefs(COOKIE_PREFS_KEY, COOKIE_DEFAULT_PREFS),
  );
  const [columnMenu, setColumnMenu] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [adding, setAdding] = useState(false);

  const persistTablePrefs = (next: TablePrefs) => {
    setTablePrefs(next);
    saveTablePrefs(COOKIE_PREFS_KEY, next);
  };

  const handleColumnToggle = (col: CookieColumnId) => {
    persistTablePrefs({
      ...tablePrefs,
      columnVisibility: {
        ...tablePrefs.columnVisibility,
        [col]: !tablePrefs.columnVisibility[col],
      },
    });
  };

  const handleColumnSizingChange: OnChangeFn<ColumnSizingState> = (updater) => {
    const next =
      typeof updater === "function" ? updater(tablePrefs.columnWidths) : updater;
    persistTablePrefs({ ...tablePrefs, columnWidths: next });
  };

  const handleColumnContextMenu = (event: ReactMouseEvent) => {
    event.preventDefault();
    setColumnMenu({ x: event.clientX, y: event.clientY });
  };

  const handleAdd = async (cookie: CookieWriteInput) => {
    const ok = await onAddCookie(cookie);
    if (ok) setAdding(false);
    return ok;
  };

  const columns = useMemo<ColumnDef<CookieEntry, unknown>[]>(() => {
    const highlight = (text: string) =>
      searchText.trim()
        ? highlightSearchText(text, searchText, searchOptions)
        : text;
    const cols: ColumnDef<CookieEntry, unknown>[] = [
      {
        id: "name",
        header: "Name",
        size: 160,
        minSize: 80,
        cell: ({ row }) => highlight(row.original.name),
      },
      {
        id: "value",
        header: "Value",
        enableResizing: false,
        meta: { flex: true, minWidth: 160 },
        cell: ({ row }) => highlight(row.original.value),
      },
      {
        id: "domain",
        header: "Domain",
        size: 160,
        minSize: 80,
        cell: ({ row }) => highlight(row.original.domain),
      },
      {
        id: "path",
        header: "Path",
        size: 100,
        minSize: 56,
        cell: ({ row }) => highlight(row.original.path),
      },
      {
        id: "expires",
        header: "Expires",
        size: 160,
        minSize: 80,
        cell: ({ row }) => formatCookieExpires(row.original.expires),
      },
      {
        id: "size",
        header: "Size",
        size: 64,
        minSize: 48,
        cell: ({ row }) => formatBytes(row.original.size),
      },
      {
        id: "sameSite",
        header: "SameSite",
        size: 90,
        minSize: 64,
        cell: ({ row }) => formatSameSite(row.original.sameSite),
      },
      {
        id: "httpOnly",
        header: "HttpOnly",
        size: 80,
        minSize: 60,
        meta: { cellClassName: "storage-bool-cell" },
        cell: ({ row }) => (row.original.httpOnly ? "✓" : ""),
      },
      {
        id: "secure",
        header: "Secure",
        size: 70,
        minSize: 56,
        meta: { cellClassName: "storage-bool-cell" },
        cell: ({ row }) => (row.original.secure ? "✓" : ""),
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
            label={`Delete ${row.original.name}`}
            disabled={isMutating}
            onDelete={() => onDeleteCookie(row.original)}
          />
        ),
      });
    }
    return cols;
  }, [canEdit, isMutating, onDeleteCookie, searchOptions, searchText]);

  return (
    <>
      <div className="storage-table-wrap">
        {canEdit ? (
          <div className="storage-add">
            {adding ? (
              <CookieForm
                mode="add"
                defaultDomain={defaultDomain}
                isMutating={isMutating}
                onSubmit={handleAdd}
                onCancel={() => setAdding(false)}
              />
            ) : (
              <Button size="sm" onClick={() => setAdding(true)}>
                + Add cookie
              </Button>
            )}
          </div>
        ) : null}
        <DataTable
          ariaLabel="Cookies"
          columns={columns}
          data={entries}
          getRowId={(cookie) =>
            `storage-row-${storageTargetKey({
              kind: "cookie",
              name: cookie.name,
              domain: cookie.domain,
              path: cookie.path,
            })}`
          }
          columnSizing={tablePrefs.columnWidths}
          onColumnSizingChange={handleColumnSizingChange}
          columnVisibility={tablePrefs.columnVisibility}
          selectedRowId={
            selectedItem?.kind === "cookie"
              ? `storage-row-${storageTargetKey({
                  kind: "cookie",
                  name: selectedItem.name,
                  domain: selectedItem.domain,
                  path: selectedItem.path,
                })}`
              : null
          }
          onRowClick={(cookie) => onSelectCookie(cookie)}
          onHeaderContextMenu={handleColumnContextMenu}
          emptyState={isLoading ? "Loading…" : "No matching cookies."}
        />
      </div>
      {columnMenu ? (
        <ColumnMenu
          columns={COOKIE_COLUMNS}
          visibility={tablePrefs.columnVisibility as CookieColumnVisibility}
          position={columnMenu}
          onToggle={handleColumnToggle}
          onClose={() => setColumnMenu(null)}
        />
      ) : null}
    </>
  );
}

const SAME_SITE_OPTIONS: CookieSameSite[] = [
  "lax",
  "strict",
  "none",
  "unspecified",
];

/** 쿠키 추가/편집 폼. edit 모드에서는 name/domain/path(식별자)를 잠근다. */
function CookieForm({
  mode,
  initial,
  defaultDomain,
  isMutating,
  onSubmit,
  onCancel,
}: {
  mode: "add" | "edit";
  initial?: CookieEntry;
  defaultDomain?: string;
  isMutating: boolean;
  onSubmit: (cookie: CookieWriteInput) => Promise<boolean>;
  onCancel: () => void;
}) {
  const isEdit = mode === "edit";
  const [name, setName] = useState(initial?.name ?? "");
  const [value, setValue] = useState(initial?.value ?? "");
  const [domain, setDomain] = useState(
    initial?.domain ?? hostnameFromUrl(defaultDomain ?? ""),
  );
  const [path, setPath] = useState(initial?.path ?? "/");
  const [sameSite, setSameSite] = useState<CookieSameSite>(
    initial?.sameSite ?? "lax",
  );
  const [secure, setSecure] = useState(initial?.secure ?? false);
  const [httpOnly, setHttpOnly] = useState(initial?.httpOnly ?? false);
  const [session, setSession] = useState(
    initial ? initial.expires === null : false,
  );
  const [expiresLocal, setExpiresLocal] = useState(() =>
    epochToLocalInput(initial?.expires ?? null),
  );

  const handleSubmit = async () => {
    if (!name || isMutating) return;
    const expires =
      session || !expiresLocal
        ? null
        : Math.round(new Date(expiresLocal).getTime() / 1000);
    const hostOnly = isEdit
      ? (initial?.hostOnly ?? false)
      : !domain.startsWith(".");
    await onSubmit({
      name,
      value,
      domain,
      path: path || "/",
      secure,
      httpOnly,
      sameSite,
      hostOnly,
      expires: Number.isNaN(expires as number) ? null : expires,
    });
  };

  return (
    <div className="cookie-form">
      <div className="cookie-form-grid">
        <label className="cookie-field">
          <span>Name</span>
          <input
            className="input input-md"
            value={name}
            disabled={isEdit}
            onChange={(event) => setName(event.currentTarget.value)}
            autoFocus={!isEdit}
          />
        </label>
        <label className="cookie-field cookie-field-wide">
          <span>Value</span>
          <input
            className="input input-md"
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
            autoFocus={isEdit}
          />
        </label>
        <label className="cookie-field">
          <span>Domain</span>
          <input
            className="input input-md"
            value={domain}
            disabled={isEdit}
            onChange={(event) => setDomain(event.currentTarget.value)}
          />
        </label>
        <label className="cookie-field">
          <span>Path</span>
          <input
            className="input input-md"
            value={path}
            disabled={isEdit}
            onChange={(event) => setPath(event.currentTarget.value)}
          />
        </label>
        <label className="cookie-field">
          <span>SameSite</span>
          <select
            className="input input-md"
            value={sameSite}
            onChange={(event) =>
              setSameSite(event.currentTarget.value as CookieSameSite)
            }
          >
            {SAME_SITE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {formatSameSite(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="cookie-field">
          <span>Expires</span>
          <input
            className="input input-md"
            type="datetime-local"
            value={expiresLocal}
            disabled={session}
            onChange={(event) => setExpiresLocal(event.currentTarget.value)}
          />
        </label>
      </div>
      <div className="cookie-form-flags">
        <label className="cookie-check">
          <input
            type="checkbox"
            checked={session}
            onChange={(event) => setSession(event.currentTarget.checked)}
          />
          <span>Session</span>
        </label>
        <label className="cookie-check">
          <input
            type="checkbox"
            checked={secure}
            onChange={(event) => setSecure(event.currentTarget.checked)}
          />
          <span>Secure</span>
        </label>
        <label className="cookie-check">
          <input
            type="checkbox"
            checked={httpOnly}
            onChange={(event) => setHttpOnly(event.currentTarget.checked)}
          />
          <span>HttpOnly</span>
        </label>
      </div>
      <div className="cookie-form-actions">
        <Button onClick={() => void handleSubmit()} disabled={!name || isMutating}>
          {isEdit ? "Save" : "Add"}
        </Button>
        <Button onClick={onCancel} disabled={isMutating}>
          Cancel
        </Button>
      </div>
    </div>
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
  /** 쿠키 항목이면 전체 쿠키 정보. 상세 패널에서 속성까지 편집한다. */
  cookie?: CookieEntry;
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
  onSaveCookie,
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
  onSaveCookie: (cookie: CookieWriteInput) => Promise<boolean>;
  onToggleLayout: () => void;
  onClose: () => void;
}) {
  const searchOptions = useSearchOptions();
  const panelRef = useRef<HTMLElement>(null);
  const hasSearch = Boolean(searchText.trim());
  const editTarget = detail?.editTarget ?? null;
  const cookie = detail?.cookie ?? null;
  const editable = canEdit && Boolean(editTarget || cookie);
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
        {isEditing && cookie ? (
          <CookieForm
            mode="edit"
            initial={cookie}
            isMutating={isMutating}
            onSubmit={async (nextCookie) => {
              const ok = await onSaveCookie(nextCookie);
              if (ok) setIsEditing(false);
              return ok;
            }}
            onCancel={() => setIsEditing(false)}
          />
        ) : isEditing ? (
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
  cookieEntries: CookieEntry[],
  indexedDatabases: IndexedDbDatabaseSnapshot[],
): StorageDetail {
  if (!selectedItem) return null;

  if (selectedItem.kind === "cookie") {
    const cookie = cookieEntries.find(
      (item) =>
        item.name === selectedItem.name &&
        item.domain === selectedItem.domain &&
        item.path === selectedItem.path,
    );
    if (!cookie) return null;

    return {
      title: cookie.name,
      subtitle: "Cookie",
      metaRows: [
        ["Domain", cookie.domain],
        ["Path", cookie.path],
        ["Expires", formatCookieExpires(cookie.expires)],
        ["Size", formatBytes(cookie.size)],
        ["SameSite", formatSameSite(cookie.sameSite)],
        ["HttpOnly", cookie.httpOnly ? "true" : "false"],
        ["Secure", cookie.secure ? "true" : "false"],
        ["Host only", cookie.hostOnly ? "true" : "false"],
      ],
      value: cookie.value,
      instanceId: `cookie:${cookie.domain}:${cookie.path}:${cookie.name}`,
      cookie,
    };
  }

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

function filterCookies(
  cookies: CookieEntry[],
  searchText: string,
  includeText: string,
  excludeText: string,
  searchOptions: SearchOptions,
): CookieEntry[] {
  return cookies.filter((cookie) => {
    const haystack = `${cookie.name} ${cookie.value} ${cookie.domain} ${cookie.path}`;
    return matchesStorageFilters(
      haystack,
      includeText,
      excludeText,
      searchText,
      searchOptions,
    );
  });
}

function formatCookieExpires(expires: number | null): string {
  if (expires === null) return "Session";
  return formatLocaleDateTime(expires * 1000);
}

function formatSameSite(sameSite: CookieSameSite): string {
  switch (sameSite) {
    case "none":
      return "None";
    case "lax":
      return "Lax";
    case "strict":
      return "Strict";
    default:
      return "—";
  }
}

function hostnameFromUrl(url: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** epoch seconds → datetime-local input용 로컬 시간 문자열(YYYY-MM-DDTHH:mm). */
function epochToLocalInput(expires: number | null): string {
  if (expires === null) return "";
  const date = new Date(expires * 1000);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
