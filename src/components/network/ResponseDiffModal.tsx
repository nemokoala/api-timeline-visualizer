import { useEffect, useMemo, useState } from 'react';
import type { ApiRequest } from '../../types/network';
import { buildJsonDiff } from '../../utils/jsonDiff';
import { formatDateTime, getStatusTone } from '../../utils/formatters';
import { Button } from '../ui/Button';
import { DetailPanelCloseButton } from '../shared/DetailPanelCloseButton';

type ResponseDiffModalProps = {
  /** 비교 기준(현재 선택된) 요청. diff의 오른쪽(신규)에 놓인다. */
  baseRequest: ApiRequest;
  /** 같은 엔드포인트의 비교 후보들(기준 요청 제외). */
  candidates: ApiRequest[];
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
  onEnsureBody,
  onClose,
}: ResponseDiffModalProps) {
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

  const leftValue = compareRequest ? getComparableResponse(compareRequest) : undefined;
  const rightValue = getComparableResponse(baseRequest);
  const isLoading =
    (compareRequest && leftValue === undefined) || rightValue === undefined;

  const diff = useMemo(() => {
    if (isLoading || !compareRequest) return null;
    return buildJsonDiff(leftValue, rightValue);
  }, [compareRequest, isLoading, leftValue, rightValue]);

  return (
    <div className="diff-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="diff-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Compare responses"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="diff-modal-header">
          <div>
            <span className="detail-kicker">Compare responses</span>
            <h2>
              <span className={`method method-${baseRequest.method.toLowerCase()}`}>
                {baseRequest.method}
              </span>
              {baseRequest.normalizedPath}
            </h2>
          </div>
          <DetailPanelCloseButton onClick={onClose} label="Close response diff" />
        </div>

        <div className="diff-modal-controls">
          <div className="diff-side">
            <span className="diff-side-label removed">− 비교 대상</span>
            <select
              className="input input-md"
              value={compareId ?? ''}
              onChange={(event) => setCompareId(event.currentTarget.value)}
              aria-label="비교할 요청 선택"
            >
              {candidates.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatDateTime(item.startedAt)} · {item.status || 'n/a'}
                </option>
              ))}
            </select>
          </div>
          <span className="diff-arrow" aria-hidden="true">
            →
          </span>
          <div className="diff-side">
            <span className="diff-side-label added">+ 현재 요청</span>
            <span className="diff-side-meta">
              {formatDateTime(baseRequest.startedAt)} ·{' '}
              <span className={`flow-status ${getStatusTone(baseRequest.status)}`}>
                {baseRequest.status || 'n/a'}
              </span>
            </span>
          </div>
          {diff ? (
            <span className="diff-counts" aria-label="변경 요약">
              <span className="added">+{diff.addedCount}</span>
              <span className="removed">−{diff.removedCount}</span>
            </span>
          ) : null}
        </div>

        <div className="diff-viewer" role="region" aria-label="Response diff">
          {isLoading ? (
            <p className="diff-status">응답 본문을 불러오는 중…</p>
          ) : !diff ? (
            <p className="diff-status">비교할 요청이 없습니다.</p>
          ) : diff.addedCount === 0 && diff.removedCount === 0 ? (
            <p className="diff-status">두 응답이 동일합니다.</p>
          ) : (
            <pre>
              {diff.lines.map((line, index) => (
                <div key={index} className={`diff-line ${line.type}`}>
                  <span className="diff-sign" aria-hidden="true">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
                  </span>
                  <span style={{ paddingLeft: line.depth * 14 }}>{line.text}</span>
                </div>
              ))}
            </pre>
          )}
        </div>

        <div className="diff-modal-footer">
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
