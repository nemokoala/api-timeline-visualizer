import {
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { ColumnDef, ColumnSizingState, OnChangeFn } from "@tanstack/react-table";
import type { StorageEntry } from "../../types/storage";
import { useSearchOptions } from "../../contexts/SearchOptionsContext";
import { highlightSearchText } from "../../utils/searchHighlight";
import { storageTargetKey } from "../../utils/storageSearch";
import { getTablePrefs, saveTablePrefs, type TablePrefs } from "../../utils/tablePrefs";
import { formatBytes } from "../../utils/formatters";
import { ColumnMenu } from "../shared/ColumnMenu";
import { DataTable } from "../shared/DataTable";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { RowDeleteButton } from "./RowDeleteButton";
import {
  WEB_DEFAULT_PREFS,
  WEB_PREFS_KEY,
  WEB_STORAGE_COLUMNS,
  type SelectedStorageItem,
  type WebStorageColumnId,
  type WebStorageColumnVisibility,
} from "./storageShared";

export function WebStoragePane({
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
        meta: { cellClassName: "px-1.5 py-0 text-center" },
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
      <div className="min-h-0 min-w-0 overflow-auto bg-surface">
        {canEdit ? (
          <div className="border-b border-line-weak bg-surface-sub px-2.5 py-2">
            {adding ? (
              <div className="flex items-center gap-1.5">
                <Input
                  className="flex-[0_0_30%]"
                  placeholder="Key"
                  value={newKey}
                  onChange={(event) => setNewKey(event.currentTarget.value)}
                  autoFocus
                />
                <Input
                  className="flex-auto"
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
