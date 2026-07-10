import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../utils/cn';

/** 화면 좌표(fixed)에 뜨는 팝오버 메뉴 컨테이너. top/left는 style로 지정한다. */
export function MenuSurface({ className, ...rest }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'fixed z-30 min-w-[148px] rounded-xl border border-line-weak bg-surface p-[5px] shadow-float',
        className,
      )}
      {...rest}
    />
  );
}

const itemBase =
  'flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-[9px] py-[7px] text-left text-xs text-ink ' +
  'hover:enabled:bg-fill disabled:cursor-not-allowed disabled:opacity-45';

type MenuCheckItemProps = ComponentProps<'button'> & {
  checked: boolean;
  children: ReactNode;
};

/** 체크 표시가 붙는 메뉴 항목(열 표시/필터 토글 공용). */
export function MenuCheckItem({ checked, children, className, ...rest }: MenuCheckItemProps) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      className={cn(itemBase, className)}
      {...rest}
    >
      <span className="inline-flex w-3.5 items-center justify-center text-[11px] text-accent" aria-hidden="true">
        {checked ? '✓' : ''}
      </span>
      {children}
    </button>
  );
}

/** 체크 거터 없는 일반 동작 항목(복사·삭제 등). */
export function MenuActionItem({ children, className, ...rest }: ComponentProps<'button'>) {
  return (
    <button type="button" role="menuitem" className={cn(itemBase, className)} {...rest}>
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="mx-1.5 my-1 h-px bg-line-weak" role="separator" />;
}

export function MenuGroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-[9px] pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-[0.02em] text-ink-weak">
      {children}
    </div>
  );
}
