import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useSearchOptions } from '../../contexts/SearchOptionsContext';
import { useWorkspaceOptional } from '../../contexts/WorkspaceContext';
import { highlightSearchText, textMatchesSearch, type SearchOptions } from '../../utils/searchHighlight';
import { scrollSearchHitIntoView } from '../../utils/searchScroll';
import { getImagePreviews, mergeBlobPreviewItems, type ImagePreviewItem } from '../../utils/imageSource';
import { fetchStorageRecordBlobPreviews } from '../../utils/storageInspector';
import { findStorageBlobPreviews, sanitizeStorageBlobsForDisplay } from '../../utils/storageBlobValue';
import { DetailSection } from './DetailSection';
import { ImagePreviewGallery } from './ImagePreviewGallery';
import { Button, IconButton } from '../ui/Button';
import { SearchOptionToggles } from '../ui/SearchOptionToggles';

type ActiveFieldMenu = {
  id: string;
  value: unknown;
  left: number;
  top: number;
} | null;

type JsonViewerProps = {
  value: unknown;
  mimeType?: string;
  searchText?: string;
  instanceId?: string;
  recordKey?: string;
  searchFocusKey?: string;
  blobPreviewRequest?: {
    databaseName: string;
    storeName: string;
    recordIndex: number;
  };
};

export function JsonViewer({
  value,
  mimeType,
  searchText = '',
  instanceId,
  recordKey,
  searchFocusKey = '',
  blobPreviewRequest,
}: JsonViewerProps) {
  const searchOptions = useSearchOptions();
  const [fetchedBlobPreviews, setFetchedBlobPreviews] = useState<Awaited<
    ReturnType<typeof fetchStorageRecordBlobPreviews>
  >>([]);
  const [blobPreviewsLoading, setBlobPreviewsLoading] = useState(false);
  const renderValue = coerceJson(value);
  const displayValue = sanitizeStorageBlobsForDisplay(renderValue);
  const output =
    typeof displayValue === 'string' ? displayValue : JSON.stringify(displayValue, null, 2);

  useEffect(() => {
    if (!blobPreviewRequest) {
      setFetchedBlobPreviews([]);
      setBlobPreviewsLoading(false);
      return;
    }

    let cancelled = false;
    setBlobPreviewsLoading(true);

    void fetchStorageRecordBlobPreviews(
      blobPreviewRequest.databaseName,
      blobPreviewRequest.storeName,
      blobPreviewRequest.recordIndex,
    )
      .then((previews) => {
        if (!cancelled) setFetchedBlobPreviews(previews);
      })
      .catch(() => {
        if (!cancelled) setFetchedBlobPreviews([]);
      })
      .finally(() => {
        if (!cancelled) setBlobPreviewsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [blobPreviewRequest, instanceId]);

  const imagePreviews: ImagePreviewItem[] = blobPreviewRequest
    ? mergeBlobPreviewItems(findStorageBlobPreviews(renderValue, recordKey), fetchedBlobPreviews, recordKey)
    : getImagePreviews(renderValue, mimeType, recordKey);

  if (imagePreviews.length > 0) {
    const sectionPrefix = instanceId ?? 'json-viewer';
    const hasSearch = Boolean(searchText.trim());
    const imageSearchHaystack = imagePreviews
      .map((preview) => [preview.label, preview.mimeType, preview.unavailableReason].filter(Boolean).join(' '))
      .join(' ');
    const imageMatchesSearch =
      hasSearch && textMatchesSearch(imageSearchHaystack, searchText, searchOptions);
    const jsonMatchesSearch = hasSearch && textMatchesSearch(output, searchText, searchOptions);

    return (
      <div className="json-value-sections">
        <DetailSection
          sectionId={`${sectionPrefix}:images`}
          title={imagePreviews.length > 1 ? 'Images' : 'Image'}
          defaultOpen
          expandForSearch={imageMatchesSearch}
          searchExpandToken={searchFocusKey}
        >
          <ImagePreviewGallery
            previews={imagePreviews}
            recordKey={recordKey}
            blobPreviewsLoading={blobPreviewsLoading}
            showLayoutToggle={Boolean(blobPreviewRequest)}
          />
        </DetailSection>
        <DetailSection
          sectionId={`${sectionPrefix}:json`}
          title="JSON"
          defaultOpen
          expandForSearch={jsonMatchesSearch}
          searchExpandToken={searchFocusKey}
        >
          <JsonBlock
            value={displayValue}
            fallback={output}
            searchText={searchText}
            searchOptions={searchOptions}
            instanceId={instanceId}
          />
        </DetailSection>
      </div>
    );
  }

  return (
    <JsonBlock
      value={displayValue}
      fallback={output}
      searchText={searchText}
      searchOptions={searchOptions}
      instanceId={instanceId}
    />
  );
}

function JsonBlock({
  value,
  fallback,
  searchText,
  searchOptions,
  instanceId,
}: {
  value: unknown;
  fallback: string;
  searchText: string;
  searchOptions: Required<SearchOptions>;
  instanceId?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [fieldMenu, setFieldMenu] = useState<ActiveFieldMenu>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const [localActiveIndex, setLocalActiveIndex] = useState(0);
  const [localHitCount, setLocalHitCount] = useState(0);
  const [localMatchCase, setLocalMatchCase] = useState(false);
  const [localWholeWord, setLocalWholeWord] = useState(false);
  const [customHeight, setCustomHeight] = useState<number | null>(null);
  const viewerBodyRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Pop out(플로팅 dockview 패널로 열기)은 워크스페이스 컨텍스트가 있을 때만 노출한다.
  const onOpenPanel = useWorkspaceOptional()?.openJsonPanel ?? null;
  const copyText = fallback || '{}';
  const isObject = Boolean(value && typeof value === 'object');

  // 뷰어 내부 전용 검색. 비어 있으면 기존 전역 검색(searchText)으로 동작한다.
  const localTerm = localSearch.trim();
  const localActive = localTerm.length > 0;
  const effectiveSearch = localActive ? localSearch : searchText;
  // 로컬 검색은 자체 대소문자/단어단위 옵션을, 전역 검색은 컨텍스트 옵션을 따른다.
  const effectiveOptions: Required<SearchOptions> = localActive
    ? { matchCase: localMatchCase, matchWholeWord: localWholeWord }
    : searchOptions;
  // 전역 검색 하이라이트와 충돌하지 않도록 로컬 검색은 별도 클래스를 사용한다.
  const markClassName = localActive ? 'json-local-hit' : 'search-highlight';

  useEffect(() => {
    setFieldMenu(null);
    setIsFullscreen(false);
    setCopied(false);
    setLocalSearch('');
    setLocalActiveIndex(0);
    setLocalMatchCase(false);
    setLocalWholeWord(false);
    setCustomHeight(null);
  }, [instanceId]);

  // 검색어나 옵션이 바뀌면 활성 히트를 처음으로 되돌린다.
  useEffect(() => {
    setLocalActiveIndex(0);
  }, [localTerm, localMatchCase, localWholeWord]);

  // 렌더링된 로컬 히트를 세고, 활성 히트를 표시한 뒤 화면에 보이도록 스크롤한다.
  useEffect(() => {
    if (!localActive) {
      setLocalHitCount(0);
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const body = viewerBodyRef.current;
      if (!body) return;

      const marks = body.querySelectorAll('.json-local-hit');
      setLocalHitCount(marks.length);
      if (!marks.length) return;

      const activeIndex = Math.min(localActiveIndex, marks.length - 1);
      marks.forEach((mark, index) => {
        mark.classList.toggle('is-active', index === activeIndex);
      });

      scrollSearchHitIntoView(marks[activeIndex]);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [localActive, localTerm, localActiveIndex, value, localMatchCase, localWholeWord, searchOptions]);

  const goToLocalHit = (delta: number) => {
    setLocalActiveIndex((current) => {
      if (localHitCount === 0) return 0;
      return (current + delta + localHitCount) % localHitCount;
    });
  };

  const handleLocalSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      goToLocalHit(event.shiftKey ? -1 : 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setLocalSearch('');
    }
  };

  const shownHitOrder = localHitCount > 0 ? Math.min(localActiveIndex, localHitCount - 1) + 1 : 0;

  // 하단 핸들을 드래그해 뷰어 높이를 조절한다. 더블클릭하면 기본 높이로 되돌린다.
  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    // border-box 기준 높이(offsetHeight)로 시작값을 잡아 적용 높이와 어긋나지 않게 한다.
    const startHeight = customHeight ?? wrapRef.current?.offsetHeight ?? 318;
    const maxHeight = Math.max(160, window.innerHeight - 120);
    // 내용이 적어 시작 높이가 낮을 때 드래그 시작과 동시에 최소높이로 튀지 않도록,
    // 하한을 시작 높이와 기본 최소(120) 중 작은 값으로 둔다.
    const minHeight = Math.max(48, Math.min(120, startHeight));

    const handleMove = (moveEvent: PointerEvent) => {
      const next = clamp(startHeight + (moveEvent.clientY - startY), minHeight, maxHeight);
      setCustomHeight(next);
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      document.body.style.userSelect = '';
    };

    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  // 전체화면에서는 고정 높이를 적용하지 않고 화면을 가득 채운다.
  // 높이는 래퍼에 적용하고 내부 body/pre가 이를 채우도록 한다. (pre가 flex:1인 컨텍스트에서도 동작)
  const appliedHeight = !isFullscreen && customHeight != null ? customHeight : undefined;
  const wrapStyle = appliedHeight != null ? { height: appliedHeight } : undefined;

  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!fieldMenu) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFieldMenu(null);
    };

    const viewer = viewerBodyRef.current?.querySelector('.json-viewer');
    const closeMenu = () => setFieldMenu(null);

    window.addEventListener('keydown', handleKeyDown);
    viewer?.addEventListener('scroll', closeMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      viewer?.removeEventListener('scroll', closeMenu);
    };
  }, [fieldMenu]);

  const handleCopy = async () => {
    const didCopy = await copyToClipboard(copyText);
    if (!didCopy) return;

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const handleFieldCopy = async (mode: 'value' | 'string') => {
    if (!fieldMenu) return;

    const text = mode === 'value' ? formatCopyValue(fieldMenu.value) : formatCopyString(fieldMenu.value);
    const didCopy = await copyToClipboard(text);
    if (!didCopy) return;

    setFieldMenu(null);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const handleFieldClick = (id: string, targetValue: unknown, event: MouseEvent<HTMLButtonElement>) => {
    if (fieldMenu?.id === id) {
      setFieldMenu(null);
      return;
    }

    const body = viewerBodyRef.current;
    const button = event.currentTarget;
    if (!body) return;

    const bodyRect = body.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const menuWidth = 196;
    const left = clamp(buttonRect.left - bodyRect.left, 8, Math.max(8, bodyRect.width - menuWidth - 8));
    const top = buttonRect.top - bodyRect.top;

    setFieldMenu({ id, value: targetValue, left, top });
  };

  return (
    <>
      {isFullscreen ? (
        <div className="json-fullscreen-backdrop" onClick={() => setIsFullscreen(false)} aria-hidden="true" />
      ) : null}
      <div
        ref={wrapRef}
        className={`json-viewer-wrap${isFullscreen ? ' is-fullscreen' : ''}${appliedHeight != null ? ' is-resized' : ''}`}
        style={wrapStyle}
        role={isFullscreen ? 'dialog' : undefined}
        aria-modal={isFullscreen ? true : undefined}
        aria-label={isFullscreen ? 'JSON fullscreen' : undefined}
      >
        <div className="json-viewer-toolbar">
          <div className="json-viewer-local-search">
            <input
              type="search"
              className="input input-sm json-local-search-input"
              placeholder="Search in this viewer"
              value={localSearch}
              onChange={(event) => setLocalSearch(event.target.value)}
              onKeyDown={handleLocalSearchKeyDown}
              spellCheck={false}
            />
            <SearchOptionToggles
              className="json-local-search-options"
              matchCase={localMatchCase}
              wholeWord={localWholeWord}
              onMatchCaseChange={setLocalMatchCase}
              onWholeWordChange={setLocalWholeWord}
            />
            {localActive ? (
              <>
                <span className="json-local-search-count">
                  {shownHitOrder}/{localHitCount}
                </span>
                <IconButton
                  tone="accent"
                  onClick={() => goToLocalHit(-1)}
                  disabled={localHitCount === 0}
                  aria-label="이전 검색 결과"
                  title="이전 (Shift+Enter)"
                >
                  ↑
                </IconButton>
                <IconButton
                  tone="accent"
                  onClick={() => goToLocalHit(1)}
                  disabled={localHitCount === 0}
                  aria-label="다음 검색 결과"
                  title="다음 (Enter)"
                >
                  ↓
                </IconButton>
              </>
            ) : null}
          </div>
          <div className="json-viewer-actions">
            <Button size="sm" tone="accent" onClick={() => setIsFullscreen((current) => !current)}>
              {isFullscreen ? 'Close' : 'Fullscreen'}
            </Button>
            {onOpenPanel ? (
              <Button size="sm" tone="accent" onClick={() => onOpenPanel(value)} title="새 창(패널)으로 열기">
                Pop out
              </Button>
            ) : null}
            <Button size="sm" tone="accent" onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
        <div className="json-viewer-body" ref={viewerBodyRef}>
          {fieldMenu ? (
            <div
              className="json-field-menu json-field-menu-floating"
              style={{ left: fieldMenu.left, top: fieldMenu.top }}
            >
              <button type="button" onClick={() => handleFieldCopy('value')}>
                값 복사
              </button>
              <button type="button" onClick={() => handleFieldCopy('string')}>
                문자열 복사
              </button>
              <button type="button" onClick={() => setFieldMenu(null)} aria-label="Close field copy menu">
                ×
              </button>
            </div>
          ) : null}
          {isObject ? (
            <div className="json-viewer json-tree">
              {renderJsonValue(value, 0, 'root', handleFieldClick, effectiveSearch, effectiveOptions, markClassName)}
            </div>
          ) : (
            <pre className="json-viewer">
              {highlightSearchText(copyText, effectiveSearch, effectiveOptions, markClassName)}
            </pre>
          )}
        </div>
        {!isFullscreen ? (
          <div
            className="json-viewer-resize-handle"
            onPointerDown={handleResizeStart}
            onDoubleClick={() => setCustomHeight(null)}
            role="separator"
            aria-orientation="horizontal"
            aria-label="뷰어 높이 조절 (더블클릭 시 기본값)"
            title="드래그로 높이 조절 · 더블클릭으로 기본값"
          />
        ) : null}
      </div>
    </>
  );
}

// 들여쓰기 가이드선 색상 개수. 이 수를 주기로 depth별 색이 순환한다. (global.css의 --json-guide-N과 일치)
const GUIDE_COLOR_COUNT = 6;

function renderJsonValue(
  value: unknown,
  depth: number,
  path: string,
  onFieldClick: (id: string, value: unknown, event: MouseEvent<HTMLButtonElement>) => void,
  searchText: string,
  searchOptions: Required<SearchOptions>,
  markClassName: string,
): React.ReactNode {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="json-punctuation">[]</span>;

    // 각 중첩 레벨을 블록으로 감싸고 border-left로 들여쓰기 가이드선을 그린다.
    // data-depth로 레벨마다 다른 색(무지개)을 입혀 어느 선인지 구분하기 쉽게 한다.
    return (
      <>
        <span className="json-punctuation">[</span>
        <div className="json-indent" data-depth={depth % GUIDE_COLOR_COUNT}>
          {value.map((item, index) => (
            <div className="json-line" key={index}>
              {renderJsonValue(item, depth + 1, `${path}.${index}`, onFieldClick, searchText, searchOptions, markClassName)}
              {index < value.length - 1 ? <span className="json-punctuation">,</span> : null}
            </div>
          ))}
        </div>
        <span className="json-punctuation">]</span>
      </>
    );
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="json-punctuation">{'{}'}</span>;

    return (
      <>
        <span className="json-punctuation">{'{'}</span>
        <div className="json-indent" data-depth={depth % GUIDE_COLOR_COUNT}>
          {entries.map(([key, item], index) => (
            <div className="json-line" key={key}>
              <button
                className="json-key json-key-button"
                type="button"
                onClick={(event) => onFieldClick(`${path}.${key}`, item, event)}
                title="Copy field value"
              >
                "{highlightSearchText(key, searchText, searchOptions, markClassName)}"
              </button>
              <span className="json-punctuation">: </span>
              {renderJsonValue(item, depth + 1, `${path}.${key}`, onFieldClick, searchText, searchOptions, markClassName)}
              {index < entries.length - 1 ? <span className="json-punctuation">,</span> : null}
            </div>
          ))}
        </div>
        <span className="json-punctuation">{'}'}</span>
      </>
    );
  }

  if (typeof value === 'string') {
    return (
      <span className="json-string">
        "{highlightSearchText(value, searchText, searchOptions, markClassName)}"
      </span>
    );
  }

  if (typeof value === 'number') {
    return (
      <span className="json-number">{highlightSearchText(String(value), searchText, searchOptions, markClassName)}</span>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <span className="json-boolean">{highlightSearchText(String(value), searchText, searchOptions, markClassName)}</span>
    );
  }

  if (value === null) {
    return <span className="json-null">null</span>;
  }

  return (
    <span className="json-string">
      "{highlightSearchText(String(value), searchText, searchOptions, markClassName)}"
    </span>
  );
}

function coerceJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return value;

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  return value;
}

function formatCopyValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function formatCopyString(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === null || value === undefined) return String(value);
  return JSON.stringify(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const result = document.execCommand('copy');
    document.body.removeChild(textarea);
    return result;
  } catch {
    return false;
  }
}
