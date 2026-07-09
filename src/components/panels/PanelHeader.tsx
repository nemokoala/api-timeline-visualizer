import { useState, type KeyboardEvent } from 'react';
import type { WorkspaceMode } from '../layout/Toolbar';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { getPanelFiltersOpen, savePanelFiltersOpen } from '../../utils/panelFilterPrefs';
import { IconButton } from '../ui/Button';
import { SearchOptionToggles } from '../ui/SearchOptionToggles';

type PanelHeaderProps = {
  scope: WorkspaceMode;
};

type FilterFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onChange: (next: string) => void;
};

/** Include/Exclude 알약형 필터 입력. 포커스 시 파란 테두리 + surface 배경. */
function FilterField({ label, value, placeholder, onChange }: FilterFieldProps) {
  return (
    <label className="flex h-6 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-transparent bg-fill px-2 text-[11px] text-ink-weak transition-[background-color,border-color] duration-[120ms] focus-within:border-accent focus-within:bg-surface">
      <span className="flex-none whitespace-nowrap font-medium">{label}</span>
      <input
        type="text"
        className="h-[22px] w-0 min-w-0 flex-auto border-0 bg-transparent text-[11px] text-ink-strong outline-none [font-family:inherit]"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

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
    <div className="flex shrink-0 flex-col border-b border-line-weak bg-surface">
      <div
        className="flex h-7 items-center gap-1.5 pl-2.5 pr-1.5"
        role="search"
        data-panel-search={scope}
      >
        <input
          className="h-[22px] min-w-0 flex-[1_1_80px] border-0 bg-transparent text-xs text-ink-strong outline-none [font-family:inherit]"
          type="search"
          value={model.searchText}
          onChange={(event) => model.onSearchTextChange(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder={model.placeholder}
          aria-label={`Search ${scope}`}
        />
        <SearchOptionToggles
          className="flex shrink-0 items-center gap-0.5"
          matchCase={matchCase}
          wholeWord={wholeWord}
          onMatchCaseChange={onMatchCaseChange}
          onWholeWordChange={onWholeWordChange}
        />
        {hasActiveSearch ? (
          <div
            className="flex shrink-0 items-center gap-1 border-l border-line pl-1.5"
            aria-label="Search navigation"
          >
            <IconButton size="xs" onClick={model.onPrevious} title="Previous hit (Shift+Enter)">
              ‹
            </IconButton>
            <span className="min-w-[34px] whitespace-nowrap px-px text-center text-[10px] text-ink-weak tabular-nums">
              {searchPosition}/{model.occurrenceCount}
            </span>
            <IconButton size="xs" onClick={model.onNext} title="Next hit (Enter)">
              ›
            </IconButton>
            <span className="h-4 w-px shrink-0 bg-line" aria-hidden="true" />
            <span className="px-0.5 text-[9px] font-bold uppercase tracking-[0.04em] text-ink-faint">
              {model.scopeLabel}
            </span>
            <IconButton
              size="xs"
              onClick={model.onPreviousScope}
              title={`Previous ${model.scopeLabel.toLowerCase()} (Ctrl+Shift+Enter)`}
            >
              «
            </IconButton>
            <span className="min-w-[34px] whitespace-nowrap px-px text-center text-[10px] text-ink-weak tabular-nums">
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
          className={`relative ${
            !filtersOpen && hasFilterText
              ? "text-accent after:absolute after:top-[2px] after:right-[2px] after:h-[5px] after:w-[5px] after:rounded-full after:bg-accent after:content-['']"
              : ''
          }`}
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
        <div className="flex h-[30px] items-center gap-1.5 px-2 pb-1">
          <FilterField
            label="Include"
            value={filter.includeText}
            placeholder={filter.includePlaceholder}
            onChange={filter.onIncludeTextChange}
          />
          <FilterField
            label="Exclude"
            value={filter.excludeText}
            placeholder={filter.excludePlaceholder}
            onChange={filter.onExcludeTextChange}
          />
        </div>
      ) : null}
    </div>
  );
}
