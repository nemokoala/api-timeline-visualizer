import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ApiRequest } from '../../types/network';
import { DetailSection } from '../shared/DetailSection';
import { DefinitionList } from '../shared/DefinitionList';
import { generateCurl, generateFetch } from '../../utils/requestCodeSnippets';
import { canResendRequest, resendRequest } from '../../utils/requestResend';
import { getMatchingDetailSections } from '../../utils/requestSearch';
import { requestCookieValue, responseCookieValue } from '../../utils/requestCookies';
import { scrollSearchHitIntoView } from '../../utils/searchScroll';
import { useSearchOptions } from '../../contexts/SearchOptionsContext';
import { highlightSearchText } from '../../utils/searchHighlight';
import { getImageSource } from '../../utils/imageSource';
import { formatDateTime, formatDuration, formatLocaleDateTime } from '../../utils/formatters';
import { ImagePreview } from '../shared/ImagePreview';
import { DetailPanelCloseButton, SplitLayoutToggleButton } from '../shared/DetailPanelCloseButton';
import { JsonViewer } from '../shared/JsonViewer';
import { Button, IconButton } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import { MethodBadge } from './MethodBadge';

type RequestDetailPanelProps = {
  request: ApiRequest;
  isBodyLoading: boolean;
  searchText: string;
  searchOccurrenceIndex: number;
  searchFocusKey: string;
  isStacked: boolean;
  /** 같은 엔드포인트의 다른 응답 수(비교 후보). 0이면 Compare 비활성. */
  compareCandidateCount: number;
  onCompareResponses: () => void;
  onLoadResponseBody: (requestId: string) => void;
  onToggleLayout: () => void;
  onClose: () => void;
};

export function RequestDetailPanel({
  request,
  isBodyLoading,
  searchText,
  searchOccurrenceIndex,
  searchFocusKey,
  isStacked,
  compareCandidateCount,
  onCompareResponses,
  onLoadResponseBody,
  onToggleLayout,
  onClose,
}: RequestDetailPanelProps) {
  const searchOptions = useSearchOptions();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!searchText.trim() || !request) return;

    const frameId = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;

      const marks = panel.querySelectorAll('.search-highlight');
      marks.forEach((mark, index) => {
        mark.classList.toggle('is-active', index === searchOccurrenceIndex);
      });

      const target = marks[searchOccurrenceIndex] ?? marks[0];
      if (!target) return;

      scrollSearchHitIntoView(target);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [request, searchFocusKey, searchOccurrenceIndex, searchText]);

  const hasSearch = Boolean(searchText.trim());
  const matchingSections = useMemo(() => {
    if (!request || !hasSearch) return new Set<string>();
    return getMatchingDetailSections(request, searchText, searchOptions);
    // Body load updates should not re-open collapsed sections.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by selection/search navigation only
  }, [hasSearch, searchText, searchFocusKey, request?.id, searchOptions]);

  const titleImageSource =
    getImageSource(request.normalizedPath) ?? getImageSource(request.path) ?? getImageSource(request.url);
  const title = titleImageSource ? 'Image payload' : request.normalizedPath;
  const displayUrl = titleImageSource ? summarizeImageUrl(request.url) : request.url;
  const canOpenInNewTab =
    request.type === 'media' || /^(video|audio)\//.test(request.mimeType ?? '');
  const hasQueryParams = Object.keys(request.queryParams ?? {}).length > 0;
  const responseBodyValue = request.responsePreview ?? request.responseContent;
  const isBodyPending = responseBodyValue === undefined;
  const showLoadingOverlay = isBodyPending || (isBodyLoading && request.responseContent === undefined);

  const titleClass =
    'line-clamp-2 text-[13px] font-bold leading-[1.3] tracking-[-0.01em] text-ink-strong [overflow-wrap:anywhere]';

  return (
    <aside
      className="h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto bg-surface pb-[30px] [scrollbar-gutter:stable]"
      ref={panelRef}
    >
      <div className="sticky top-0 z-[1] flex max-h-[120px] justify-between gap-2.5 overflow-hidden border-b border-line-weak bg-surface p-3.5">
        <div className="min-w-0">
          <MethodBadge method={request.method} size="sm" />
          {titleImageSource ? (
            <div className="mt-1.5 grid grid-cols-[38px_minmax(0,1fr)] items-center gap-2">
              <ImagePreview
                src={titleImageSource}
                alt="Base64 request preview"
                className="block h-12 w-12 rounded-lg border border-line-weak bg-fill object-contain"
              />
              <h2 className={`m-0 ${titleClass}`}>
                {hasSearch ? highlightSearchText(title, searchText, searchOptions) : title}
              </h2>
            </div>
          ) : (
            <h2 className={`mx-0 mt-1.5 mb-0.5 ${titleClass}`}>
              {hasSearch ? highlightSearchText(title, searchText, searchOptions) : title}
            </h2>
          )}
          <p className="m-0 text-[11px] text-ink-weak">
            {hasSearch ? highlightSearchText(request.host, searchText, searchOptions) : request.host}
          </p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <span
            className={`text-[15px] font-bold ${request.status >= 400 ? 'text-danger-bg' : 'text-ok'}`}
          >
            {request.status || 'n/a'}
          </span>
          {canOpenInNewTab ? (
            <IconButton
              size="md"
              aria-label="새 탭에서 열기"
              title="새 탭에서 열기"
              onClick={() => window.open(request.url, '_blank', 'noopener,noreferrer')}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </IconButton>
          ) : null}
          <SplitLayoutToggleButton isStacked={isStacked} onClick={onToggleLayout} />
          <DetailPanelCloseButton onClick={onClose} label="Close request detail" />
        </div>
      </div>

      <DetailSection
        sectionId="general"
        title="General"
        defaultOpen
        searchExpandToken={searchFocusKey}
        expandForSearch={matchingSections.has('general')}
      >
        <HighlightedDefinitionList
          searchText={searchText}
          rows={[
            ['Full URL', displayUrl],
            ['Status', `${request.status || 'n/a'} ${request.statusText ?? ''}`.trim()],
            ['Duration', formatDuration(request.duration)],
            ['Started', formatDateTime(request.startedAt)],
            ['Type', request.type],
            ['MIME', request.mimeType ?? 'unknown'],
          ]}
        />
      </DetailSection>

      <DetailSection
        sectionId="headers"
        title="Headers"
        searchExpandToken={searchFocusKey}
        expandForSearch={matchingSections.has('headers')}
      >
        <SectionHeading>Request</SectionHeading>
        <JsonViewer value={request.requestHeaders ?? {}} searchText={searchText} searchFocusKey={searchFocusKey} />
        <SectionHeading>Response</SectionHeading>
        <JsonViewer value={request.responseHeaders ?? {}} searchText={searchText} searchFocusKey={searchFocusKey} />
      </DetailSection>

      <DetailSection
        sectionId="cookies"
        title="Cookies"
        searchExpandToken={searchFocusKey}
        expandForSearch={matchingSections.has('cookies')}
      >
        <SectionHeading>Request</SectionHeading>
        <JsonViewer value={requestCookieValue(request)} searchText={searchText} searchFocusKey={searchFocusKey} />
        <SectionHeading>Response</SectionHeading>
        <JsonViewer value={responseCookieValue(request)} searchText={searchText} searchFocusKey={searchFocusKey} />
      </DetailSection>

      <DetailSection
        sectionId="payload"
        title="Payload"
        searchExpandToken={searchFocusKey}
        expandForSearch={matchingSections.has('payload')}
      >
        {hasQueryParams ? (
          <>
            <SectionHeading>Query Params</SectionHeading>
            <JsonViewer value={request.queryParams ?? {}} searchText={searchText} searchFocusKey={searchFocusKey} />
          </>
        ) : null}
        <SectionHeading>Request Body</SectionHeading>
        <JsonViewer
          value={request.requestBody ?? 'Request payload is not available for this request.'}
          searchText={searchText}
          searchFocusKey={searchFocusKey}
        />
      </DetailSection>

      <DetailSection
        sectionId="response"
        title="Response"
        defaultOpen
        searchExpandToken={searchFocusKey}
        expandForSearch={matchingSections.has('response')}
      >
        <div className="mb-2 flex justify-end gap-1.5">
          <Button
            onClick={() => onLoadResponseBody(request.id)}
            disabled={isBodyLoading || isBodyPending}
          >
            {isBodyLoading || isBodyPending
              ? 'Loading...'
              : request.responseContent === undefined
                ? 'Load body'
                : 'Reload body'}
          </Button>
          <Button
            onClick={onCompareResponses}
            disabled={compareCandidateCount === 0}
            title={
              compareCandidateCount > 0
                ? `같은 엔드포인트의 다른 응답 ${compareCandidateCount}개와 비교`
                : '같은 엔드포인트로 캡처된 다른 응답이 없습니다.'
            }
          >
            Compare{compareCandidateCount > 0 ? ` (${compareCandidateCount})` : ''}
          </Button>
        </div>
        <div className={`response-json-slot relative shrink-0 ${showLoadingOverlay ? 'is-loading' : ''}`}>
          <div
            className={`pointer-events-none absolute inset-0 z-[2] flex items-center justify-center text-[12px] text-ink-weak transition-opacity duration-[120ms] ${
              showLoadingOverlay ? 'opacity-100' : 'opacity-0'
            }`}
            aria-live="polite"
            aria-hidden={!showLoadingOverlay}
          >
            Loading response body...
          </div>
          {responseBodyValue !== undefined ? (
            <JsonViewer
              instanceId={request.id}
              value={responseBodyValue}
              mimeType={request.mimeType}
              searchText={searchText}
              searchFocusKey={searchFocusKey}
            />
          ) : (
            <ResponseBodySkeleton />
          )}
        </div>
      </DetailSection>

      <DetailSection
        sectionId="timing"
        title="Timing"
        searchExpandToken={searchFocusKey}
        expandForSearch={matchingSections.has('timing')}
      >
        <HighlightedDefinitionList
          searchText={searchText}
          rows={[
            ['Started at', formatLocaleDateTime(request.startedAt)],
            ['Ended at', formatLocaleDateTime(request.endedAt)],
            ['Duration', `${request.duration}ms`],
          ]}
        />
      </DetailSection>

      <DetailSection
        sectionId="replay"
        title="Replay"
        searchExpandToken={searchFocusKey}
        expandForSearch={matchingSections.has('replay')}
      >
        <CodeSnippetBlock request={request} searchText={searchText} />
      </DetailSection>
    </aside>
  );
}

/** DetailSection 본문 안의 소제목(Request/Response 등). */
function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mx-0 mt-3 mb-[7px] text-[12px] font-semibold text-ink-weak first:mt-0">
      {children}
    </h3>
  );
}

function ResponseBodySkeleton() {
  return (
    <div className="json-viewer-wrap response-json-skeleton" aria-hidden="true">
      <div className="pointer-events-none min-h-[38px] rounded-t-[11px] border-b border-line-weak bg-surface-sub" />
      <div className="json-viewer-body">
        <pre className="json-viewer" />
      </div>
    </div>
  );
}

function summarizeImageUrl(url: string): string {
  const mimeMatch = url.match(/(?:data:)?(image\/[a-z0-9.+-]+);base64,/i);
  if (!mimeMatch) return url;
  return `${mimeMatch[1]} base64 image data`;
}

function HighlightedDefinitionList({
  rows,
  searchText,
}: {
  rows: Array<[string, string]>;
  searchText: string;
}) {
  const searchOptions = useSearchOptions();
  const hasSearch = Boolean(searchText.trim());

  return (
    <DefinitionList
      rows={rows.map(([label, value]) => [
        label,
        hasSearch ? highlightSearchText(value, searchText, searchOptions) : value,
      ])}
    />
  );
}

type SnippetMode = 'curl' | 'fetch';
type ResendState = 'idle' | 'sending' | 'sent' | 'failed';

function CodeSnippetBlock({ request, searchText }: { request: ApiRequest; searchText: string }) {
  const searchOptions = useSearchOptions();
  const [mode, setMode] = useState<SnippetMode>('curl');
  const [copied, setCopied] = useState(false);
  const [resendState, setResendState] = useState<ResendState>('idle');
  const [resendError, setResendError] = useState<string | null>(null);
  const snippet = mode === 'curl' ? generateCurl(request) : generateFetch(request);
  const hasSearch = Boolean(searchText.trim());
  const resendable = canResendRequest(request);

  // 다른 요청을 선택하면 이전 재전송 상태를 지운다.
  useEffect(() => {
    setResendState('idle');
    setResendError(null);
  }, [request.id]);

  const handleCopy = async () => {
    const didCopy = await copyToClipboard(snippet);
    if (!didCopy) return;

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const handleResend = async () => {
    if (resendState === 'sending') return;
    setResendState('sending');
    setResendError(null);
    const outcome = await resendRequest(request);
    if (outcome.ok) {
      setResendState('sent');
      window.setTimeout(() => setResendState('idle'), 2000);
    } else {
      setResendState('failed');
      setResendError(outcome.error);
    }
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <SegmentedControl
          size="sm"
          ariaLabel="Replay snippet type"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'curl', label: 'cURL' },
            { value: 'fetch', label: 'fetch' },
          ]}
        />
        <div className="flex items-center gap-1.5">
          <Button onClick={() => void handleCopy()}>{copied ? 'Copied' : 'Copy'}</Button>
          <Button
            tone="accent"
            onClick={() => void handleResend()}
            disabled={!resendable || resendState === 'sending'}
            title={
              resendable
                ? '검사 대상 페이지에서 이 요청을 다시 보냅니다. 재전송된 요청은 목록에 새 항목으로 잡힙니다.'
                : '이 요청 유형은 재전송할 수 없습니다.'
            }
          >
            {resendState === 'sending' ? 'Sending…' : resendState === 'sent' ? 'Sent ✓' : 'Resend'}
          </Button>
        </div>
      </div>
      {resendState === 'failed' && resendError ? (
        <p className="mt-1.5 mb-0 rounded-[10px] bg-danger-soft px-2.5 py-[5px] text-[11px] text-danger" role="alert">
          재전송 실패: {resendError}
        </p>
      ) : null}
      <pre className="m-0 max-h-[220px] overflow-auto whitespace-pre-wrap rounded-xl border border-line-weak bg-surface-sub px-3 py-2.5 text-[11px] leading-[1.55] text-ink [font-family:SFMono-Regular,Consolas,'Liberation_Mono',monospace] [overflow-wrap:anywhere]">
        {hasSearch ? highlightSearchText(snippet, searchText, searchOptions) : snippet}
      </pre>
    </div>
  );
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
