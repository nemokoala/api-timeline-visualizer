import { SLOW_THRESHOLD_MS } from './timeline';
import type { ApiRequest, RequestKind, TimelineItem } from '../types/network';

/** 상태 코드 묶음. no-response = 응답 없음(status 0). */
export type StatusGroupKey = 'no-response' | '2xx' | '3xx' | '4xx' | '5xx';

export type KindCount = { kind: RequestKind; count: number };

export type StatusGroupCount = { group: StatusGroupKey; count: number };

/** Top N 목록의 한 행. 클릭 시 selectRequest(requestId)로 연결한다. */
export type NetworkTopRequest = {
  requestId: string;
  method: string;
  normalizedPath: string;
  status: number;
  duration: number;
  size?: number;
};

export type NetworkSummary = {
  totalCount: number;
  /** 합산 전송량(bytes). size 미상 요청은 0으로 취급. */
  totalSize: number;
  /** size가 없어 전송량 합계에서 빠진 요청 수. */
  unknownSizeCount: number;
  /** 평균 소요(ms). 요청이 없으면 0. */
  avgDuration: number;
  /** 최대 소요(ms). */
  maxDuration: number;
  /** isSlow 요청 수(타임라인 기준). */
  slowCount: number;
  /** isError 요청 수(타임라인 기준). */
  errorCount: number;
  /** 0~1. errorCount / totalCount. */
  errorRate: number;
  /** 종류별 개수. 개수 내림차순. */
  kindCounts: KindCount[];
  /** 상태 묶음별 개수. 값이 있는 묶음만, 2xx→5xx→no-response 순. */
  statusGroups: StatusGroupCount[];
  /** 가장 느린 상위 요청. */
  topSlowest: NetworkTopRequest[];
  /** 가장 큰 상위 요청(size 알려진 것만). */
  topLargest: NetworkTopRequest[];
};

const STATUS_GROUP_ORDER: StatusGroupKey[] = ['2xx', '3xx', '4xx', '5xx', 'no-response'];

const TOP_LIMIT = 5;

function toStatusGroup(status: number): StatusGroupKey {
  if (status >= 200 && status < 300) return '2xx';
  if (status >= 300 && status < 400) return '3xx';
  if (status >= 400 && status < 500) return '4xx';
  if (status >= 500 && status < 600) return '5xx';
  return 'no-response';
}

function hasKnownSize(request: ApiRequest): boolean {
  return typeof request.size === 'number' && Number.isFinite(request.size);
}

function toTop(
  requests: ApiRequest[],
  compare: (a: ApiRequest, b: ApiRequest) => number,
): NetworkTopRequest[] {
  return [...requests]
    .sort(compare)
    .slice(0, TOP_LIMIT)
    .map((request) => ({
      requestId: request.id,
      method: request.method,
      normalizedPath: request.normalizedPath,
      status: request.status,
      duration: request.duration,
      size: request.size,
    }));
}

/**
 * 현재 표시 중인 요청 목록을 집계해 요약 통계를 만든다(순수 함수, React 무관).
 * isSlow/isError는 타임라인 계산을 재사용하고, 매칭되는 타임라인 항목이 없으면
 * 동일 기준(SLOW_THRESHOLD_MS, status>=400||error)으로 폴백한다.
 */
export function summarizeNetwork(
  requests: ApiRequest[],
  timelineItems: TimelineItem[] = [],
): NetworkSummary {
  const flagByRequest = new Map<string, { isSlow: boolean; isError: boolean }>();
  for (const item of timelineItems) {
    flagByRequest.set(item.requestId, { isSlow: item.isSlow, isError: item.isError });
  }

  let totalSize = 0;
  let unknownSizeCount = 0;
  let durationSum = 0;
  let maxDuration = 0;
  let slowCount = 0;
  let errorCount = 0;

  const kindMap = new Map<RequestKind, number>();
  const statusMap = new Map<StatusGroupKey, number>();

  for (const request of requests) {
    if (hasKnownSize(request)) {
      totalSize += request.size as number;
    } else {
      unknownSizeCount += 1;
    }

    durationSum += request.duration;
    if (request.duration > maxDuration) maxDuration = request.duration;

    kindMap.set(request.type, (kindMap.get(request.type) ?? 0) + 1);
    const group = toStatusGroup(request.status);
    statusMap.set(group, (statusMap.get(group) ?? 0) + 1);

    const flags = flagByRequest.get(request.id) ?? {
      isSlow: request.duration >= SLOW_THRESHOLD_MS,
      isError: request.status >= 400 || Boolean(request.error),
    };
    if (flags.isSlow) slowCount += 1;
    if (flags.isError) errorCount += 1;
  }

  const totalCount = requests.length;

  const kindCounts: KindCount[] = [...kindMap.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count);

  const statusGroups: StatusGroupCount[] = STATUS_GROUP_ORDER.map((group) => ({
    group,
    count: statusMap.get(group) ?? 0,
  })).filter((entry) => entry.count > 0);

  return {
    totalCount,
    totalSize,
    unknownSizeCount,
    avgDuration: totalCount ? durationSum / totalCount : 0,
    maxDuration,
    slowCount,
    errorCount,
    errorRate: totalCount ? errorCount / totalCount : 0,
    kindCounts,
    statusGroups,
    topSlowest: toTop(requests, (a, b) => b.duration - a.duration),
    topLargest: toTop(requests.filter(hasKnownSize), (a, b) => (b.size ?? 0) - (a.size ?? 0)),
  };
}
