import { type RefObject } from 'react';

type ToolbarProps = {
  requestCount: number;
  totalRequestCount: number;
  searchText: string;
  searchMatchIndex: number;
  searchOccurrenceCount: number;
  searchRequestCount: number;
  searchRequestJumpCount: number;
  activeSearchRequestOrder: number;
  searchInputRef: RefObject<HTMLInputElement | null>;
  viewMode: 'flow' | 'timeline';
  groupFlowByTime: boolean;
  includeText: string;
  excludeText: string;
  sessionNotice: string | null;
  onSearchTextChange: (searchText: string) => void;
  onSearchNext: () => void;
  onSearchPrevious: () => void;
  onSearchNextRequest: () => void;
  onSearchPreviousRequest: () => void;
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
  searchOccurrenceCount,
  searchRequestCount,
  searchRequestJumpCount,
  activeSearchRequestOrder,
  searchInputRef,
  viewMode,
  groupFlowByTime,
  includeText,
  excludeText,
  sessionNotice,
  onSearchTextChange,
  onSearchNext,
  onSearchPrevious,
  onSearchNextRequest,
  onSearchPreviousRequest,
  onGroupFlowByTimeChange,
  onIncludeTextChange,
  onExcludeTextChange,
  onViewModeChange,
  onExportSession,
  onImportSession,
  onClear,
}: ToolbarProps) {
  const hasSearch = Boolean(searchText.trim());
  const searchPosition = hasSearch && searchOccurrenceCount > 0 ? searchMatchIndex + 1 : 0;
  const requestPosition = hasSearch && searchRequestJumpCount > 0 ? activeSearchRequestOrder : 0;

  return (
    <header className="toolbar">
      <div>
        <h1>API Flow</h1>
        <p>
          {requestCount} shown
          {totalRequestCount !== requestCount ? ` / ${totalRequestCount} captured` : ' requests'}
          {hasSearch
            ? ` · ${searchOccurrenceCount} hit${searchOccurrenceCount === 1 ? '' : 's'} in ${searchRequestCount} request${searchRequestCount === 1 ? '' : 's'}`
            : ''}
        </p>
        {sessionNotice ? <p className="toolbar-notice">{sessionNotice}</p> : null}
      </div>
      <div className="toolbar-actions">
        <div className="search-control">
          <label className="filter-field search-input-field">
            <span>Search</span>
            <input
              ref={searchInputRef}
              type="search"
              value={searchText}
              onChange={(event) => onSearchTextChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
                  event.preventDefault();
                  onSearchPreviousRequest();
                  return;
                }
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  onSearchNextRequest();
                  return;
                }
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
              title="Enter: next hit · Shift+Enter: previous hit · Ctrl+Enter: next card · Ctrl+Shift+Enter: previous card"
            />
          </label>
          {hasSearch ? (
            <div className="search-nav" aria-label="Search navigation">
              <div className="search-nav-group" aria-label="Hit navigation">
                <button type="button" className="search-nav-button" onClick={onSearchPrevious} title="Previous hit (Shift+Enter)">
                  ‹
                </button>
                <span className="search-position">{searchPosition}/{searchOccurrenceCount}</span>
                <button type="button" className="search-nav-button" onClick={onSearchNext} title="Next hit (Enter)">
                  ›
                </button>
              </div>
              <span className="search-nav-divider" aria-hidden="true" />
              <div className="search-nav-group" aria-label="Card navigation">
                <button type="button" className="search-nav-button" onClick={onSearchPreviousRequest} title="Previous card (Ctrl+Shift+Enter)">
                  «
                </button>
                <span className="search-position">{requestPosition}/{searchRequestJumpCount}</span>
                <button type="button" className="search-nav-button" onClick={onSearchNextRequest} title="Next card (Ctrl+Enter)">
                  »
                </button>
              </div>
            </div>
          ) : null}
        </div>
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
