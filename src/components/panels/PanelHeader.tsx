import { useState, type KeyboardEvent } from 'react';
import type { WorkspaceMode } from '../Toolbar';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { getPanelFiltersOpen, savePanelFiltersOpen } from '../../utils/panelFilterPrefs';
import { IconButton } from '../ui/Button';
import { SearchOptionToggles } from '../ui/SearchOptionToggles';

type PanelHeaderProps = {
  scope: WorkspaceMode;
};

/** 각 도킹 패널 헤더: 슬림 검색바 + 접을 수 있는 Include/Exclude 필터. 뷰마다 독립적으로 동작한다. */
export function PanelHeader({ scope }: PanelHeaderProps) {
  const { searchModels, filterModels, searchOptions } = useWorkspace();
  const model = searchModels[scope];
  const filter = filterModels[scope];
  const { matchCase, wholeWord, onMatchCaseChange, onWholeWordChange } = searchOptions;

  const hasFilterText = Boolean(filter.includeText.trim() || filter.excludeText.trim());
  // 저장된 값이 없으면 필터가 걸려 있을 때만 펼친 상태로 시작한다.
  const [filtersOpen, setFiltersOpen] = useState(() => getPanelFiltersOpen(scope, hasFilterText));

  const toggleFilters = () => {
    setFiltersOpen((current) => {
      const next = !current;
      savePanelFiltersOpen(scope, next);
      return next;
    });
  };

  const hasSearch = Boolean(model.searchText.trim());
  const hasActiveSearch = hasSearch && model.occurrenceCount > 0;
  const searchPosition = hasActiveSearch ? model.matchIndex + 1 : 0;
  const scopePosition = hasSearch && model.scopeJumpCount > 0 ? model.activeScopeOrder : 0;

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
      event.preventDefault();
      model.onPreviousScope();
      return;
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      model.onNextScope();
      return;
    }
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      model.onPrevious();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      model.onNext();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      model.onSearchTextChange('');
    }
  };

  return (
    <div className="panel-header">
      <div className="panel-search" role="search" data-panel-search={scope}>
        <input
          className="panel-search-input"
          type="search"
          value={model.searchText}
          onChange={(event) => model.onSearchTextChange(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder={model.placeholder}
          aria-label={`Search ${scope}`}
        />
        <SearchOptionToggles
          className="panel-search-options"
          matchCase={matchCase}
          wholeWord={wholeWord}
          onMatchCaseChange={onMatchCaseChange}
          onWholeWordChange={onWholeWordChange}
        />
        {hasActiveSearch ? (
          <div className="panel-search-nav" aria-label="Search navigation">
            <IconButton size="xs" onClick={model.onPrevious} title="Previous hit (Shift+Enter)">
              ‹
            </IconButton>
            <span className="search-position">
              {searchPosition}/{model.occurrenceCount}
            </span>
            <IconButton size="xs" onClick={model.onNext} title="Next hit (Enter)">
              ›
            </IconButton>
            <span className="search-nav-divider" aria-hidden="true" />
            <span className="search-nav-label">{model.scopeLabel}</span>
            <IconButton
              size="xs"
              onClick={model.onPreviousScope}
              title={`Previous ${model.scopeLabel.toLowerCase()} (Ctrl+Shift+Enter)`}
            >
              «
            </IconButton>
            <span className="search-position">
              {scopePosition}/{model.scopeJumpCount}
            </span>
            <IconButton
              size="xs"
              onClick={model.onNextScope}
              title={`Next ${model.scopeLabel.toLowerCase()} (Ctrl+Enter)`}
            >
              »
            </IconButton>
          </div>
        ) : null}
        <IconButton
          size="xs"
          ghost
          active={filtersOpen}
          className={`panel-filter-toggle ${!filtersOpen && hasFilterText ? 'has-filter' : ''}`}
          aria-expanded={filtersOpen}
          aria-label={filtersOpen ? '필터 접기' : '필터 펼치기'}
          title={filtersOpen ? '필터 접기' : hasFilterText ? '필터 펼치기 (필터 적용 중)' : '필터 펼치기'}
          onClick={toggleFilters}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
          </svg>
        </IconButton>
      </div>
      {filtersOpen ? (
        <div className="panel-filters">
          <label className="panel-filter-field">
            <span className="panel-filter-label">Include</span>
            <input
              type="text"
              value={filter.includeText}
              onChange={(event) => filter.onIncludeTextChange(event.currentTarget.value)}
              placeholder={filter.includePlaceholder}
            />
          </label>
          <label className="panel-filter-field">
            <span className="panel-filter-label">Exclude</span>
            <input
              type="text"
              value={filter.excludeText}
              onChange={(event) => filter.onExcludeTextChange(event.currentTarget.value)}
              placeholder={filter.excludePlaceholder}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
