import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { Button } from '../ui/Button';

export type FilterMenuItem<T extends string> = {
  value: T;
  /** 체크 표시 옆에 렌더할 라벨(색 뱃지 등 자유). */
  label: ReactNode;
};

export type FilterMenuGroup<T extends string> = {
  /** 구분 제목. 없으면 제목/구분선 없이 항목만 나열. */
  label?: string;
  items: FilterMenuItem<T>[];
};

type FilterMenuProps<T extends string> = {
  /** 트리거 버튼 라벨(Types/Method/Status). */
  buttonLabel: string;
  menuAriaLabel: string;
  groups: FilterMenuGroup<T>[];
  enabledValues: T[];
  onToggle: (value: T, enabled: boolean) => void;
  /** 모두 선택(true)/모두 해제(false). */
  onSetAll: (enabled: boolean) => void;
};

/**
 * 체크박스 항목 드롭다운 필터 버튼(Types/Method/Status 공용).
 * 트리거에 `켜짐/전체` 카운트를 표시하고, 메뉴 상단에 모두 선택/모두 해제 버튼을 둔다.
 */
export function FilterMenu<T extends string>({
  buttonLabel,
  menuAriaLabel,
  groups,
  enabledValues,
  onToggle,
  onSetAll,
}: FilterMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const enabledSet = new Set(enabledValues);
  const totalCount = groups.reduce((sum, group) => sum + group.items.length, 0);

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
        {buttonLabel}
        <span className="resource-type-count">
          {enabledValues.length}/{totalCount}
        </span>
      </Button>
      {open ? (
        <div
          ref={menuRef}
          className="column-menu resource-type-popover"
          style={{ top: position.y, left: position.x }}
          role="menu"
          aria-label={menuAriaLabel}
        >
          <div className="mb-1 flex gap-1 border-b border-line-weak px-1 pt-0.5 pb-1.5">
            <button
              type="button"
              className="h-[22px] flex-1 cursor-pointer rounded-[7px] border-0 bg-fill px-2 text-[11px] font-semibold text-ink-sub hover:enabled:bg-fill-hover hover:enabled:text-ink disabled:cursor-default disabled:opacity-45"
              onClick={() => onSetAll(true)}
              disabled={enabledValues.length === totalCount}
            >
              모두 선택
            </button>
            <button
              type="button"
              className="h-[22px] flex-1 cursor-pointer rounded-[7px] border-0 bg-fill px-2 text-[11px] font-semibold text-ink-sub hover:enabled:bg-fill-hover hover:enabled:text-ink disabled:cursor-default disabled:opacity-45"
              onClick={() => onSetAll(false)}
              disabled={enabledValues.length === 0}
            >
              모두 해제
            </button>
          </div>
          {groups.map((group, groupIndex) => (
            <div key={group.label ?? groupIndex}>
              {groupIndex > 0 || group.label ? (
                <div className="column-menu-separator" role="separator" />
              ) : null}
              {group.label ? (
                <div className="resource-type-group-label">{group.label}</div>
              ) : null}
              {group.items.map((item) => {
                const checked = enabledSet.has(item.value);
                return (
                  <button
                    key={item.value}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={checked}
                    className={`column-menu-item ${checked ? 'checked' : ''}`}
                    onClick={() => onToggle(item.value, !checked)}
                  >
                    <span className="column-menu-check" aria-hidden="true">
                      {checked ? '✓' : ''}
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
