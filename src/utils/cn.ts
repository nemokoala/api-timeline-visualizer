import { twMerge } from 'tailwind-merge';

/**
 * Tailwind 클래스 결합 헬퍼. falsy 조각을 걸러내고, 같은 속성을 겨누는
 * 유틸리티가 겹치면 나중 것이 이기도록 머지한다(caller className 우선).
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return twMerge(parts.filter(Boolean).join(' '));
}
