import {
  FILTERABLE_METHODS,
  type FilterableMethod,
} from '../../utils/requestFilterPrefs';
import { FilterMenu } from '../shared/FilterMenu';

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
            label: (
              <span className={`method method-${method.toLowerCase()}`}>
                {method === 'OTHER' ? 'Other' : method}
              </span>
            ),
          })),
        },
      ]}
      enabledValues={enabledMethods}
      onToggle={onToggle}
      onSetAll={onSetAll}
    />
  );
}
