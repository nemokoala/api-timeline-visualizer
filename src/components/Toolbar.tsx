import { type RefObject } from 'react';

type ToolbarProps = {
  requestCount: number;
  totalRequestCount: number;
  searchText: string;
  searchMatchIndex: number;
  searchMatchCount: number;
  searchInputRef: RefObject<HTMLInputElement | null>;
  viewMode: 'flow' | 'timeline';
  groupFlowByTime: boolean;
  includeText: string;
  excludeText: string;
  sessionNotice: string | null;
  onSearchTextChange: (searchText: string) => void;
  onSearchNext: () => void;
  onSearchPrevious: () => void;
  onGroupFlowByTimeChange: (groupFlowByTime: boolean) => void;
  onIncludeTextChange: (includeText: string) => void;
  onExcludeTextChange: (excludeText: string) => void;
  onViewModeChange: (viewMode: 'flow' | 'timeline') => void;
  onExportSession: () => void;
  onImportSession: () => void;
  onClear: () => void;
};

export function Toolbar({
  requestCount,
  totalRequestCount,
  searchText,
  searchMatchIndex,
  searchMatchCount,
  searchInputRef,
  viewMode,
  groupFlowByTime,
  includeText,
  excludeText,
  sessionNotice,
  onSearchTextChange,
  onSearchNext,
  onSearchPrevious,
  onGroupFlowByTimeChange,
  onIncludeTextChange,
  onExcludeTextChange,
  onViewModeChange,
  onExportSession,
  onImportSession,
  onClear,
}: ToolbarProps) {
  const hasSearch = Boolean(searchText.trim());
  const searchPosition = hasSearch && searchMatchCount > 0 ? searchMatchIndex + 1 : 0;

  return (
    <header className="toolbar">
      <div>
        <h1>API Flow</h1>
        <p>
          {requestCount} shown
          {totalRequestCount !== requestCount ? ` / ${totalRequestCount} captured` : ' requests'}
          {hasSearch ? ` · ${searchMatchCount} match${searchMatchCount === 1 ? '' : 'es'}` : ''}
        </p>
        {sessionNotice ? <p className="toolbar-notice">{sessionNotice}</p> : null}
      </div>
      <div className="toolbar-actions">
        <label className="filter-field search-field">
          <span>Search</span>
          <input
            ref={searchInputRef}
            type="search"
            value={searchText}
            onChange={(event) => onSearchTextChange(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && event.shiftKey) {
                event.preventDefault();
                onSearchPrevious();
                return;
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                onSearchNext();
                return;
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                onSearchTextChange('');
              }
            }}
            placeholder="path, status, body"
            aria-label="Search requests"
          />
          {hasSearch ? <span className="search-position">{searchPosition}/{searchMatchCount}</span> : null}
        </label>
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
          <span>Group time</span>
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
        <button className="toolbar-button" type="button" onClick={onExportSession} disabled={totalRequestCount === 0}>
          Export
        </button>
        <button className="toolbar-button" type="button" onClick={onImportSession}>
          Import
        </button>
        <button className="clear-button" type="button" onClick={onClear} disabled={requestCount === 0}>
          Clear
        </button>
      </div>
    </header>
  );
}
