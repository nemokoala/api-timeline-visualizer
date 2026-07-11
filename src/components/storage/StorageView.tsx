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
  fetchMoreIndexedDbRecords,
  setIndexedDbRecord,
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
import { PillTabs } from "../ui/PillTabs";
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

// "더 불러오기" 한 번에 추가로 읽는 IndexedDB 레코드 수(초기 상한과 동일).
const MORE_RECORDS_BATCH = 80;

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
  // 현재 "더 불러오기" 진행 중인 스토어 키(`db:store`). 버튼 중복 클릭·표시용.
  const [loadingMoreKey, setLoadingMoreKey] = useState<string | null>(null);
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

        // 셀 영역으로 한정한다. 펼쳐진 JSON 서브행에도 .search-highlight가 생기는데,
        // occurrenceIndex는 셀 기준 순번이라 함께 세면 활성 마크가 어긋난다.
        const rowMarks = row?.querySelectorAll("[data-row-cells] .search-highlight");
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

  const handleSaveIdbRecord = (
    databaseName: string,
    storeName: string,
    recordKey: string,
    value: string,
  ) => runMutation(() => setIndexedDbRecord(databaseName, storeName, recordKey, value));

  // 상한을 넘긴 레코드를 이어 읽어 스냅샷(단일 소스)에 붙인다. 오프셋은 필터와 무관하게
  // 원본 스냅샷의 로드된 개수로 잡는다.
  const handleLoadMoreRecords = async (databaseName: string, storeName: string) => {
    if (loadingMoreKey) return;
    const store = snapshot?.indexedDB
      .find((database) => database.name === databaseName)
      ?.stores.find((item) => item.name === storeName);
    if (!store) return;

    const key = `${databaseName}:${storeName}`;
    setLoadingMoreKey(key);
    try {
      const more = await fetchMoreIndexedDbRecords(
        databaseName,
        storeName,
        store.records.length,
        MORE_RECORDS_BATCH,
      );
      setSnapshot((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          indexedDB: prev.indexedDB.map((database) =>
            database.name !== databaseName
              ? database
              : {
                  ...database,
                  stores: database.stores.map((item) => {
                    if (item.name !== storeName) return item;
                    const records = [...item.records, ...more];
                    return {
                      ...item,
                      records,
                      truncated: (item.count ?? records.length) > records.length,
                    };
                  }),
                },
          ),
        };
      });
    } catch (loadFailure) {
      setMutationError(
        loadFailure instanceof Error ? loadFailure.message : "Failed to load more records.",
      );
    } finally {
      setLoadingMoreKey(null);
    }
  };

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
    <section className="storage-panel @container grid h-full min-h-0 min-w-0 grid-rows-[auto_auto_auto_minmax(0,1fr)] overflow-hidden bg-bg">
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-0.5 border-b border-line-weak bg-surface px-3 py-1.5 @max-[560px]:grid-cols-[minmax(0,1fr)_auto] @max-[560px]:gap-y-[3px] max-[820px]:grid-cols-[minmax(0,1fr)_auto] max-[820px]:gap-y-[3px] max-[820px]:px-2 max-[820px]:py-1">
        <span className="col-start-1 row-start-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.04em] text-ink-weak">Storage</span>
        <span
          className={`col-start-2 row-start-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-ink @max-[560px]:col-span-full @max-[560px]:col-start-1 @max-[560px]:row-start-2 max-[820px]:col-span-full max-[820px]:col-start-1 max-[820px]:row-start-2 ${snapshot ? "" : "col-end-4"}`}
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
            className="col-start-3 row-start-1 whitespace-nowrap text-[10px] text-ink-weak tabular-nums @max-[560px]:hidden max-[820px]:hidden"
            title={formatLocaleDateTime(Date.parse(snapshot.capturedAt))}
          >
            {formatDateTime(Date.parse(snapshot.capturedAt))}
          </span>
        ) : null}
        <Button
          size="sm"
          className="col-start-4 row-start-1 @max-[560px]:col-start-2 @max-[560px]:row-start-1 @max-[560px]:justify-self-end max-[820px]:col-start-2 max-[820px]:row-start-1 max-[820px]:justify-self-end"
          onClick={() => void loadSnapshot()}
          disabled={isLoading}
        >
          {isLoading ? "Refreshing" : "Refresh"}
        </Button>
      </div>

      <PillTabs
        className="border-b border-line-weak bg-surface px-3.5 py-2.5"
        ariaLabel="Storage type"
        value={activeTab}
        onChange={(tab) => {
          setActiveTab(tab);
          setSelectedItem(null);
        }}
        options={[
          { value: "local", label: "localStorage", count: localEntries.length },
          { value: "session", label: "sessionStorage", count: sessionEntries.length },
          { value: "cookies", label: "Cookies", count: cookieEntries.length },
          { value: "indexeddb", label: "IndexedDB", count: indexedDatabases.length },
        ]}
      />

      {error ? <StorageMessage error>{error}</StorageMessage> : null}
      {mutationError ? <StorageMessage error>{mutationError}</StorageMessage> : null}
      {snapshot?.errors.length ? (
        <StorageMessage>{snapshot.errors.join(" ")}</StorageMessage>
      ) : null}
      {activeTab === "cookies" && cookieSnapshot?.errors.length ? (
        <StorageMessage error>{cookieSnapshot.errors.join(" ")}</StorageMessage>
      ) : null}

      <div
        ref={storageWorkspaceRef}
        className={`storage-workspace grid h-full min-h-0 overflow-hidden ${hasDetail ? "has-detail" : ""} ${hasDetail && isSplitStacked ? "split-layout-stacked" : ""}`}
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
            onLoadMore={handleLoadMoreRecords}
            loadingMoreKey={loadingMoreKey}
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
              onSaveValue={(value) => {
                const target = selectedDetail?.editTarget;
                if (!target) return Promise.resolve(false);
                return target.kind === "indexeddb"
                  ? handleSaveIdbRecord(
                      target.databaseName,
                      target.storeName,
                      target.recordKey,
                      value,
                    )
                  : handleSaveWebEntry(target.kind, target.key, value);
              }}
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

/** 스토리지 상단 안내/오류 메시지 카드. */
function StorageMessage({ error, children }: { error?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`mx-3.5 mt-2.5 rounded-xl border-0 px-3 py-[9px] text-[12px] shadow-card ${
        error ? "bg-danger-soft text-danger" : "bg-surface text-ink-sub"
      }`}
    >
      {children}
    </div>
  );
}
