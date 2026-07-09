import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

type DetailTitleBarProps = {
  /** 타이틀 위의 작은 라벨(레벨/서브타이틀). */
  kicker: ReactNode;
  /** kicker를 대문자로 표시(콘솔 레벨 등). */
  kickerCaps?: boolean;
  title: ReactNode;
  /** h2 title 속성(호버 툴팁)용 원문. */
  titleAttr?: string;
  /** 우측 액션 묶음(타임스탬프/버튼들). */
  actions?: ReactNode;
};

/** 콘솔/스토리지 상세 패널 상단의 고정 타이틀 바. */
export function DetailTitleBar({ kicker, kickerCaps, title, titleAttr, actions }: DetailTitleBarProps) {
  return (
    <div className="sticky top-0 z-[1] flex min-w-0 shrink-0 items-start justify-between gap-2 border-b border-line-weak bg-surface px-3 py-2.5">
      <div className="min-w-0">
        <span
          className={cn(
            'block overflow-hidden text-ellipsis whitespace-nowrap text-[10px] leading-[1.2] text-ink-weak',
            kickerCaps && 'uppercase',
          )}
        >
          {kicker}
        </span>
        <h2
          className="mx-0 mt-0.5 mb-0 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-bold leading-[1.3] text-ink-strong"
          title={titleAttr}
        >
          {title}
        </h2>
      </div>
      {actions ? <div className="flex flex-none items-center gap-2">{actions}</div> : null}
    </div>
  );
}
