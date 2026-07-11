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
// 이 파일엔 복사할 문자열을 담은 지역 변수 copyText가 이미 있어 별칭으로 받는다.
import { copyText as copyToClipboard } from '../../utils/clipboard';
import { highlightSearchText, textMatchesSearch, type SearchOptions } from '../../utils/searchHighlight';
import { scrollSearchHitIntoView } from '../../utils/searchScroll';
import { getImagePreviews, mergeBlobPreviewItems, type ImagePreviewItem } from '../../utils/imageSource';
import { fetchStorageRecordBlobPreviews } from '../../utils/storageInspector';
import { findStorageBlobPreviews, sanitizeStorageBlobsForDisplay } from '../../utils/storageBlobValue';
import { DetailSection } from './DetailSection';
import { ImagePreviewGallery } from './ImagePreviewGallery';
import { Button, IconButton } from '../ui/Button';
import { Input } from '../ui/Input';
import { MenuCheckItem, MenuSurface } from '../ui/Menu';
import { SearchOptionToggles } from '../ui/SearchOptionToggles';
import { cn } from '../../utils/cn';
import { useT } from '../../i18n';
import { useJsonViewPrefs } from '../../hooks/useJsonViewPrefs';
import type { JsonViewPrefs } from '../../utils/jsonViewPrefs';

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
      <div>
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
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [fieldMenu, setFieldMenu] = useState<ActiveFieldMenu>(null);
  const [settingsMenu, setSettingsMenu] = useState<{ top: number; left: number } | null>(null);
  const [jsonViewPrefs] = useJsonViewPrefs();
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
    setSettingsMenu(null);
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

  // 뷰어 본문 우클릭으로 표시 옵션(가이드선·무지개색) 설정 팝오버를 커서 위치에 연다.
  const handleBodyContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setSettingsMenu({ top: event.clientY, left: event.clientX });
  };

  return (
    <>
      {isFullscreen ? (
        <div
          className="fixed inset-0 z-[999] bg-backdrop"
          onClick={() => setIsFullscreen(false)}
          aria-hidden="true"
        />
      ) : null}
      <div
        ref={wrapRef}
        className={`json-viewer-wrap${isFullscreen ? ' is-fullscreen' : ''}${appliedHeight != null ? ' is-resized' : ''}`}
        style={wrapStyle}
        role={isFullscreen ? 'dialog' : undefined}
        aria-modal={isFullscreen ? true : undefined}
        aria-label={isFullscreen ? 'JSON fullscreen' : undefined}
      >
        <div
          className={`flex min-h-[38px] items-center justify-end gap-2 rounded-t-[11px] border-b border-line-weak px-3 py-[7px] ${
            isFullscreen ? 'bg-surface' : 'bg-surface-sub'
          }`}
        >
          <div className="flex min-w-0 flex-auto items-center gap-1.5">
            <Input
              type="search"
              size="sm"
              className="w-full max-w-[240px] flex-auto"
              placeholder="Search in this viewer"
              value={localSearch}
              onChange={(event) => setLocalSearch(event.target.value)}
              onKeyDown={handleLocalSearchKeyDown}
              spellCheck={false}
            />
            <SearchOptionToggles
              className="flex shrink-0 items-center gap-0.5"
              matchCase={localMatchCase}
              wholeWord={localWholeWord}
              onMatchCaseChange={setLocalMatchCase}
              onWholeWordChange={setLocalWholeWord}
            />
            {localActive ? (
              <>
                <span className="shrink-0 whitespace-nowrap text-[11px] text-ink-sub tabular-nums">
                  {shownHitOrder}/{localHitCount}
                </span>
                <IconButton
                  tone="accent"
                  onClick={() => goToLocalHit(-1)}
                  disabled={localHitCount === 0}
                  aria-label={t('jsonViewer.prevMatch')}
                  title={t('jsonViewer.prevMatchTitle')}
                >
                  ↑
                </IconButton>
                <IconButton
                  tone="accent"
                  onClick={() => goToLocalHit(1)}
                  disabled={localHitCount === 0}
                  aria-label={t('jsonViewer.nextMatch')}
                  title={t('jsonViewer.nextMatchTitle')}
                >
                  ↓
                </IconButton>
              </>
            ) : null}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {/* 전체화면은 모달 대신 화면을 가득 채우는 플로팅 패널(pop out)로 연다.
                워크스페이스 컨텍스트가 없을 때만 기존 모달로 폴백한다. */}
            <Button
              size="sm"
              tone="accent"
              onClick={() =>
                onOpenPanel ? onOpenPanel(value, { fullscreen: true }) : setIsFullscreen((current) => !current)
              }
              title={onOpenPanel ? t('jsonViewer.openFullscreen') : undefined}
            >
              {isFullscreen ? 'Close' : 'Fullscreen'}
            </Button>
            <Button size="sm" tone="accent" onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
        <div className="json-viewer-body" ref={viewerBodyRef} onContextMenu={handleBodyContextMenu}>
          {fieldMenu ? (
            <div
              className="absolute z-[3] inline-flex gap-1 rounded-[9px] border border-line-weak bg-surface p-[3px] shadow-float [transform:translateY(calc(-100%-6px))]"
              style={{ left: fieldMenu.left, top: fieldMenu.top }}
            >
              <FieldMenuButton onClick={() => handleFieldCopy('value')}>{t('jsonViewer.copyValue')}</FieldMenuButton>
              <FieldMenuButton onClick={() => handleFieldCopy('string')}>{t('jsonViewer.copyString')}</FieldMenuButton>
              <FieldMenuButton onClick={() => setFieldMenu(null)} aria-label="Close field copy menu">
                ×
              </FieldMenuButton>
            </div>
          ) : null}
          {isObject ? (
            <div className="json-viewer text-ink">
              {renderJsonValue(value, 0, 'root', handleFieldClick, effectiveSearch, effectiveOptions, markClassName, jsonViewPrefs)}
            </div>
          ) : (
            <pre className="json-viewer">
              {highlightSearchText(copyText, effectiveSearch, effectiveOptions, markClassName)}
            </pre>
          )}
        </div>
        {settingsMenu ? (
          <JsonViewSettingsMenu
            top={settingsMenu.top}
            left={settingsMenu.left}
            onClose={() => setSettingsMenu(null)}
          />
        ) : null}
        {!isFullscreen ? (
          <div
            className="flex h-[9px] shrink-0 cursor-ns-resize touch-none items-center justify-center rounded-b-[11px] border-t border-line-weak bg-surface-sub before:h-[2px] before:w-7 before:rounded-full before:bg-ink-sub before:opacity-35 before:content-[''] hover:before:opacity-70"
            onPointerDown={handleResizeStart}
            onDoubleClick={() => setCustomHeight(null)}
            role="separator"
            aria-orientation="horizontal"
            aria-label={t('jsonViewer.resizeAria')}
            title={t('jsonViewer.resizeTitle')}
          />
        ) : null}
      </div>
    </>
  );
}

// 들여쓰기 가이드선 색상 개수. 이 수를 주기로 depth별 색이 순환한다. (global.css의 --json-guide-N과 일치)
const GUIDE_COLOR_COUNT = 6;

/* 레벨마다 다른 색(무지개)으로 어느 선인지 구분하기 쉽게 한다. */
const GUIDE_BORDER = [
  'border-[color:var(--json-guide-0)]',
  'border-[color:var(--json-guide-1)]',
  'border-[color:var(--json-guide-2)]',
  'border-[color:var(--json-guide-3)]',
  'border-[color:var(--json-guide-4)]',
  'border-[color:var(--json-guide-5)]',
];

// 중첩 블록의 들여쓰기 래퍼 클래스. 가이드선을 꺼도 pl은 남겨 중첩은 유지한다.
function guideClassName(depth: number, prefs: JsonViewPrefs): string {
  if (!prefs.indentGuide) return 'pl-[1.15em]';
  const color = prefs.rainbow ? GUIDE_BORDER[depth % GUIDE_COLOR_COUNT] : 'border-line';
  return `border-l pl-[1.15em] ${color}`;
}

/** 필드 복사 팝오버의 작은 버튼. */
function FieldMenuButton(props: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      {...props}
      className="h-[22px] cursor-pointer rounded-md border-0 bg-transparent px-[7px] text-[11px] text-ink-sub hover:bg-accent hover:text-[#fff]"
    />
  );
}

function renderJsonValue(
  value: unknown,
  depth: number,
  path: string,
  onFieldClick: (id: string, value: unknown, event: MouseEvent<HTMLButtonElement>) => void,
  searchText: string,
  searchOptions: Required<SearchOptions>,
  markClassName: string,
  guideOptions: JsonViewPrefs,
): React.ReactNode {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-ink-weak">[]</span>;

    // 각 중첩 레벨을 블록으로 감싸고 border-left로 들여쓰기 가이드선을 그린다.
    // 표시 옵션에 따라 가이드선 유무·무지개색 여부가 guideClassName에서 결정된다.
    return (
      <>
        <span className="text-ink-weak">[</span>
        <div className={guideClassName(depth, guideOptions)}>
          {value.map((item, index) => (
            <div className="whitespace-pre-wrap [overflow-wrap:anywhere]" key={index}>
              {renderJsonValue(item, depth + 1, `${path}.${index}`, onFieldClick, searchText, searchOptions, markClassName, guideOptions)}
              {index < value.length - 1 ? <span className="text-ink-weak">,</span> : null}
            </div>
          ))}
        </div>
        <span className="text-ink-weak">]</span>
      </>
    );
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-ink-weak">{'{}'}</span>;

    return (
      <>
        <span className="text-ink-weak">{'{'}</span>
        <div className={guideClassName(depth, guideOptions)}>
          {entries.map(([key, item], index) => (
            <div className="whitespace-pre-wrap [overflow-wrap:anywhere]" key={key}>
              <button
                className="cursor-pointer border-0 bg-transparent p-0 text-accent [font:inherit] hover:text-accent-strong hover:underline hover:underline-offset-2"
                type="button"
                onClick={(event) => onFieldClick(`${path}.${key}`, item, event)}
                title="Copy field value"
              >
                "{highlightSearchText(key, searchText, searchOptions, markClassName)}"
              </button>
              <span className="text-ink-weak">: </span>
              {renderJsonValue(item, depth + 1, `${path}.${key}`, onFieldClick, searchText, searchOptions, markClassName, guideOptions)}
              {index < entries.length - 1 ? <span className="text-ink-weak">,</span> : null}
            </div>
          ))}
        </div>
        <span className="text-ink-weak">{'}'}</span>
      </>
    );
  }

  if (typeof value === 'string') {
    return (
      <span className="text-json-string">
        "{highlightSearchText(value, searchText, searchOptions, markClassName)}"
      </span>
    );
  }

  if (typeof value === 'number') {
    return (
      <span className="text-json-number">{highlightSearchText(String(value), searchText, searchOptions, markClassName)}</span>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <span className="text-purple">{highlightSearchText(String(value), searchText, searchOptions, markClassName)}</span>
    );
  }

  if (value === null) {
    return <span className="text-danger-bg">null</span>;
  }

  return (
    <span className="json-string">
      "{highlightSearchText(String(value), searchText, searchOptions, markClassName)}"
    </span>
  );
}

/**
 * 툴바·리사이즈·전체화면 없이 구문 색상 트리만 그리는 최소 뷰어.
 * 콘솔 행처럼 인라인으로 펼쳐 보여줄 때 쓴다. 필드 복사 팝오버는 달지 않는다.
 */
/**
 * JSON 표시 옵션(가이드선·무지개색) 설정 팝오버. 전체 JsonViewer와 인라인 JsonTree가 공유한다.
 * 바깥 클릭·Escape로만 닫히고, 체크박스 토글은 메뉴 내부라 유지된다.
 */
function JsonViewSettingsMenu({
  top,
  left,
  onClose,
}: {
  top: number;
  left: number;
  onClose: () => void;
}) {
  const t = useT();
  const [prefs, setPrefs] = useJsonViewPrefs();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <MenuSurface ref={menuRef} style={{ top, left }} role="menu" aria-label={t('jsonViewer.displaySettings')}>
      <MenuCheckItem
        checked={prefs.indentGuide}
        onClick={() => setPrefs((prev) => ({ ...prev, indentGuide: !prev.indentGuide }))}
      >
        {t('jsonViewer.indentGuide')}
      </MenuCheckItem>
      {/* 무지개색은 가이드선이 꺼져 있으면 효과가 없어 비활성화한다. */}
      <MenuCheckItem
        checked={prefs.rainbow}
        disabled={!prefs.indentGuide}
        onClick={() => setPrefs((prev) => ({ ...prev, rainbow: !prev.rainbow }))}
      >
        {t('jsonViewer.rainbow')}
      </MenuCheckItem>
    </MenuSurface>
  );
}

export function JsonTree({
  value,
  searchText = '',
  className,
}: {
  value: unknown;
  searchText?: string;
  className?: string;
}) {
  const searchOptions = useSearchOptions();
  const [jsonViewPrefs] = useJsonViewPrefs();
  const [settingsMenu, setSettingsMenu] = useState<{ top: number; left: number } | null>(null);
  const rendered = coerceJson(value);

  if (!rendered || typeof rendered !== 'object') {
    return (
      <pre className={cn('json-viewer', className)}>
        {highlightSearchText(formatCopyValue(rendered), searchText, searchOptions)}
      </pre>
    );
  }

  return (
    <div
      className={cn('json-viewer text-ink', className)}
      // 인라인 트리는 행 안에 있어 우클릭이 행 컨텍스트 메뉴로 버블링된다.
      // stopPropagation으로 막고 JSON 표시 설정 메뉴를 대신 연다.
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setSettingsMenu({ top: event.clientY, left: event.clientX });
      }}
    >
      {renderJsonValue(rendered, 0, 'root', noopFieldClick, searchText, searchOptions, 'search-highlight', jsonViewPrefs)}
      {settingsMenu ? (
        <JsonViewSettingsMenu
          top={settingsMenu.top}
          left={settingsMenu.left}
          onClose={() => setSettingsMenu(null)}
        />
      ) : null}
    </div>
  );
}

function noopFieldClick(): void {}

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

