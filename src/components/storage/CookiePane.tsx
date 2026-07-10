import {
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { ColumnDef, ColumnSizingState, OnChangeFn } from "@tanstack/react-table";
import type { CookieEntry } from "../../types/storage";
import type { CookieWriteInput } from "../../utils/cookieInspector";
import { useSearchOptions } from "../../contexts/SearchOptionsContext";
import { useExpandedRows } from "../../hooks/useExpandedRows";
import { highlightSearchText } from "../../utils/searchHighlight";
import { storageTargetKey } from "../../utils/storageSearch";
import { getTablePrefs, saveTablePrefs, type TablePrefs } from "../../utils/tablePrefs";
import { formatBytes } from "../../utils/formatters";
import { ColumnMenu } from "../shared/ColumnMenu";
import { DataTable } from "../shared/DataTable";
import { Button } from "../ui/Button";
import { CookieForm } from "./CookieForm";
import { formatCookieExpires, formatSameSite } from "./cookieFormat";
import { RowDeleteButton } from "./RowDeleteButton";
import {
  isExpandableStorageValue,
  StorageValueCell,
  StorageValueSubTree,
} from "./StorageValueCell";
import {
  COOKIE_COLUMNS,
  COOKIE_DEFAULT_PREFS,
  COOKIE_PREFS_KEY,
  type CookieColumnId,
  type CookieColumnVisibility,
  type SelectedStorageItem,
} from "./storageShared";

/** 쿠키 한 개를 가리키는 안정적인 키(행 id·펼침 상태 공용). */
function cookieRowKey(cookie: CookieEntry): string {
  return storageTargetKey({
    kind: "cookie",
    name: cookie.name,
    domain: cookie.domain,
    path: cookie.path,
  });
}

export function CookiePane({
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
  const { isExpanded, toggle: toggleExpanded } = useExpandedRows();
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
        cell: ({ row }) => (
          <StorageValueCell
            value={row.original.value}
            searchText={searchText}
            expanded={isExpanded(cookieRowKey(row.original))}
            onToggle={() => toggleExpanded(cookieRowKey(row.original))}
          />
        ),
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
        meta: { cellClassName: "text-center" },
        cell: ({ row }) => (row.original.httpOnly ? "✓" : ""),
      },
      {
        id: "secure",
        header: "Secure",
        size: 70,
        minSize: 56,
        meta: { cellClassName: "text-center" },
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
        meta: { cellClassName: "px-1.5 py-0 text-center" },
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
  }, [
    canEdit,
    isExpanded,
    isMutating,
    onDeleteCookie,
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
          getRowId={(cookie) => `storage-row-${cookieRowKey(cookie)}`}
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
          renderSubRow={(cookie) =>
            isExpanded(cookieRowKey(cookie)) && isExpandableStorageValue(cookie.value) ? (
              <StorageValueSubTree value={cookie.value} searchText={searchText} />
            ) : null
          }
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
