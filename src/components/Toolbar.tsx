import { useState, type KeyboardEvent, type RefObject } from 'react';
import { useTheme } from '../hooks/useTheme';
import { getToolbarExpanded, setToolbarExpanded } from '../utils/toolbarPrefs';

export type WorkspaceMode = 'network' | 'storage' | 'console';
export type NetworkViewMode = 'flow' | 'timeline';

type ToolbarProps = {
  requestCount: number;
  totalRequestCount: number;
  searchText: string;
  searchMatchIndex: number;
  searchOccurrenceCount: number;
  searchScopeJumpCount: number;
  activeSearchScopeOrder: number;
  searchInputRef: RefObject<HTMLInputElement | null>;
  workspaceMode: WorkspaceMode;
  networkViewMode: NetworkViewMode;
  groupFlowByTime: boolean;
  networkIncludeText: string;
  networkExcludeText: string;
  storageIncludeText: string;
  storageExcludeText: string;
  sessionNotice: string | null;
  onSearchTextChange: (searchText: string) => void;
  onSearchNext: () => void;
  onSearchPrevious: () => void;
  onSearchNextScope: () => void;
  onSearchPreviousScope: () => void;
  onGroupFlowByTimeChange: (groupFlowByTime: boolean) => void;
  onNetworkIncludeTextChange: (includeText: string) => void;
  onNetworkExcludeTextChange: (excludeText: string) => void;
  onStorageIncludeTextChange: (includeText: string) => void;
  onStorageExcludeTextChange: (excludeText: string) => void;
  onWorkspaceModeChange: (workspaceMode: WorkspaceMode) => void;
  onNetworkViewModeChange: (networkViewMode: NetworkViewMode) => void;
  onExportSession: () => void;
  onImportSession: () => void;
  onClear: () => void;
  searchMatchCase: boolean;
  searchWholeWord: boolean;
  onSearchMatchCaseChange: (matchCase: boolean) => void;
  onSearchWholeWordChange: (wholeWord: boolean) => void;
};

export function Toolbar({
  requestCount,
  totalRequestCount,
  searchText,
  searchMatchIndex,
  searchOccurrenceCount,
  searchScopeJumpCount,
  activeSearchScopeOrder,
  searchInputRef,
  workspaceMode,
  networkViewMode,
  groupFlowByTime,
  networkIncludeText,
  networkExcludeText,
  storageIncludeText,
  storageExcludeText,
  sessionNotice,
  onSearchTextChange,
  onSearchNext,
  onSearchPrevious,
  onSearchNextScope,
  onSearchPreviousScope,
  onGroupFlowByTimeChange,
  onNetworkIncludeTextChange,
  onNetworkExcludeTextChange,
  onStorageIncludeTextChange,
  onStorageExcludeTextChange,
  onWorkspaceModeChange,
  onNetworkViewModeChange,
  onExportSession,
  onImportSession,
  onClear,
  searchMatchCase,
  searchWholeWord,
  onSearchMatchCaseChange,
  onSearchWholeWordChange,
}: ToolbarProps) {
  const [isExpanded, setIsExpanded] = useState(() => getToolbarExpanded());
  const hasSearch = Boolean(searchText.trim());
  const isNetworkMode = workspaceMode === 'network';
  const isStorageMode = workspaceMode === 'storage';
  const isConsoleMode = workspaceMode === 'console';
  const includeText = isNetworkMode ? networkIncludeText : storageIncludeText;
  const excludeText = isNetworkMode ? networkExcludeText : storageExcludeText;
  const onIncludeTextChange = isNetworkMode ? onNetworkIncludeTextChange : onStorageIncludeTextChange;
  const onExcludeTextChange = isNetworkMode ? onNetworkExcludeTextChange : onStorageExcludeTextChange;
  const hasActiveSearch = hasSearch && searchOccurrenceCount > 0;
  const searchPosition = hasSearch && searchOccurrenceCount > 0 ? searchMatchIndex + 1 : 0;
  const scopePosition = hasSearch && searchScopeJumpCount > 0 ? activeSearchScopeOrder : 0;
  const scopeLabel = isNetworkMode ? 'Card' : isStorageMode ? 'Row' : 'Log';
  const searchPlaceholder = isNetworkMode
    ? 'Search path, status, body…'
    : isStorageMode
      ? 'Search key, value…'
      : 'Search logs, objects, stack…';
  const searchAriaLabel = isNetworkMode
    ? 'Search requests'
    : isStorageMode
      ? 'Search storage'
      : 'Search console logs';
  const searchTitle = isNetworkMode
    ? 'Enter: next hit · Shift+Enter: previous hit · Ctrl+Enter: next card · Ctrl+Shift+Enter: previous card'
    : isStorageMode
      ? 'Enter: next hit · Shift+Enter: previous hit · Ctrl+Enter: next row · Ctrl+Shift+Enter: previous row'
      : 'Enter: next hit · Shift+Enter: previous hit · Ctrl+Enter: next log · Ctrl+Shift+Enter: previous log';

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
      event.preventDefault();
      onSearchPreviousScope();
      return;
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onSearchNextScope();
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
            {isNetworkMode ? (
              <>
                <span className="toolbar-chip">{requestCount} shown</span>
                {totalRequestCount !== requestCount ? (
                  <span className="toolbar-chip">{totalRequestCount} captured</span>
                ) : null}
              </>
            ) : isStorageMode ? (
              <span className="toolbar-chip">Storage viewer</span>
            ) : (
              <span className="toolbar-chip">{requestCount} logs</span>
            )}
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
            placeholder={searchPlaceholder}
            aria-label={searchAriaLabel}
            title={searchTitle}
          />
          <div className="toolbar-search-options" aria-label="Search options">
            <button
              type="button"
              className={`search-option-button ${searchMatchCase ? 'active' : ''}`}
              aria-pressed={searchMatchCase}
              title="Match case (Alt+C)"
              onClick={() => onSearchMatchCaseChange(!searchMatchCase)}
            >
              Aa
            </button>
            <button
              type="button"
              className={`search-option-button search-option-whole-word ${searchWholeWord ? 'active' : ''}`}
              aria-pressed={searchWholeWord}
              title="Match whole word (Alt+W)"
              onClick={() => onSearchWholeWordChange(!searchWholeWord)}
            >
              ab
            </button>
          </div>
          {hasActiveSearch ? (
            <SearchNavigation
              searchPosition={searchPosition}
              searchOccurrenceCount={searchOccurrenceCount}
              scopePosition={scopePosition}
              searchScopeJumpCount={searchScopeJumpCount}
              scopeLabel={scopeLabel}
              onSearchPrevious={onSearchPrevious}
              onSearchNext={onSearchNext}
              onSearchPreviousScope={onSearchPreviousScope}
              onSearchNextScope={onSearchNextScope}
            />
          ) : null}
        </div>

        <div className="toolbar-cluster">
          {isNetworkMode ? (
            <>
              <div className="segmented-control" aria-label="Network view mode">
                <button
                  className={networkViewMode === 'flow' ? 'active' : ''}
                  type="button"
                  onClick={() => onNetworkViewModeChange('flow')}
                >
                  Flow
                </button>
                <button
                  className={networkViewMode === 'timeline' ? 'active' : ''}
                  type="button"
                  onClick={() => onNetworkViewModeChange('timeline')}
                >
                  Timeline
                </button>
              </div>
              <span className="toolbar-cluster-sep" aria-hidden="true" />
            </>
          ) : null}
          <div className="segmented-control" aria-label="Workspace mode">
            <button
              className={workspaceMode === 'network' ? 'active' : ''}
              type="button"
              onClick={() => onWorkspaceModeChange('network')}
            >
              Network
            </button>
            <button
              className={workspaceMode === 'storage' ? 'active' : ''}
              type="button"
              onClick={() => onWorkspaceModeChange('storage')}
            >
              Storage
            </button>
            <button
              className={workspaceMode === 'console' ? 'active' : ''}
              type="button"
              onClick={() => onWorkspaceModeChange('console')}
            >
              Console
            </button>
          </div>
          <ThemeToggleButton />
        </div>
      </div>

      {isExpanded && (!isConsoleMode || !!sessionNotice) ? (
        <div className="toolbar-row toolbar-row-secondary">
          {isConsoleMode ? null : (
            <div className="toolbar-filters">
              <label className="filter-field">
                <span className="filter-label">Include</span>
                <input
                  type="text"
                  value={includeText}
                  onChange={(event) => onIncludeTextChange(event.currentTarget.value)}
                  placeholder={isNetworkMode ? 'api, graphql' : 'token, auth'}
                />
              </label>
              <label className="filter-field">
                <span className="filter-label">Exclude</span>
                <input
                  type="text"
                  value={excludeText}
                  onChange={(event) => onExcludeTextChange(event.currentTarget.value)}
                  placeholder={isNetworkMode ? 'analytics, sentry' : 'analytics, cache'}
                />
              </label>
            </div>
          )}

          <div className="toolbar-secondary-end">
            {sessionNotice ? <p className="toolbar-notice">{sessionNotice}</p> : null}
            {isNetworkMode ? (
              <>
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
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}

function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
    >
      {isDark ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

type SearchNavigationProps = {
  searchPosition: number;
  searchOccurrenceCount: number;
  scopePosition: number;
  searchScopeJumpCount: number;
  scopeLabel: string;
  onSearchPrevious: () => void;
  onSearchNext: () => void;
  onSearchPreviousScope: () => void;
  onSearchNextScope: () => void;
};

function SearchNavigation({
  searchPosition,
  searchOccurrenceCount,
  scopePosition,
  searchScopeJumpCount,
  scopeLabel,
  onSearchPrevious,
  onSearchNext,
  onSearchPreviousScope,
  onSearchNextScope,
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
      <div className="search-nav-section" aria-label={`${scopeLabel} navigation`}>
        <span className="search-nav-label">{scopeLabel}</span>
        <button
          type="button"
          className="search-nav-button"
          onClick={onSearchPreviousScope}
          title={`Previous ${scopeLabel.toLowerCase()} (Ctrl+Shift+Enter)`}
        >
          «
        </button>
        <span className="search-position">
          {scopePosition}/{searchScopeJumpCount}
        </span>
        <button
          type="button"
          className="search-nav-button"
          onClick={onSearchNextScope}
          title={`Next ${scopeLabel.toLowerCase()} (Ctrl+Enter)`}
        >
          »
        </button>
      </div>
    </div>
  );
}
