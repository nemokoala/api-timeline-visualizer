import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { ColumnDef, ColumnSizingState, OnChangeFn } from "@tanstack/react-table";
import type {
  IndexedDbDatabaseSnapshot,
  IndexedDbRecord,
  IndexedDbStoreSnapshot,
} from "../../types/storage";
import { useSearchOptions } from "../../contexts/SearchOptionsContext";
import {
  highlightSearchText,
  textMatchesSearch,
} from "../../utils/searchHighlight";
import {
  storageTargetKey,
  type StorageSearchTarget,
} from "../../utils/storageSearch";
import { getTablePrefs, saveTablePrefs, type TablePrefs } from "../../utils/tablePrefs";
import { formatStorageValuePreview } from "../../utils/storageBlobValue";
import { formatBytes } from "../../utils/formatters";
import { ColumnMenu } from "../shared/ColumnMenu";
import { DataTable } from "../shared/DataTable";
import { RowDeleteButton } from "./RowDeleteButton";
import {
  IDB_DEFAULT_PREFS,
  IDB_PREFS_KEY,
  INDEXED_DB_RECORD_COLUMNS,
  type IndexedDbColumnId,
  type IndexedDbColumnVisibility,
  type SelectedStorageItem,
} from "./storageShared";

export function IndexedDbPane({
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
      <div className="grid min-h-[220px] place-content-center text-[13px] text-ink-weak">No matching IndexedDB databases.</div>
    );
  }

  return (
    <>
      <div className="min-h-0 min-w-0 overflow-auto bg-surface p-3">
        {databases.map((database) => (
          <section
            className="grid gap-2 [&+&]:mt-4 [&+&]:border-t [&+&]:border-line-weak [&+&]:pt-3.5"
            key={database.name}
          >
            <h3 className="m-0 flex items-center gap-2 text-[13px] text-ink-strong">
              {hasSearch
                ? highlightSearchText(database.name, searchText, searchOptions)
                : database.name}
              {database.version ? (
                <span className="text-[11px] font-medium text-ink-weak">v{database.version}</span>
              ) : null}
            </h3>
            {database.error ? (
              <p className="mx-3 my-2 rounded-[10px] bg-danger-soft px-3 py-[7px] text-[11px] leading-[1.4] text-danger">{database.error}</p>
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
        meta: { cellClassName: "px-1.5 py-0 text-center" },
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
      className="overflow-hidden rounded-xl border border-line-weak bg-surface"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer justify-between gap-3 bg-surface-sub px-3 py-[9px] text-ink">
        <span>
          {hasSearch
            ? highlightSearchText(store.name, searchText, searchOptions)
            : store.name}
        </span>
        <span className="text-[11px] text-ink-weak">{store.count ?? store.records.length} rows</span>
      </summary>
      {store.error ? (
        <p className="mx-3 my-2 rounded-[10px] bg-danger-soft px-3 py-[7px] text-[11px] leading-[1.4] text-danger">{store.error}</p>
      ) : null}
      {store.truncated ? (
        <p className="mx-3 my-2 rounded-[10px] bg-warn-soft px-3 py-[7px] text-[11px] leading-[1.4] text-warn">
          Showing the first {store.records.length} records.
        </p>
      ) : null}
      <DataTable
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
