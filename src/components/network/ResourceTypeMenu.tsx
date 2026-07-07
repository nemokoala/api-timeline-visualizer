import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { ToggleableResourceKind } from '../../utils/resourceTypePrefs';
import { getRequestKindLabel } from '../../utils/formatters';
import { Button } from '../ui/Button';

type ResourceTypeMenuProps = {
  enabledKinds: ToggleableResourceKind[];
  onToggle: (kind: ToggleableResourceKind, enabled: boolean) => void;
};

const API_KINDS: ToggleableResourceKind[] = ['fetch', 'xhr', 'document', 'websocket'];
const STATIC_KINDS: ToggleableResourceKind[] = ['stylesheet', 'script', 'image', 'font', 'media'];
const TOTAL_KINDS = API_KINDS.length + STATIC_KINDS.length;

/**
 * 리소스 타입(Fetch/XHR/…/Media) 표시 토글을 드롭다운으로 접은 버튼.
 * 토글이 9개라 좁은 폭에서 한 줄 나열이 잘리므로 하나의 "Types" 버튼으로 모은다.
 */
export function ResourceTypeMenu({ enabledKinds, onToggle }: ResourceTypeMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const enabledSet = new Set(enabledKinds);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const toggleOpen = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({ x: rect.left, y: rect.bottom + 4 });
    setOpen(true);
  };

  const renderItem = (kind: ToggleableResourceKind) => {
    const checked = enabledSet.has(kind);
    return (
      <button
        key={kind}
        type="button"
        role="menuitemcheckbox"
        aria-checked={checked}
        className={`column-menu-item ${checked ? 'checked' : ''}`}
        onClick={() => onToggle(kind, !checked)}
      >
        <span className="column-menu-check" aria-hidden="true">
          {checked ? '✓' : ''}
        </span>
        <span className={`kind-dot kind-${kind}`} aria-hidden="true" />
        <span>{getRequestKindLabel(kind)}</span>
      </button>
    );
  };

  return (
    <>
      <Button size="sm" active={open} onClick={toggleOpen} aria-expanded={open} aria-haspopup="menu">
        Types
        <span className="resource-type-count">
          {enabledKinds.length}/{TOTAL_KINDS}
        </span>
      </Button>
      {open ? (
        <div
          ref={menuRef}
          className="column-menu resource-type-popover"
          style={{ top: position.y, left: position.x }}
          role="menu"
          aria-label="리소스 타입 표시"
        >
          <div className="resource-type-group-label">요청</div>
          {API_KINDS.map(renderItem)}
          <div className="column-menu-separator" role="separator" />
          <div className="resource-type-group-label">정적 리소스</div>
          {STATIC_KINDS.map(renderItem)}
        </div>
      ) : null}
    </>
  );
}
