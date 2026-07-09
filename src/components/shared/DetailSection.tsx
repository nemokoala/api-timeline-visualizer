import { useEffect, useState, type ReactNode } from 'react';
import { getDetailSectionOpen, setDetailSectionOpen } from '../../utils/detailSectionPrefs';
import { cn } from '../../utils/cn';

type DetailSectionProps = {
  sectionId: string;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  expandForSearch?: boolean;
  searchExpandToken?: string;
  /** compact = 콘솔/스토리지 상세처럼 여백을 줄인 밀도. */
  density?: 'default' | 'compact';
  /** 섹션 루트에 추가할 클래스. */
  className?: string;
};

export function DetailSection({
  sectionId,
  title,
  children,
  defaultOpen = false,
  expandForSearch = false,
  searchExpandToken = '',
  density = 'default',
  className,
}: DetailSectionProps) {
  const [open, setOpen] = useState(() => getDetailSectionOpen(sectionId, defaultOpen));

  useEffect(() => {
    if (!expandForSearch) return;
    setOpen(true);
    setDetailSectionOpen(sectionId, true);
  }, [expandForSearch, searchExpandToken, sectionId]);

  const handleToggle = () => {
    setOpen((current) => {
      const next = !current;
      setDetailSectionOpen(sectionId, next);
      return next;
    });
  };

  const compact = density === 'compact';

  return (
    <section className={cn('border-b border-line-weak', className)}>
      <button
        className={cn(
          'flex w-full cursor-pointer items-center justify-between gap-2.5 border-0 bg-transparent text-left text-ink-strong hover:bg-surface-sub',
          compact ? 'px-3 py-2' : 'px-4 py-[13px]',
        )}
        type="button"
        aria-expanded={open}
        onClick={handleToggle}
      >
        <span
          className={cn(
            'text-[13px] font-bold tracking-[-0.01em]',
            expandForSearch && 'text-accent-strong',
          )}
        >
          {title}
        </span>
        <span
          className={cn(
            'h-[7px] w-[7px] flex-none border-r-[1.5px] border-b-[1.5px] border-ink-faint transition-transform duration-[120ms]',
            open ? 'rotate-45' : '-rotate-45',
          )}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className={compact ? 'px-3 pt-0 pb-2.5' : 'p-3'}>{children}</div>
      ) : null}
    </section>
  );
}
