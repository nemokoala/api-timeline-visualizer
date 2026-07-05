import type { ButtonHTMLAttributes } from 'react';

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

function buttonClassName(
  size: string,
  { tone, ghost, active, float }: SharedButtonProps,
  className?: string,
): string {
  return [
    'btn',
    size,
    ghost ? 'btn-ghost' : '',
    tone && tone !== 'neutral' ? `btn-${tone}` : '',
    float ? 'btn-float' : '',
    active ? 'active' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
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
      className={buttonClassName(`btn-${size}`, { tone, ghost, active, float }, className)}
      {...rest}
    />
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
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
      className={buttonClassName(`btn-icon-${size}`, { tone, ghost, active, float }, className)}
      {...rest}
    />
  );
}
