import {
  FILTERABLE_METHODS,
  type FilterableMethod,
} from '../../utils/requestFilterPrefs';
import { FilterMenu } from '../shared/FilterMenu';
import { MethodBadge } from './MethodBadge';

type MethodMenuProps = {
  enabledMethods: FilterableMethod[];
  onToggle: (method: FilterableMethod, enabled: boolean) => void;
  onSetAll: (enabled: boolean) => void;
};

/** HTTP 메서드 표시 토글 드롭다운. */
export function MethodMenu({ enabledMethods, onToggle, onSetAll }: MethodMenuProps) {
  return (
    <FilterMenu
      buttonLabel="Method"
      menuAriaLabel="HTTP 메서드 표시"
      groups={[
        {
          items: FILTERABLE_METHODS.map((method) => ({
            value: method,
            label: <MethodBadge method={method === 'OTHER' ? 'Other' : method} />,
          })),
        },
      ]}
      enabledValues={enabledMethods}
      onToggle={onToggle}
      onSetAll={onSetAll}
    />
  );
}
