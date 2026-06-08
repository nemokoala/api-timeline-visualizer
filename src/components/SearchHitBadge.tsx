import type { RequestSearchSummary } from '../utils/requestSearch';

type SearchHitBadgeProps = {
  summary: RequestSearchSummary;
  activeGlobalSearchIndex: number | null;
};

export function SearchHitBadge({ summary, activeGlobalSearchIndex }: SearchHitBadgeProps) {
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
      className={`search-hit-badge ${isActive ? 'is-active' : ''}`}
      title={`${summary.hitCount} hits · request ${summary.requestOrder}`}
    >
      <span className="search-hit-order">{summary.requestOrder}</span>
      <span className="search-hit-range">{label}</span>
    </span>
  );
}
