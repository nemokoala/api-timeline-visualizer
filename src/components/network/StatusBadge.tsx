import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

/* 상태 톤별 글자색. bad는 강조를 위해 진한 빨강 원색(--red). */
const TONE_TEXT: Record<string, string> = {
  good: 'text-ok',
  warn: 'text-warn',
  bad: 'text-danger-bg',
};

type StatusBadgeProps = {
  /** good | warn | bad | 그 외(중립: 글자색 상속). */
  tone?: string;
  /** badge = 회색 알약(메뉴/목록), node = 플로우 노드 상단(배경 없음 + · 구분점). */
  variant?: 'badge' | 'node';
  children: ReactNode;
};

/** HTTP 상태 뱃지(200/4xx/Error 등). */
export function StatusBadge({ tone, variant = 'badge', children }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        variant === 'badge'
          ? 'rounded-md bg-fill px-[7px] py-[2px] text-[11px] font-bold'
          : "text-[10px] font-semibold leading-4 before:mr-[5px] before:font-normal before:text-ink-faint before:content-['·']",
        tone ? TONE_TEXT[tone] : '',
      )}
    >
      {children}
    </span>
  );
}
