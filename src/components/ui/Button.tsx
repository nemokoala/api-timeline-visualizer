import type { ComponentProps } from 'react';
import { cn } from '../../utils/cn';

export type ButtonTone = 'neutral' | 'accent' | 'danger';

type SharedButtonProps = {
  /** hover 시 강조색. accent=파랑, danger=빨강. 기본은 중립(회색 fill 심화). */
  tone?: ButtonTone;
  /** 평상시 배경 없는 버튼. */
  ghost?: boolean;
  /** 토글형 버튼의 켜짐 상태(파랑 배경). */
  active?: boolean;
  /** 캔버스 위에 떠 있는 버튼(surface 배경 + 그림자). */
  float?: boolean;
};

const base =
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 border-0 p-0 ' +
  'whitespace-nowrap bg-fill font-semibold text-ink-sub ' +
  'transition-colors duration-[120ms] hover:enabled:bg-fill-hover active:enabled:scale-[0.97] ' +
  'disabled:cursor-not-allowed disabled:opacity-45 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid focus-visible:outline-accent';

const toneClasses: Record<ButtonTone, string> = {
  neutral: '',
  accent: 'hover:enabled:bg-accent hover:enabled:text-[#fff]',
  danger: 'hover:enabled:bg-danger-bg hover:enabled:text-[#fff]',
};

function buttonClassName(
  size: string,
  { tone, ghost, active, float }: SharedButtonProps,
  className?: string,
): string {
  return cn(
    base,
    size,
    ghost && 'bg-transparent text-ink-weak hover:enabled:bg-fill-hover hover:enabled:text-ink-sub',
    tone ? toneClasses[tone] : '',
    float && 'bg-surface shadow-float',
    active && 'bg-accent text-[#fff] hover:enabled:bg-accent hover:enabled:text-[#fff]',
    className,
  );
}

// leading-none은 twMerge가 text-*에 밀리지 않도록 크기 클래스 뒤에 둔다(원본 .btn line-height: 1).
const textSizes = {
  md: 'h-7 rounded-[9px] px-3 text-xs leading-none',
  sm: 'h-6 rounded-lg px-[9px] text-[11px] leading-none',
};

type ButtonProps = ComponentProps<'button'> &
  SharedButtonProps & {
    /** md(기본, 높이 28px) | sm(높이 24px) */
    size?: 'md' | 'sm';
  };

/** 텍스트 라벨용 공통 버튼. */
export function Button({
  size = 'md',
  tone,
  ghost,
  active,
  float,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName(textSizes[size], { tone, ghost, active, float }, className)}
      {...rest}
    />
  );
}

const iconSizes = {
  xs: 'h-[22px] min-w-[22px] rounded-md px-1 text-xs leading-none',
  sm: 'h-6 w-6 rounded-lg text-xs leading-none',
  md: 'h-8 w-8 rounded-[10px] leading-none',
  lg: 'h-9 w-9 rounded-[10px] leading-none',
};

type IconButtonProps = ComponentProps<'button'> &
  SharedButtonProps & {
    /** xs(22px) | sm(기본, 24px) | md(32px) | lg(36px) 정사각형 */
    size?: 'xs' | 'sm' | 'md' | 'lg';
  };

/** 아이콘/짧은 글자용 정사각형 공통 버튼. */
export function IconButton({
  size = 'sm',
  tone,
  ghost,
  active,
  float,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName(iconSizes[size], { tone, ghost, active, float }, className)}
      {...rest}
    />
  );
}
