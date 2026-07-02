import { useEffect, useRef } from 'react';

type ColumnMenuOption = { id: string; label: string; checked: boolean };

type ColumnMenuProps<T extends string> = {
  columns: Array<{ id: T; label: string }>;
  visibility: Record<T, boolean>;
  position: { x: number; y: number };
  /** 최소 몇 개 컬럼을 항상 표시할지 (기본값: 1). 0이면 모두 숨길 수 있음 */
  minVisible?: number;
  /** 컬럼 목록 아래 구분선과 함께 표시할 추가 토글 옵션. */
  options?: ColumnMenuOption[];
  onToggle: (id: T) => void;
  onToggleOption?: (id: string) => void;
  onClose: () => void;
};

export function ColumnMenu<T extends string>({
  columns,
  visibility,
  position,
  minVisible = 1,
  options,
  onToggle,
  onToggleOption,
  onClose,
}: ColumnMenuProps<T>) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const visibleCount = columns.filter((col) => visibility[col.id]).length;

  return (
    <div
      ref={menuRef}
      className="column-menu"
      style={{ top: position.y, left: position.x }}
      role="menu"
      aria-label="열 표시 설정"
    >
      {columns.map((col) => {
        const isVisible = visibility[col.id] ?? false;
        const isLastVisible = isVisible && visibleCount <= minVisible;
        return (
          <button
            key={col.id}
            type="button"
            role="menuitemcheckbox"
            aria-checked={isVisible}
            className={`column-menu-item ${isVisible ? 'checked' : ''}`}
            disabled={isLastVisible}
            onClick={() => onToggle(col.id)}
          >
            <span className="column-menu-check" aria-hidden="true">
              {isVisible ? '✓' : ''}
            </span>
            <span>{col.label}</span>
          </button>
        );
      })}
      {options && options.length > 0 ? (
        <>
          <div className="column-menu-separator" role="separator" />
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitemcheckbox"
              aria-checked={option.checked}
              className={`column-menu-item ${option.checked ? 'checked' : ''}`}
              onClick={() => onToggleOption?.(option.id)}
            >
              <span className="column-menu-check" aria-hidden="true">
                {option.checked ? '✓' : ''}
              </span>
              <span>{option.label}</span>
            </button>
          ))}
        </>
      ) : null}
    </div>
  );
}
