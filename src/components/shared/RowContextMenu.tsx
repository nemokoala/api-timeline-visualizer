import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../../i18n';
import { MenuActionItem, MenuSeparator, MenuSurface } from '../ui/Menu';

export type RowContextMenuItem = {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** 이 항목 위에 구분선을 그린다(그룹 구분용). */
  separatorBefore?: boolean;
};

type RowContextMenuProps = {
  /** 메뉴를 띄울 화면 좌표(보통 커서 위치). */
  x: number;
  y: number;
  items: RowContextMenuItem[];
  onClose: () => void;
};

/**
 * 행 우클릭 컨텍스트 메뉴(복사·삭제 등 행 동작 공용).
 * 바깥 클릭·Escape·항목 선택 시 닫힌다. ColumnMenu의 닫힘 처리와 동일하게 맞춘다.
 */
export function RowContextMenu({ x, y, items, onClose }: RowContextMenuProps) {
  const t = useT();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

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

  // 커서가 뷰포트 오른쪽/아래 가장자리에 붙으면 메뉴가 잘리므로,
  // 렌더 직후(paint 전) 실제 크기를 재서 반대쪽으로 뒤집는다.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const margin = 8;
    const nextX =
      x + rect.width > window.innerWidth - margin
        ? Math.max(margin, window.innerWidth - rect.width - margin)
        : x;
    const nextY =
      y + rect.height > window.innerHeight - margin
        ? Math.max(margin, window.innerHeight - rect.height - margin)
        : y;
    setPosition({ x: nextX, y: nextY });
  }, [x, y]);

  const handleSelect = (item: RowContextMenuItem) => {
    if (item.disabled) return;
    item.onSelect();
    onClose();
  };

  return (
    <MenuSurface
      ref={menuRef}
      style={{ top: position.y, left: position.x }}
      role="menu"
      aria-label={t('rowMenu.aria')}
    >
      {items.map((item) => (
        <div key={item.id}>
          {item.separatorBefore ? <MenuSeparator /> : null}
          <MenuActionItem disabled={item.disabled} onClick={() => handleSelect(item)}>
            {item.label}
          </MenuActionItem>
        </div>
      ))}
    </MenuSurface>
  );
}
