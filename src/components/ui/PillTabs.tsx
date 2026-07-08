import type { ReactNode } from 'react';

export type PillTabOption<T extends string> = {
  value: T;
  label: ReactNode;
  /** 탭 라벨 옆 카운트 뱃지(스토리지 탭 등). */
  count?: number;
};

type PillTabsProps<T extends string> = {
  value: T;
  options: Array<PillTabOption<T>>;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** 컨테이너에 덧붙일 유틸리티(테두리/패딩 등 배치용). */
  className?: string;
};

/** 공용 알약 탭(콘솔 레벨 필터, 스토리지 탭 등). 단일 선택. */
export function PillTabs<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
}: PillTabsProps<T>) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={`flex items-center gap-1.5 ${className}`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`inline-flex h-7 flex-none cursor-pointer items-center gap-[7px] rounded-full border-0 px-3 text-xs font-semibold ${
              active
                ? 'bg-accent-soft text-accent-strong'
                : 'bg-fill text-ink-weak hover:bg-fill-hover hover:text-ink-sub'
            }`}
          >
            {option.label}
            {option.count !== undefined ? (
              <span
                className={`min-w-[18px] rounded-full px-1.5 py-px text-center text-[10px] leading-[15px] ${
                  active ? 'bg-[rgba(49,130,246,0.14)] text-accent-strong' : 'bg-(--count-bg) text-ink-weak'
                }`}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
