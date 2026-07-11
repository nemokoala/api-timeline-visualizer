import {
  FILTERABLE_METHODS,
  type FilterableMethod,
} from '../../utils/requestFilterPrefs';
import { FilterMenu } from '../shared/FilterMenu';
import { MethodBadge } from './MethodBadge';
import { useT } from '../../i18n';

type MethodMenuProps = {
  enabledMethods: FilterableMethod[];
  onToggle: (method: FilterableMethod, enabled: boolean) => void;
  onSetAll: (enabled: boolean) => void;
};

/** HTTP 메서드 표시 토글 드롭다운. */
export function MethodMenu({ enabledMethods, onToggle, onSetAll }: MethodMenuProps) {
  const t = useT();
  return (
    <FilterMenu
      buttonLabel="Method"
      menuAriaLabel={t('methodMenu.aria')}
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
