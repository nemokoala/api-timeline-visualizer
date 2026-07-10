import { useSearchOptions } from "../../contexts/SearchOptionsContext";
import { formatBytes } from "../../utils/formatters";
import { formatJsonTextPreview } from "../../utils/jsonTextPreview";
import { highlightSearchText } from "../../utils/searchHighlight";
import {
  formatStorageValuePreview,
  sanitizeStorageBlobsForDisplay,
} from "../../utils/storageBlobValue";
import {
  isJsonLikeValue,
  JsonInlinePreview,
  JsonRowSubTree,
  JsonRowToggle,
} from "../shared/JsonRowPreview";
import { JsonTree } from "../shared/JsonViewer";

/**
 * blob 표식(`{__apiFlowImageBlob:…}`)은 `[Image Blob: …]` 라벨로 접어 두는 값이라
 * 펼치지 않는다. 그 외 JSON으로 보이는 값만 트리로 펼칠 수 있다.
 */
export function isExpandableStorageValue(value: string): boolean {
  if (formatStorageValuePreview(value, formatBytes) !== value) return false;
  return isJsonLikeValue(value);
}

/**
 * 스토리지 행의 Value 셀. 콘솔 메시지 셀과 같은 규칙이다 —
 * JSON이면 구문 색을 입힌 한 줄 미리보기를 보여주고, 앞의 토글로 트리를 펼친다.
 *
 * 검색 중에는 요약하지 않고 원본을 그린다. storageSearch는 히트 수를 원본
 * `키 + 값`에서 세는데(cookie는 `이름 값 도메인 경로`), 요약본은 키·항목을 잘라내
 * 마크 수가 모자란다. 그러면 값 뒤에 오는 도메인·경로 마크까지 순번이 밀려
 * 활성 하이라이트가 엉뚱한 마크에 붙는다.
 */
export function StorageValueCell({
  value,
  searchText,
  expanded,
  onToggle,
}: {
  value: string;
  searchText: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const expandable = isExpandableStorageValue(value);
  const hasSearch = Boolean(searchText.trim());

  return (
    <div className="flex min-w-0 items-start gap-1">
      <JsonRowToggle expandable={expandable} expanded={expanded} onToggle={onToggle} />
      <span className="min-w-0" title={value}>
        {expandable ? (
          <JsonInlinePreview
            preview={hasSearch ? value : formatJsonTextPreview(value)}
            searchText={searchText}
          />
        ) : (
          <PlainValue value={value} searchText={searchText} />
        )}
      </span>
    </div>
  );
}

function PlainValue({ value, searchText }: { value: string; searchText: string }) {
  const searchOptions = useSearchOptions();
  const label = formatStorageValuePreview(value, formatBytes);

  return (
    <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
      {searchText.trim() ? highlightSearchText(label, searchText, searchOptions) : label}
    </span>
  );
}

/** 펼친 행 아래로 이어지는 JSON 트리. blob은 base64를 걷어낸 요약으로 바꿔 그린다. */
export function StorageValueSubTree({
  value,
  searchText,
}: {
  value: string;
  searchText: string;
}) {
  return (
    <JsonRowSubTree>
      <JsonTree value={toDisplayJson(value)} searchText={searchText} className="px-0 py-0" />
    </JsonRowSubTree>
  );
}

function toDisplayJson(value: string): unknown {
  try {
    return sanitizeStorageBlobsForDisplay(JSON.parse(value));
  } catch {
    return value;
  }
}
