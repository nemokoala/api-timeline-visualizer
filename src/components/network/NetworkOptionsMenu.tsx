import { useEffect, useRef } from 'react';
import { MenuCheckItem, MenuSurface } from '../ui/Menu';
import { useT } from '../../i18n';

type NetworkOptionsMenuProps = {
  /** 메뉴를 띄울 화면 좌표(보통 커서 위치). */
  x: number;
  y: number;
  clearOnReload: boolean;
  onClearOnReloadChange: (value: boolean) => void;
  onClose: () => void;
};

/**
 * 네트워크 툴바 우클릭 설정 메뉴. 바깥 클릭·Escape로 닫히지만,
 * 항목 토글로는 닫히지 않는다(설정을 켠 뒤 바깥을 눌러 닫도록).
 */
export function NetworkOptionsMenu({
  x,
  y,
  clearOnReload,
  onClearOnReloadChange,
  onClose,
}: NetworkOptionsMenuProps) {
  const t = useT();
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

  return (
    <MenuSurface ref={menuRef} style={{ top: y, left: x }} role="menu" aria-label={t('networkOptions.aria')}>
      <MenuCheckItem
        checked={clearOnReload}
        onClick={() => onClearOnReloadChange(!clearOnReload)}
      >
        {t('networkOptions.clearOnReload')}
      </MenuCheckItem>
    </MenuSurface>
  );
}
