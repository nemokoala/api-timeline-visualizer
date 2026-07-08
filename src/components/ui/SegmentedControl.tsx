import type { ReactNode } from 'react';

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  title?: string;
  /** 옵션별 추가 유틸리티(예: 열림 상태 점 표시). */
  className?: string;
};

type SegmentedControlProps<T extends string> = {
  value: T;
  options: Array<SegmentedOption<T>>;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** md = 기본(26px 버튼), sm = 툴바 행에 맞춘 컴팩트(22px 버튼). */
  size?: 'md' | 'sm';
};

/**
 * 공용 세그먼트 토글(Flow/Timeline, cURL/fetch 등).
 * Tailwind 유틸리티로만 스타일링한다 — global.css 클래스를 덧대지 말 것.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'md',
}: SegmentedControlProps<T>) {
  const isSm = size === 'sm';
  return (
    <div
      className={`inline-flex shrink-0 items-center bg-fill ${isSm ? 'rounded-[9px] p-[2px]' : 'rounded-[11px] p-[3px]'}`}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={`cursor-pointer border-0 font-semibold ${
              isSm ? 'h-[22px] rounded-[7px] px-[9px] text-[11px]' : 'h-[26px] rounded-lg px-[11px]'
            } ${
              active
                ? 'bg-seg-active text-ink-strong shadow-[0_1px_3px_rgba(25,31,40,0.12)]'
                : 'bg-transparent text-ink-weak'
            } ${option.className ?? ''}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
