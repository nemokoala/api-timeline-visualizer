import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CookieEntry,
  CookieSnapshot,
  PageStorageSnapshot,
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
import { scrollSearchHitIntoView } from "../../utils/searchScroll";
import { useSearchOptions } from "../../contexts/SearchOptionsContext";
import {
  buildStorageSearchOccurrences,
  buildStorageSearchTargets,
  getSearchMatchIndexForStorageTarget,
  selectedItemToStorageTarget,
  storageTargetKey,
  storageTargetTab,
  storageTargetToSelectedItem,
  type StorageSearchOccurrence,
} from "../../utils/storageSearch";
import { SplitPanelResizer } from "../shared/SplitPanelResizer";
import { formatDateTime, formatLocaleDateTime } from "../../utils/formatters";
import { Button } from "../ui/Button";
import { CookiePane } from "./CookiePane";
import { IndexedDbPane } from "./IndexedDbPane";
import { WebStoragePane } from "./WebStoragePane";
import { resolveSelectedDetail, StorageDetailPanel } from "./StorageDetailPanel";
import { filterCookies, filterEntries, filterIndexedDB } from "./storageFilters";
import type { SelectedStorageItem, StorageTab } from "./storageShared";

type StorageViewProps = {
  searchText: string;
  searchMatchIndex: number;
  includeText: string;
  excludeText: string;
  onSearchOccurrencesChange: (occurrences: StorageSearchOccurrence[]) => void;
  onSearchMatchIndexChange: (index: number) => void;
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
