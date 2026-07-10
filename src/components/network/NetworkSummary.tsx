import type { ReactNode } from 'react';
import type {
  NetworkSummary as NetworkSummaryData,
  NetworkTopRequest,
  StatusGroupKey,
} from '../../utils/networkStats';
import {
  formatBytes,
  formatDuration,
  getRequestKindLabel,
  REQUEST_KIND_TEXT_COLOR,
} from '../../utils/formatters';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';

type NetworkSummaryProps = {
  summary: NetworkSummaryData;
  onSelectRequest: (requestId: string) => void;
};

const STATUS_GROUP_LABEL: Record<StatusGroupKey, string> = {
  '2xx': '2xx',
  '3xx': '3xx',
  '4xx': '4xx',
  '5xx': '5xx',
  'no-response': 'No resp',
};

const STATUS_GROUP_TEXT: Record<StatusGroupKey, string> = {
  '2xx': 'text-ok',
  '3xx': 'text-accent',
  '4xx': 'text-warn',
  '5xx': 'text-danger-bg',
  'no-response': 'text-ink-weak',
};

const STATUS_GROUP_BAR: Record<StatusGroupKey, string> = {
  '2xx': 'bg-ok-bg',
  '3xx': 'bg-accent',
  '4xx': 'bg-warn-bg',
  '5xx': 'bg-danger-bg',
  'no-response': 'bg-line',
};

/** 요약 상단 통계 타일. */
function StatTile({
  label,
  value,
  sub,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-[88px] flex-auto flex-col gap-0.5 rounded-lg bg-surface-sub px-2.5 py-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-ink-faint">
        {label}
      </span>
      <span className={cn('text-[15px] font-bold leading-none tabular-nums text-ink-strong', valueClassName)}>
        {value}
      </span>
      {sub ? <span className="text-[10px] leading-none text-ink-weak">{sub}</span> : null}
    </div>
  );
}

/** 분포 한 줄: 라벨 + 비율 막대 + 개수. */
function DistributionRow({
  label,
  labelClassName,
  barClassName,
  count,
  total,
}: {
  label: string;
  labelClassName: string;
  barClassName: string;
  count: number;
  total: number;
}) {
  const percent = total > 0 ? Math.max(4, (count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className={cn('w-11 flex-none text-[10px] font-bold uppercase tracking-[0.02em]', labelClassName)}>
        {label}
      </span>
      <span className="relative block h-1.5 flex-auto overflow-hidden rounded-full bg-line-weak" aria-hidden="true">
        <span
          className={cn('absolute inset-y-0 left-0 rounded-full', barClassName)}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="w-8 flex-none text-right text-[11px] tabular-nums text-ink-weak">{count}</span>
    </div>
  );
}

/** 소제목. */
function BlockTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="m-0 text-[10px] font-bold uppercase tracking-[0.05em] text-ink-faint">{children}</h3>
  );
}

/** Top N 목록의 클릭 가능한 한 줄. */
function TopRow({
  request,
  value,
  onSelect,
}: {
  request: NetworkTopRequest;
  value: string;
  onSelect: (requestId: string) => void;
}) {
  return (
    <Button
      ghost
      size="sm"
      className="h-auto w-full justify-between gap-2 px-1.5 py-1 text-left font-normal"
      title={`${request.method} ${request.normalizedPath}`}
      onClick={() => onSelect(request.requestId)}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="flex-none text-[9px] font-bold uppercase tracking-[0.02em] text-ink-faint">
          {request.method}
        </span>
        <span className="min-w-0 truncate text-[11px] text-ink-strong">{request.normalizedPath}</span>
      </span>
      <span className="flex-none text-[11px] tabular-nums text-ink-weak">{value}</span>
    </Button>
  );
}

/** 네트워크 패널 상단의 집계 요약(통계 타일 + 분포 + Top N). */
export function NetworkSummary({ summary, onSelectRequest }: NetworkSummaryProps) {
  if (summary.totalCount === 0) {
    return (
      <section className="shrink-0 border-b border-line-weak bg-surface" aria-label="Network summary">
        <p className="m-0 px-3 py-3 text-[12px] text-ink-weak">표시할 요청이 없습니다.</p>
      </section>
    );
  }

  const { totalCount } = summary;

  return (
    <section
      className="max-h-[280px] shrink-0 overflow-y-auto border-b border-line-weak bg-surface"
      aria-label="Network summary"
    >
      <div className="flex flex-col gap-3 p-3">
        <div className="flex flex-wrap gap-2">
          <StatTile label="Requests" value={totalCount} />
          <StatTile
            label="Transfer"
            value={formatBytes(summary.totalSize)}
            sub={summary.unknownSizeCount > 0 ? `${summary.unknownSizeCount} unknown` : undefined}
          />
          <StatTile label="Avg" value={formatDuration(summary.avgDuration)} />
          <StatTile
            label="Max"
            value={formatDuration(summary.maxDuration)}
            sub={summary.slowCount > 0 ? `${summary.slowCount} slow` : undefined}
          />
          <StatTile
            label="Errors"
            value={summary.errorCount}
            valueClassName={summary.errorCount > 0 ? 'text-danger-bg' : undefined}
            sub={`${(summary.errorRate * 100).toFixed(summary.errorRate >= 0.1 ? 0 : 1)}%`}
          />
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <div className="flex min-w-[220px] flex-1 basis-[240px] flex-col gap-1.5">
            <BlockTitle>By type</BlockTitle>
            {summary.kindCounts.map(({ kind, count }) => (
              <DistributionRow
                key={kind}
                label={getRequestKindLabel(kind)}
                labelClassName={REQUEST_KIND_TEXT_COLOR[kind]}
                barClassName="bg-accent"
                count={count}
                total={totalCount}
              />
            ))}
          </div>

          <div className="flex min-w-[220px] flex-1 basis-[240px] flex-col gap-1.5">
            <BlockTitle>By status</BlockTitle>
            {summary.statusGroups.map(({ group, count }) => (
              <DistributionRow
                key={group}
                label={STATUS_GROUP_LABEL[group]}
                labelClassName={STATUS_GROUP_TEXT[group]}
                barClassName={STATUS_GROUP_BAR[group]}
                count={count}
                total={totalCount}
              />
            ))}
          </div>

          <div className="flex min-w-[220px] flex-1 basis-[240px] flex-col gap-1">
            <BlockTitle>Slowest</BlockTitle>
            {summary.topSlowest.map((request) => (
              <TopRow
                key={request.requestId}
                request={request}
                value={formatDuration(request.duration)}
                onSelect={onSelectRequest}
              />
            ))}
          </div>

          <div className="flex min-w-[220px] flex-1 basis-[240px] flex-col gap-1">
            <BlockTitle>Largest</BlockTitle>
            {summary.topLargest.length > 0 ? (
              summary.topLargest.map((request) => (
                <TopRow
                  key={request.requestId}
                  request={request}
                  value={formatBytes(request.size)}
                  onSelect={onSelectRequest}
                />
              ))
            ) : (
              <p className="m-0 px-1.5 py-1 text-[11px] text-ink-weak">크기 정보 없음</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
