import { useEffect, useRef, useState } from "react";
import type {
  CookieEntry,
  IndexedDbDatabaseSnapshot,
  StorageEntry,
} from "../../types/storage";
import type { CookieWriteInput } from "../../utils/cookieInspector";
import { useSearchOptions } from "../../contexts/SearchOptionsContext";
import {
  highlightSearchText,
  textMatchesSearch,
} from "../../utils/searchHighlight";
import { scrollSearchHitIntoView } from "../../utils/searchScroll";
import { formatBytes } from "../../utils/formatters";
import {
  DetailPanelCloseButton,
  SplitLayoutToggleButton,
} from "../shared/DetailPanelCloseButton";
import { DetailSection } from "../shared/DetailSection";
import { DetailTitleBar } from "../shared/DetailTitleBar";
import { DefinitionList } from "../shared/DefinitionList";
import { JsonViewer } from "../shared/JsonViewer";
import { Button } from "../ui/Button";
import { TextArea } from "../ui/Input";
import { CookieForm } from "./CookieForm";
import { isExpandableStorageValue } from "./StorageValueCell";
import { formatCookieExpires, formatSameSite } from "./cookieFormat";
import type { SelectedStorageItem } from "./storageShared";

export type StorageDetail = {
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

export function StorageDetailPanel({
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

  // JSON 값은 목록 행에서 인라인으로 펼쳐 볼 수 있으므로, 세부 패널의 읽기 전용 뷰어는
  // 중복이라 생략한다. 평문·blob 등 인라인 펼침이 없는 값만 뷰어로 보여준다.
  const valueInlineExpandable =
    typeof detail.value === "string" && isExpandableStorageValue(detail.value);

  const metaMatchesSearch =
    hasSearch &&
    (textMatchesSearch(detail.title, searchText, searchOptions) ||
      detail.metaRows.some(([, value]) =>
        textMatchesSearch(value, searchText, searchOptions),
      ));

  return (
    <aside
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-surface"
      ref={panelRef}
    >
      <DetailTitleBar
        kicker={detail.subtitle}
        title={
          hasSearch
            ? highlightSearchText(detail.title, searchText, searchOptions)
            : detail.title
        }
        titleAttr={detail.title}
        actions={
          <>
            {editable && !isEditing ? (
              <Button size="sm" onClick={startEditing}>
                Edit
              </Button>
            ) : null}
            <SplitLayoutToggleButton isStacked={isStacked} onClick={onToggleLayout} />
            <DetailPanelCloseButton onClick={onClose} label="Close storage detail" />
          </>
        }
      />
      <DetailSection
        sectionId={`${detail.instanceId}:meta`}
        title="Details"
        defaultOpen={valueInlineExpandable}
        density="compact"
        className="shrink-0"
        expandForSearch={metaMatchesSearch}
        searchExpandToken={searchFocusKey}
      >
        <DefinitionList
          className="gap-1"
          rowClassName="grid-cols-[68px_minmax(0,1fr)] gap-2"
          textClassName="text-[11px] leading-[1.35]"
          rows={detail.metaRows.map(([label, value]) => [
            label,
            hasSearch ? highlightSearchText(value, searchText, searchOptions) : value,
          ])}
        />
      </DetailSection>
      <div className="storage-detail-value min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 [scrollbar-gutter:stable]">
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
          <div className="flex h-full min-h-0 flex-col gap-2 p-3">
            <TextArea
              className="min-h-40 flex-1 resize-y p-2.5 text-[12px] leading-normal [font-family:var(--mono,ui-monospace,SFMono-Regular,Menlo,monospace)]"
              value={draftValue}
              onChange={(event) => setDraftValue(event.currentTarget.value)}
              spellCheck={false}
              autoFocus
            />
            <div className="flex gap-1.5">
              <Button onClick={() => void saveEditing()} disabled={isMutating}>
                Save
              </Button>
              <Button onClick={() => setIsEditing(false)} disabled={isMutating}>
                Cancel
              </Button>
            </div>
          </div>
        ) : valueInlineExpandable ? (
          <p className="m-0 px-1 py-2 text-[11px] leading-[1.5] text-ink-weak">
            값은 목록에서 행을 펼쳐(▶) 보세요.
            {editable ? " 편집은 상단 Edit 버튼." : ""}
          </p>
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

export function resolveSelectedDetail(
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
