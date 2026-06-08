type ToolbarProps = {
  requestCount: number;
  totalRequestCount: number;
  viewMode: 'flow' | 'timeline';
  groupFlowByTime: boolean;
  includeText: string;
  excludeText: string;
  onGroupFlowByTimeChange: (groupFlowByTime: boolean) => void;
  onIncludeTextChange: (includeText: string) => void;
  onExcludeTextChange: (excludeText: string) => void;
  onViewModeChange: (viewMode: 'flow' | 'timeline') => void;
  onClear: () => void;
};

export function Toolbar({
  requestCount,
  totalRequestCount,
  viewMode,
  groupFlowByTime,
  includeText,
  excludeText,
  onGroupFlowByTimeChange,
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
        <label className="toggle-control">
          <input
            type="checkbox"
            checked={groupFlowByTime}
            onChange={(event) => onGroupFlowByTimeChange(event.currentTarget.checked)}
          />
          <span>Group</span>
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
