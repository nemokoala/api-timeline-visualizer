import {
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { ColumnDef, ColumnSizingState, OnChangeFn } from "@tanstack/react-table";
import type { StorageEntry } from "../../types/storage";
import { useSearchOptions } from "../../contexts/SearchOptionsContext";
import { useExpandedRows } from "../../hooks/useExpandedRows";
import { highlightSearchText } from "../../utils/searchHighlight";
import { storageTargetKey } from "../../utils/storageSearch";
import { getTablePrefs, saveTablePrefs, type TablePrefs } from "../../utils/tablePrefs";
import { formatBytes } from "../../utils/formatters";
import { ColumnMenu } from "../shared/ColumnMenu";
import { DataTable } from "../shared/DataTable";
import { RowContextMenu, type RowContextMenuItem } from "../shared/RowContextMenu";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { copyText } from "../../utils/clipboard";
import { RowDeleteButton } from "./RowDeleteButton";
import {
  isExpandableStorageValue,
  StorageValueCell,
  StorageValueSubTree,
} from "./StorageValueCell";
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
  const { isExpanded, toggle: toggleExpanded } = useExpandedRows();
  const [tablePrefs, setTablePrefs] = useState<TablePrefs>(() =>
    getTablePrefs(WEB_PREFS_KEY, WEB_DEFAULT_PREFS),
  );
  const [columnMenu, setColumnMenu] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [rowMenu, setRowMenu] = useState<
    { x: number; y: number; entry: StorageEntry } | null
  >(null);
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

  const handleRowContextMenu = (entry: StorageEntry, event: ReactMouseEvent) => {
    event.preventDefault();
    setRowMenu({ x: event.clientX, y: event.clientY, entry });
  };

  const rowMenuItems = (entry: StorageEntry): RowContextMenuItem[] => {
    const items: RowContextMenuItem[] = [
      { id: "copy-key", label: "Copy key", onSelect: () => void copyText(entry.key) },
      { id: "copy-value", label: "Copy value", onSelect: () => void copyText(entry.value) },
      {
        id: "copy-json",
        label: "Copy as JSON",
        onSelect: () => void copyText(JSON.stringify({ [entry.key]: entry.value })),
      },
    ];
    if (canEdit) {
      items.push({
        id: "delete",
        label: "Delete",
        separatorBefore: true,
        disabled: isMutating,
        onSelect: () => onDeleteEntry(entry.key),
      });
    }
    return items;
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
        cell: ({ row }) => (
          <StorageValueCell
            value={row.original.value}
            searchText={searchText}
            expanded={isExpanded(row.original.key)}
            onToggle={() => toggleExpanded(row.original.key)}
          />
        ),
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
  }, [
    canEdit,
    isExpanded,
    isMutating,
    onDeleteEntry,
    searchOptions,
    searchText,
    toggleExpanded,
  ]);

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
          renderSubRow={(entry) =>
            isExpanded(entry.key) && isExpandableStorageValue(entry.value) ? (
              <StorageValueSubTree value={entry.value} searchText={searchText} />
            ) : null
          }
          onHeaderContextMenu={handleColumnContextMenu}
          onRowContextMenu={handleRowContextMenu}
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
      {rowMenu ? (
        <RowContextMenu
          x={rowMenu.x}
          y={rowMenu.y}
          items={rowMenuItems(rowMenu.entry)}
          onClose={() => setRowMenu(null)}
        />
      ) : null}
    </>
  );
}
