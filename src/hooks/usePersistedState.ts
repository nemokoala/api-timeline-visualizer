import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * 영속 설정과 연결된 상태 훅.
 *
 * 초기값은 read()로 읽고(lazy init), 값이 바뀔 때마다 write(value)로 저장한다.
 * read/write는 prefs 모듈의 최상위 함수처럼 참조가 안정적인 함수여야 한다.
 */
export function usePersistedState<T>(
  read: () => T,
  write: (value: T) => void,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(read);

  useEffect(() => {
    write(value);
  }, [value, write]);

  return [value, setValue];
}
