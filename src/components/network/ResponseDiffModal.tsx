import { useEffect, useMemo, useState } from 'react';
import type { ApiRequest } from '../../types/network';
import { buildJsonDiff } from '../../utils/jsonDiff';
import { formatDateTime, getStatusTone } from '../../utils/formatters';
import { Button } from '../ui/Button';
import { Select } from '../ui/Input';
import { DetailPanelCloseButton } from '../shared/DetailPanelCloseButton';
import { useBackdropDismiss } from '../../hooks/useBackdropDismiss';
import { displayPath } from '../../utils/normalizeUrl';
import { useT } from '../../i18n';

type ResponseDiffModalProps = {
  /** 비교 기준(현재 선택된) 요청. diff의 오른쪽(신규)에 놓인다. */
  baseRequest: ApiRequest;
  /** 같은 엔드포인트의 비교 후보들(기준 요청 제외). */
  candidates: ApiRequest[];
  /** 경로의 ID·날짜·해시를 `:id` 등으로 접어 표시할지. */
  collapsePathIds: boolean;
  /** 응답 본문 지연 로드(이미 로드됐으면 no-op). */
  onEnsureBody: (requestId: string) => void;
  onClose: () => void;
};

/**
 * 같은 엔드포인트를 두 번 이상 호출했을 때 두 응답을 구조적 diff로 비교하는 모달.
 * 왼쪽 = 선택한 비교 대상(구), 오른쪽 = 현재 요청(신) 기준으로 -/+를 표시한다.
 */
export function ResponseDiffModal({
  baseRequest,
  candidates,
  collapsePathIds,
  onEnsureBody,
  onClose,
}: ResponseDiffModalProps) {
  const t = useT();
  // 기본 비교 대상: 기준 요청보다 먼저 시작한 것 중 가장 최근. 없으면 첫 후보.
  const defaultCandidateId = useMemo(() => {
    const earlier = candidates.filter((item) => item.startedAt <= baseRequest.startedAt);
    const pick = earlier.length ? earlier[earlier.length - 1] : candidates[0];
    return pick?.id ?? null;
  }, [baseRequest.startedAt, candidates]);
  const [compareId, setCompareId] = useState<string | null>(defaultCandidateId);

  const compareRequest = candidates.find((item) => item.id === compareId) ?? null;

  // 두 응답 본문이 아직 로드 전이면 로드를 걸어 둔다(로드되면 요청 목록이 갱신돼 재렌더).
  useEffect(() => {
    onEnsureBody(baseRequest.id);
  }, [baseRequest.id, onEnsureBody]);
  useEffect(() => {
    if (compareRequest) onEnsureBody(compareRequest.id);
  }, [compareRequest, onEnsureBody]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const backdropDismiss = useBackdropDismiss(onClose);

  const leftValue = compareRequest ? getComparableResponse(compareRequest) : undefined;
  const rightValue = getComparableResponse(baseRequest);
  const isLoading =
    (compareRequest && leftValue === undefined) || rightValue === undefined;

  const diff = useMemo(() => {
    if (isLoading || !compareRequest) return null;
    return buildJsonDiff(leftValue, rightValue);
  }, [compareRequest, isLoading, leftValue, rightValue]);

  const statusMessage = isLoading
    ? t('responseDiff.loading')
    : !diff
      ? t('responseDiff.noRequest')
      : diff.addedCount === 0 && diff.removedCount === 0
        ? t('responseDiff.identical')
        : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-backdrop p-7"
      role="presentation"
      {...backdropDismiss}
    >
      <section
        className="flex max-h-full w-[min(880px,100%)] flex-col overflow-hidden rounded-2xl border border-line-weak bg-surface shadow-float"
        role="dialog"
        aria-modal="true"
        aria-label="Compare responses"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2.5">
          <div className="min-w-0">
            <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[10px] leading-[1.2] text-ink-weak">
              Compare responses
            </span>
            <h2 className="m-0 mt-1 flex items-center gap-2 text-sm [overflow-wrap:anywhere]">
              <span className={`method method-${baseRequest.method.toLowerCase()}`}>
                {baseRequest.method}
              </span>
              {displayPath(baseRequest, collapsePathIds)}
            </h2>
          </div>
          <DetailPanelCloseButton onClick={onClose} label="Close response diff" />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 px-4 pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex-none text-[11px] font-bold text-danger">{t('responseDiff.compareTarget')}</span>
            <Select
              value={compareId ?? ''}
              onChange={(event) => setCompareId(event.currentTarget.value)}
              aria-label={t('responseDiff.selectRequest')}
            >
              {candidates.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatDateTime(item.startedAt)} · {item.status || 'n/a'}
                </option>
              ))}
            </Select>
          </div>
          <span className="text-ink-weak" aria-hidden="true">
            →
          </span>
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex-none text-[11px] font-bold text-ok">{t('responseDiff.currentRequest')}</span>
            <span className="text-xs text-ink-sub">
              {formatDateTime(baseRequest.startedAt)} ·{' '}
              <span className={`flow-status ${getStatusTone(baseRequest.status)}`}>
                {baseRequest.status || 'n/a'}
              </span>
            </span>
          </div>
          {diff ? (
            <span className="ml-auto flex gap-2 text-xs font-bold" aria-label={t('responseDiff.changeSummary')}>
              <span className="text-ok">+{diff.addedCount}</span>
              <span className="text-danger">−{diff.removedCount}</span>
            </span>
          ) : null}
        </div>

        <div
          className="min-h-40 flex-1 overflow-auto border-t border-line-weak bg-surface-sub"
          role="region"
          aria-label="Response diff"
        >
          {statusMessage ? (
            <p className="m-0 px-4 py-[18px] text-xs text-ink-sub">{statusMessage}</p>
          ) : diff ? (
            <pre className="m-0 py-2.5 font-mono text-[11px] leading-[1.6]">
              {diff.lines.map((line, index) => (
                <div
                  key={index}
                  className={`flex px-3.5 whitespace-pre-wrap [overflow-wrap:anywhere] ${
                    line.type === 'added'
                      ? 'bg-[rgba(2,178,108,0.09)] text-ok'
                      : line.type === 'removed'
                        ? 'bg-[rgba(240,68,82,0.08)] text-danger'
                        : ''
                  }`}
                >
                  <span className="w-3.5 flex-none select-none" aria-hidden="true">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
                  </span>
                  <span style={{ paddingLeft: line.depth * 14 }}>{line.text}</span>
                </div>
              ))}
            </pre>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-line-weak px-4 py-2.5">
          <Button onClick={onClose}>Close</Button>
        </div>
      </section>
    </div>
  );
}

/**
 * diff에 사용할 응답 값. 파싱된 미리보기(responsePreview)를 우선 쓰고,
 * 없으면 원문 문자열을 그대로 비교한다. 본문 미로드면 undefined.
 */
function getComparableResponse(request: ApiRequest): unknown {
  if (request.responsePreview !== undefined) return request.responsePreview;
  return request.responseContent;
}
