import type { HarTimings } from '../types/chrome-har';
import type { RequestTimingPhase, RequestTimings } from '../types/network';

// HAR 타이밍 구간 순서: 연결 대기(blocked)→DNS→연결→SSL→전송→서버 대기→수신.
const PHASE_ORDER: RequestTimingPhase[] = [
  'blocked',
  'dns',
  'connect',
  'ssl',
  'send',
  'wait',
  'receive',
];

/** 구간별 라벨과 색(라이트/다크 공용 토큰). 상세 패널·타임라인이 공유한다. */
export const TIMING_PHASE_META: Record<RequestTimingPhase, { label: string; color: string }> = {
  blocked: { label: 'Blocked', color: 'bg-ink-weak' },
  dns: { label: 'DNS', color: 'bg-purple' },
  connect: { label: 'Connect', color: 'bg-warn-bg' },
  ssl: { label: 'SSL', color: 'bg-pink' },
  send: { label: 'Send', color: 'bg-teal' },
  wait: { label: 'Wait', color: 'bg-accent' },
  receive: { label: 'Receive', color: 'bg-ok-bg' },
};

/**
 * HAR 스펙상 ssl 시간은 connect 안에 포함된다(HAR 1.1 호환을 위해 중첩으로 정의됐고,
 * time 총합에도 ssl이 따로 더해지지 않는다). 두 구간을 나란히 그리려면 겹치는 만큼
 * connect에서 빼야 connect 구간이 부풀지 않는다.
 */
function unnestSslFromConnect(timings: HarTimings): HarTimings {
  const { connect, ssl } = timings;
  if (typeof connect !== 'number' || typeof ssl !== 'number') return timings;
  if (connect <= 0 || ssl <= 0 || ssl > connect) return timings;

  return { ...timings, connect: connect - ssl };
}

/**
 * HAR request.timings를 화면용 구간 목록으로 정규화한다.
 * -1(해당 없음)·음수·0·누락 구간은 버리고, 남은 구간 합이 duration(총 소요)을
 * 넘지 않도록 자른다(HAR은 구간 합과 time이 어긋나는 경우가 흔하다).
 * 쓸 만한 구간이 없으면 undefined를 돌려 기존 단일 바 렌더로 되돌아간다.
 */
export function normalizeTimings(
  timings: HarTimings | undefined,
  duration: number,
): RequestTimings | undefined {
  if (!timings) return undefined;

  const unnested = unnestSslFromConnect(timings);
  let remaining = Math.max(0, Math.round(duration));
  const segments: RequestTimings['segments'] = [];

  for (const phase of PHASE_ORDER) {
    const raw = unnested[phase];
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) continue;
    const value = Math.min(Math.round(raw), remaining);
    if (value <= 0) break; // 남은 예산이 없으면 이후 구간은 그리지 않는다.
    segments.push({ phase, duration: value });
    remaining -= value;
  }

  if (!segments.length) return undefined;
  return { segments };
}

/** 타임라인 바 호버 툴팁용 요약("Wait 200ms · Receive 40ms"). */
export function formatTimingTooltip(timings: RequestTimings): string {
  return timings.segments
    .map((segment) => `${TIMING_PHASE_META[segment.phase].label} ${segment.duration}ms`)
    .join(' · ');
}
