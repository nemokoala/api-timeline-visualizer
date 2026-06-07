type ToolbarProps = {
  requestCount: number;
  totalRequestCount: number;
  viewMode: 'flow' | 'timeline';
  includeText: string;
  excludeText: string;
  onIncludeTextChange: (includeText: string) => void;
  onExcludeTextChange: (excludeText: string) => void;
  onViewModeChange: (viewMode: 'flow' | 'timeline') => void;
  onClear: () => void;
};

export function Toolbar({
  requestCount,
  totalRequestCount,
  viewMode,
  includeText,
  excludeText,
  onIncludeTextChange,
  onExcludeTextChange,
  onViewModeChange,
  onClear,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <div>
        <h1>API Flow</h1>
        <p>
          {requestCount} shown
          {totalRequestCount !== requestCount ? ` / ${totalRequestCount} captured` : ' requests'}
        </p>
      </div>
      <div className="toolbar-actions">
        <label className="filter-field">
          <span>Include</span>
          <input
            type="text"
            value={includeText}
            onChange={(event) => onIncludeTextChange(event.currentTarget.value)}
            placeholder="api,graphql"
          />
        </label>
        <label className="filter-field">
          <span>Exclude</span>
          <input
            type="text"
            value={excludeText}
            onChange={(event) => onExcludeTextChange(event.currentTarget.value)}
            placeholder="analytics,sentry"
          />
        </label>
        <div className="segmented-control" aria-label="View mode">
          <button
            className={viewMode === 'flow' ? 'active' : ''}
            type="button"
            onClick={() => onViewModeChange('flow')}
          >
            Flow
          </button>
          <button
            className={viewMode === 'timeline' ? 'active' : ''}
            type="button"
            onClick={() => onViewModeChange('timeline')}
          >
            Timeline
          </button>
        </div>
        <button className="clear-button" type="button" onClick={onClear} disabled={requestCount === 0}>
          Clear
        </button>
      </div>
    </header>
  );
}
