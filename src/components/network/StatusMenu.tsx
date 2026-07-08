import {
  STATUS_GROUPS,
  STATUS_GROUP_LABELS,
  type StatusGroup,
} from '../../utils/requestFilterPrefs';
import { FilterMenu } from '../shared/FilterMenu';

type StatusMenuProps = {
  enabledGroups: StatusGroup[];
  onToggle: (group: StatusGroup, enabled: boolean) => void;
  onSetAll: (enabled: boolean) => void;
};

// 그룹별 색 톤(flow-status 클래스 재사용): 2xx=good, 4xx=warn, 5xx/Error=bad.
const GROUP_TONE: Record<StatusGroup, string> = {
  '2xx': 'good',
  '3xx': 'neutral',
  '4xx': 'warn',
  '5xx': 'bad',
  error: 'bad',
};

/** 상태코드 그룹(2xx~5xx/Error) 표시 토글 드롭다운. */
export function StatusMenu({ enabledGroups, onToggle, onSetAll }: StatusMenuProps) {
  return (
    <FilterMenu
      buttonLabel="Status"
      menuAriaLabel="상태코드 그룹 표시"
      groups={[
        {
          items: STATUS_GROUPS.map((group) => ({
            value: group,
            label: (
              <span className={`flow-status ${GROUP_TONE[group]}`}>
                {STATUS_GROUP_LABELS[group]}
              </span>
            ),
          })),
        },
      ]}
      enabledValues={enabledGroups}
      onToggle={onToggle}
      onSetAll={onSetAll}
    />
  );
}
