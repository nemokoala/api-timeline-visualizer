import {
  TOGGLEABLE_RESOURCE_KINDS,
  type ToggleableResourceKind,
} from '../../utils/resourceTypePrefs';
import { getRequestKindLabel } from '../../utils/formatters';
import { FilterMenu, type FilterMenuItem } from '../shared/FilterMenu';

type ResourceTypeMenuProps = {
  enabledKinds: ToggleableResourceKind[];
  onToggle: (kind: ToggleableResourceKind, enabled: boolean) => void;
  onSetAll: (enabled: boolean) => void;
};

const API_KINDS: ToggleableResourceKind[] = ['fetch', 'xhr', 'document', 'websocket'];
const STATIC_KINDS: ToggleableResourceKind[] = TOGGLEABLE_RESOURCE_KINDS.filter(
  (kind) => !API_KINDS.includes(kind),
);

function toItem(kind: ToggleableResourceKind): FilterMenuItem<ToggleableResourceKind> {
  return {
    value: kind,
    label: (
      <>
        <span className={`kind-dot kind-${kind}`} aria-hidden="true" />
        <span>{getRequestKindLabel(kind)}</span>
      </>
    ),
  };
}

/** 리소스 타입(Fetch/XHR/…/Media) 표시 토글 드롭다운. */
export function ResourceTypeMenu({ enabledKinds, onToggle, onSetAll }: ResourceTypeMenuProps) {
  return (
    <FilterMenu
      buttonLabel="Types"
      menuAriaLabel="리소스 타입 표시"
      groups={[
        { label: '요청', items: API_KINDS.map(toItem) },
        { label: '정적 리소스', items: STATIC_KINDS.map(toItem) },
      ]}
      enabledValues={enabledKinds}
      onToggle={onToggle}
      onSetAll={onSetAll}
    />
  );
}
