import type { RequestSearchSummary } from '../../utils/requestSearch';
import { cn } from '../../utils/cn';

type SearchHitBadgeProps = {
  summary: RequestSearchSummary;
  activeGlobalSearchIndex: number | null;
  className?: string;
};

export function SearchHitBadge({
  summary,
  activeGlobalSearchIndex,
  className,
}: SearchHitBadgeProps) {
  const label =
    summary.hitCount === 1
      ? `#${summary.globalStart}`
      : `#${summary.globalStart}–${summary.globalEnd}`;

  const isActive =
    activeGlobalSearchIndex !== null &&
    activeGlobalSearchIndex >= summary.globalStart &&
    activeGlobalSearchIndex <= summary.globalEnd;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border-0 py-[2px] pl-[5px] pr-[7px] text-[10px] font-bold leading-[14px]',
        isActive ? 'bg-highlight text-highlight-deep' : 'bg-fill text-ink-sub',
        className,
      )}
      title={`${summary.hitCount} hits · request ${summary.requestOrder}`}
    >
      <span
        className={cn(
          'inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-[3px] text-[9px]',
          isActive
            ? 'bg-[rgba(0,0,0,0.08)] text-highlight-deep'
            : 'bg-accent-soft text-accent-strong',
        )}
      >
        {summary.requestOrder}
      </span>
      <span className="tabular-nums">{label}</span>
    </span>
  );
}
