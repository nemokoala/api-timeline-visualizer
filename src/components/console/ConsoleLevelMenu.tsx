import {
  CONSOLE_LEVEL_LABELS,
  type FilterableConsoleLevel,
} from '../../utils/consoleLevelPrefs';
import { FilterMenu, type FilterMenuItem } from '../shared/FilterMenu';
import { CONSOLE_LEVEL_TEXT_COLOR } from './consoleLevelColors';
import { useT } from '../../i18n';

type ConsoleLevelMenuProps = {
  enabledLevels: FilterableConsoleLevel[];
  onToggle: (level: FilterableConsoleLevel, enabled: boolean) => void;
  onSetAll: (enabled: boolean) => void;
};

// 목록의 Level 컬럼과 같은 색·대문자 표기를 쓴다.
function toItem(level: FilterableConsoleLevel): FilterMenuItem<FilterableConsoleLevel> {
  return {
    value: level,
    label: (
      <span
        className={`text-[10px] font-bold uppercase tracking-[0.04em] ${
          CONSOLE_LEVEL_TEXT_COLOR[level] ?? 'text-ink-weak'
        }`}
      >
        {CONSOLE_LEVEL_LABELS[level]}
      </span>
    ),
  };
}

/** 콘솔 로그 레벨(Log/Info/…/Dir) 표시 토글 드롭다운. */
export function ConsoleLevelMenu({ enabledLevels, onToggle, onSetAll }: ConsoleLevelMenuProps) {
  const t = useT();
  return (
    <FilterMenu
      buttonLabel="Level"
      menuAriaLabel={t('consoleLevelMenu.aria')}
      groups={[
        { items: (['log', 'info', 'warn', 'error', 'debug'] as const).map(toItem) },
        { label: t('consoleLevelMenu.groupOther'), items: (['table', 'dir'] as const).map(toItem) },
      ]}
      enabledValues={enabledLevels}
      onToggle={onToggle}
      onSetAll={onSetAll}
    />
  );
}
