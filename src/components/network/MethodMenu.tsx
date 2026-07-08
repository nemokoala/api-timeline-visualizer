import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  FILTERABLE_METHODS,
  type FilterableMethod,
} from '../../utils/requestFilterPrefs';
import { Button } from '../ui/Button';

type MethodMenuProps = {
  enabledMethods: FilterableMethod[];
  onToggle: (method: FilterableMethod, enabled: boolean) => void;
};

/** HTTP 메서드 표시 토글 드롭다운. ResourceTypeMenu(Types)와 같은 패턴. */
export function MethodMenu({ enabledMethods, onToggle }: MethodMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const enabledSet = new Set(enabledMethods);

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

  return (
    <>
      <Button size="sm" active={open} onClick={toggleOpen} aria-expanded={open} aria-haspopup="menu">
        Method
        <span className="resource-type-count">
          {enabledMethods.length}/{FILTERABLE_METHODS.length}
        </span>
      </Button>
      {open ? (
        <div
          ref={menuRef}
          className="column-menu resource-type-popover"
          style={{ top: position.y, left: position.x }}
          role="menu"
          aria-label="HTTP 메서드 표시"
        >
          {FILTERABLE_METHODS.map((method) => {
            const checked = enabledSet.has(method);
            return (
              <button
                key={method}
                type="button"
                role="menuitemcheckbox"
                aria-checked={checked}
                className={`column-menu-item ${checked ? 'checked' : ''}`}
                onClick={() => onToggle(method, !checked)}
              >
                <span className="column-menu-check" aria-hidden="true">
                  {checked ? '✓' : ''}
                </span>
                <span className={`method method-${method.toLowerCase()}`}>
                  {method === 'OTHER' ? 'Other' : method}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
