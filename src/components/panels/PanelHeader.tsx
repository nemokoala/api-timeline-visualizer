import { useState, type KeyboardEvent } from 'react';
import type { WorkspaceMode } from '../layout/Toolbar';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { getPanelFiltersOpen, savePanelFiltersOpen } from '../../utils/panelFilterPrefs';
import { useT } from '../../i18n';
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
    <label className="flex h-6 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-line bg-fill px-2 text-[11px] text-ink-weak transition-[background-color,border-color] duration-[120ms] focus-within:border-accent focus-within:bg-surface">
      <span className="flex-none whitespace-nowrap font-medium">{label}</span>
      <input
        type="text"
        className="h-[22px] w-0 min-w-0 flex-auto border-0 bg-transparent text-[11px] text-ink-strong outline-none [font-family:inherit] placeholder:text-ink-faint"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

/** 각 도킹 패널 헤더: 슬림 검색바 + 접을 수 있는 Include/Exclude 필터. 뷰마다 독립적으로 동작한다. */
export function PanelHeader({ scope }: PanelHeaderProps) {
  const t = useT();
  const { searchModels, filterModels, searchOptions, floatPanel } = useWorkspace();
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
        className="flex h-7 items-center gap-1.5 px-2"
        role="search"
        data-panel-search={scope}
      >
        <label className="flex h-6 min-w-0 flex-[1_1_80px] items-center gap-1.5 rounded-lg border border-line bg-fill px-2 transition-[background-color,border-color] duration-[120ms] focus-within:border-accent focus-within:bg-surface">
          <svg
            className="h-3.5 w-3.5 flex-none text-ink-faint"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            className="h-[22px] w-0 min-w-0 flex-auto border-0 bg-transparent text-xs text-ink-strong outline-none [font-family:inherit] placeholder:text-ink-faint"
            type="search"
            value={model.searchText}
            onChange={(event) => model.onSearchTextChange(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
            placeholder={model.placeholder}
            aria-label={`Search ${scope}`}
          />
          <SearchOptionToggles
            className="-mr-1 flex shrink-0 items-center gap-0.5"
            matchCase={matchCase}
            wholeWord={wholeWord}
            onMatchCaseChange={onMatchCaseChange}
            onWholeWordChange={onWholeWordChange}
          />
        </label>
        {hasActiveSearch ? (
          <div
            className="flex shrink-0 items-center gap-1"
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
          aria-label={t('panelHeader.popOutAria')}
          title={t('panelHeader.popOutTitle')}
          onClick={() => floatPanel(scope)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 3h7v7" />
            <path d="M21 3l-9 9" />
            <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
          </svg>
        </IconButton>
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
          aria-label={filtersOpen ? t('panelHeader.collapseFilters') : t('panelHeader.expandFilters')}
          title={filtersOpen ? t('panelHeader.collapseFilters') : hasFilterText ? t('panelHeader.expandFiltersActive') : t('panelHeader.expandFilters')}
          onClick={toggleFilters}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
          </svg>
        </IconButton>
      </div>
      {filtersOpen ? (
        <div className="flex items-center gap-1.5 px-2 pb-1 pt-0.5">
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
