import { useCallback } from 'react';
import { usePersistedState } from './usePersistedState';

/**
 * "표준 순서가 있는 값들 중 켜진 것만 배열로 저장"하는 필터 토글 상태.
 *
 * 리소스 타입·HTTP 메서드·상태 그룹·콘솔 레벨이 모두 같은 규칙이라 여기 모은다:
 * 저장 순서는 allValues 순으로 정규화하고 중복은 제거한다. 빈 배열은 "모두 끔"으로
 * 존중한다(각 prefs 모듈의 read가 첫 실행에만 전체 활성을 돌려준다).
 */
export function useToggleableSet<T extends string>(
  allValues: readonly T[],
  read: () => T[],
  write: (values: T[]) => void,
): {
  enabled: T[];
  toggle: (value: T, enabled: boolean) => void;
  setAll: (enabled: boolean) => void;
} {
  const [enabled, setEnabled] = usePersistedState<T[]>(read, write);

  const toggle = useCallback(
    (value: T, on: boolean) => {
      setEnabled((current) => {
        const next = on ? [...current, value] : current.filter((item) => item !== value);
        return allValues.filter((item) => next.includes(item));
      });
    },
    [allValues, setEnabled],
  );

  const setAll = useCallback(
    (on: boolean) => {
      setEnabled(on ? [...allValues] : []);
    },
    [allValues, setEnabled],
  );

  return { enabled, toggle, setAll };
}
