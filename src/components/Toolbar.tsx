import { useState, type KeyboardEvent, type RefObject } from 'react';
import { getToolbarExpanded, setToolbarExpanded } from '../utils/toolbarPrefs';

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
  const [isExpanded, setIsExpanded] = useState(() => getToolbarExpanded());
  const hasSearch = Boolean(searchText.trim());
  const searchPosition = hasSearch && searchOccurrenceCount > 0 ? searchMatchIndex + 1 : 0;
  const requestPosition = hasSearch && searchRequestJumpCount > 0 ? activeSearchRequestOrder : 0;

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
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
  };

  const handleToggleExpanded = () => {
    setIsExpanded((current) => {
      const next = !current;
      setToolbarExpanded(next);
      return next;
    });
  };

  return (
    <header className={`toolbar ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}>
      <div className="toolbar-row toolbar-row-primary">
        <button
          className="toolbar-toggle"
          type="button"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse header' : 'Expand header'}
          title={isExpanded ? 'Collapse header' : 'Expand header'}
          onClick={handleToggleExpanded}
        >
          <span className="toolbar-toggle-icon" aria-hidden="true" />
        </button>

        <div className="toolbar-brand">
          <h1>API Flow</h1>
          <div className="toolbar-stats" aria-label="Capture summary">
            <span className="toolbar-chip">{requestCount} shown</span>
            {totalRequestCount !== requestCount ? (
              <span className="toolbar-chip">{totalRequestCount} captured</span>
            ) : null}
            {hasSearch ? (
              <span className="toolbar-chip toolbar-chip-accent">
                {searchOccurrenceCount} hits · {searchRequestCount} req
              </span>
            ) : null}
          </div>
        </div>

        <div className="toolbar-search" role="search">
          <input
            ref={searchInputRef}
            className="toolbar-search-input"
            type="search"
            value={searchText}
            onChange={(event) => onSearchTextChange(event.currentTarget.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search path, status, body…"
            aria-label="Search requests"
            title="Enter: next hit · Shift+Enter: previous hit · Ctrl+Enter: next card · Ctrl+Shift+Enter: previous card"
          />
          {hasSearch ? (
            <SearchNavigation
              searchPosition={searchPosition}
              searchOccurrenceCount={searchOccurrenceCount}
              requestPosition={requestPosition}
              searchRequestJumpCount={searchRequestJumpCount}
              onSearchPrevious={onSearchPrevious}
              onSearchNext={onSearchNext}
              onSearchPreviousRequest={onSearchPreviousRequest}
              onSearchNextRequest={onSearchNextRequest}
            />
          ) : null}
        </div>

        <div className="toolbar-cluster">
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
        </div>
      </div>

      {isExpanded ? (
        <div className="toolbar-row toolbar-row-secondary">
          <div className="toolbar-filters">
            <label className="filter-field">
              <span className="filter-label">Include</span>
              <input
                type="text"
                value={includeText}
                onChange={(event) => onIncludeTextChange(event.currentTarget.value)}
                placeholder="api, graphql"
              />
            </label>
            <label className="filter-field">
              <span className="filter-label">Exclude</span>
              <input
                type="text"
                value={excludeText}
                onChange={(event) => onExcludeTextChange(event.currentTarget.value)}
                placeholder="analytics, sentry"
              />
            </label>
          </div>

          <div className="toolbar-secondary-end">
            {sessionNotice ? <p className="toolbar-notice">{sessionNotice}</p> : null}
            <label className="toggle-control">
              <input
                type="checkbox"
                checked={groupFlowByTime}
                onChange={(event) => onGroupFlowByTimeChange(event.currentTarget.checked)}
              />
              <span>Group time</span>
            </label>
            <div className="toolbar-button-group" aria-label="Session actions">
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
          </div>
        </div>
      ) : null}
    </header>
  );
}

type SearchNavigationProps = {
  searchPosition: number;
  searchOccurrenceCount: number;
  requestPosition: number;
  searchRequestJumpCount: number;
  onSearchPrevious: () => void;
  onSearchNext: () => void;
  onSearchPreviousRequest: () => void;
  onSearchNextRequest: () => void;
};

function SearchNavigation({
  searchPosition,
  searchOccurrenceCount,
  requestPosition,
  searchRequestJumpCount,
  onSearchPrevious,
  onSearchNext,
  onSearchPreviousRequest,
  onSearchNextRequest,
}: SearchNavigationProps) {
  return (
    <div className="toolbar-search-nav" aria-label="Search navigation">
      <div className="search-nav-section" aria-label="Hit navigation">
        <span className="search-nav-label">Hit</span>
        <button type="button" className="search-nav-button" onClick={onSearchPrevious} title="Previous hit (Shift+Enter)">
          ‹
        </button>
        <span className="search-position">
          {searchPosition}/{searchOccurrenceCount}
        </span>
        <button type="button" className="search-nav-button" onClick={onSearchNext} title="Next hit (Enter)">
          ›
        </button>
      </div>
      <span className="search-nav-divider" aria-hidden="true" />
      <div className="search-nav-section" aria-label="Card navigation">
        <span className="search-nav-label">Card</span>
        <button type="button" className="search-nav-button" onClick={onSearchPreviousRequest} title="Previous card (Ctrl+Shift+Enter)">
          «
        </button>
        <span className="search-position">
          {requestPosition}/{searchRequestJumpCount}
        </span>
        <button type="button" className="search-nav-button" onClick={onSearchNextRequest} title="Next card (Ctrl+Enter)">
          »
        </button>
      </div>
    </div>
  );
}
