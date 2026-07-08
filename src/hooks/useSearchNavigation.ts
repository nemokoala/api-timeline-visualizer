import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * 검색 매치 내비게이션 공통 로직.
 *
 * 네트워크·스토리지·콘솔 뷰어가 공유하는 패턴을 한 곳에 모은다:
 * - 현재 매치 인덱스 상태
 * - 검색어/검색 옵션이 바뀌면 인덱스를 0으로 리셋
 * - 매치 단위 이동(goToMatch): 순환(모듈러) 이동
 * - 스코프 단위 이동(goToScope): 요청/행/로그 등 상위 항목 단위 점프
 *
 * occurrences 계산 자체(뷰어마다 다름)와 활성 매치에 따른 부수효과(선택/스크롤)는
 * 호출 측 책임으로 남긴다.
 */
export function useSearchNavigation<T>(
  occurrences: T[],
  searchText: string,
  searchOptions: unknown,
  getNextScopeJumpIndex: (occurrences: T[], currentMatchIndex: number, direction: 1 | -1) => number | null,
): {
  matchIndex: number;
  setMatchIndex: Dispatch<SetStateAction<number>>;
  goToMatch: (direction: 1 | -1) => void;
  goToScope: (direction: 1 | -1) => void;
} {
  const [matchIndex, setMatchIndex] = useState(0);

  useEffect(() => {
    setMatchIndex(0);
  }, [searchText, searchOptions]);

  const goToMatch = useCallback(
    (direction: 1 | -1) => {
      if (!occurrences.length) return;
      setMatchIndex((current) => (current + direction + occurrences.length) % occurrences.length);
    },
    [occurrences],
  );

  const goToScope = useCallback(
    (direction: 1 | -1) => {
      if (!occurrences.length) return;
      setMatchIndex((current) => getNextScopeJumpIndex(occurrences, current, direction) ?? current);
    },
    [getNextScopeJumpIndex, occurrences],
  );

  return { matchIndex, setMatchIndex, goToMatch, goToScope };
}
