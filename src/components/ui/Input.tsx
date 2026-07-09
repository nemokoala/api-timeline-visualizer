import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '../../utils/cn';

export type InputSize = 'md' | 'sm';

/* preflight 미사용이라 폼 요소는 브라우저 기본 폰트를 갖는다 — 앱 폰트를 상속시킨다.
   (font-family만 지정해 text-* 크기 유틸리티와 충돌하지 않게 한다.) */
const base =
  'min-w-0 rounded-lg border border-line bg-surface text-ink-strong [font-family:inherit] ' +
  'transition-[border-color] duration-[120ms] placeholder:text-ink-faint focus:border-accent focus:outline-none';

const sizes: Record<InputSize, string> = {
  md: 'h-7 px-2.5 text-xs',
  sm: 'h-6 px-2 text-[11px]',
};

function fieldClassName(size: InputSize | undefined, className?: string): string {
  return cn(base, size ? sizes[size] : '', className);
}

/* HTML의 size(글자 수) 속성은 쓰지 않으므로 크기 프리셋으로 대체한다. */
type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  /** md(높이 28px) | sm(높이 24px). 생략하면 크기 규칙 없이 기본 스타일만. */
  size?: InputSize;
};

/** 공통 텍스트 입력. 포커스 시 파란 테두리. */
export function Input({ size = 'md', className, ...rest }: InputProps) {
  return <input className={fieldClassName(size, className)} {...rest} />;
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  size?: InputSize;
};

/** 공통 셀렉트 — Input과 같은 외형. */
export function Select({ size = 'md', className, ...rest }: SelectProps) {
  return <select className={fieldClassName(size, className)} {...rest} />;
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** 공통 텍스트영역 — 크기(높이/패딩/폰트)는 호출부에서 지정한다. */
export function TextArea({ className, ...rest }: TextAreaProps) {
  return <textarea className={fieldClassName(undefined, className)} {...rest} />;
}
