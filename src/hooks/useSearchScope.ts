import { useMemo, type Dispatch, type SetStateAction } from 'react';
import type { PanelSearchModel } from '../contexts/WorkspaceContext';
import type { SearchOptions } from '../utils/searchHighlight';
import { useSearchNavigation } from './useSearchNavigation';

/**
 * 세 뷰(네트워크·스토리지·콘솔)의 검색 요약이 공유하는 모양.
 * `*Order` 필드 이름만 뷰마다 달라서 getScopeOrder로 읽는다.
 */
type ScopeSummary = { hitCount: number; globalStart: number; globalEnd: number };

export type SearchScope<O, S extends ScopeSummary> = {
  matchIndex: number;
  setMatchIndex: Dispatch<SetStateAction<number>>;
  /** 스코프(요청/행/로그) 단위 히트 요약. 키는 getScopeKey가 만든다. */
  summary: Map<string, S>;
  activeOccurrence: O | null;
  /** 전체 히트 중 현재 위치(1-base). 검색어나 히트가 없으면 null. */
  activeGlobalIndex: number | null;
  /** 패널 검색바가 쓰는 모델. 라벨·placeholder만 뷰마다 다르다. */
  toModel: (labels: { scopeLabel: string; placeholder: string }) => PanelSearchModel;
};

/**
 * 검색 매치 내비게이션 + 스코프 요약을 한 벌로 묶는다.
 *
 * 세 뷰가 "occurrences를 세고 → 매치 인덱스를 관리하고 → 스코프 단위로 점프하고 →
 * 검색바 모델을 만든다"는 같은 절차를 반복하던 것을 여기로 모았다. occurrences 계산과
 * 활성 매치의 부수효과(선택/스크롤)는 useSearchNavigation과 마찬가지로 호출부 몫이다.
 *
 * summarize·getNextScopeJumpIndex는 참조가 안정적인 최상위 함수를 넘길 것
 * (매 렌더 새 함수를 주면 요약이 매번 다시 계산된다).
 */
export function useSearchScope<O, S extends ScopeSummary>({
  occurrences,
  searchText,
  setSearchText,
  searchOptions,
  summarize,
  getScopeKey,
  getScopeOrder,
  getNextScopeJumpIndex,
}: {
  occurrences: O[];
  searchText: string;
  setSearchText: Dispatch<SetStateAction<string>>;
  searchOptions: Required<SearchOptions>;
  summarize: (occurrences: O[]) => Map<string, S>;
  getScopeKey: (occurrence: O) => string;
  getScopeOrder: (summary: S) => number;
  getNextScopeJumpIndex: (
    occurrences: O[],
    currentMatchIndex: number,
    direction: 1 | -1,
  ) => number | null;
}): SearchScope<O, S> {
  const { matchIndex, setMatchIndex, goToMatch, goToScope } = useSearchNavigation(
    occurrences,
    searchText,
    searchOptions,
    getNextScopeJumpIndex,
  );

  const summary = useMemo(() => summarize(occurrences), [occurrences, summarize]);

  const activeOccurrence = occurrences[matchIndex] ?? null;
  const activeSummary = activeOccurrence ? summary.get(getScopeKey(activeOccurrence)) : undefined;
  const activeScopeOrder = activeSummary ? getScopeOrder(activeSummary) : 0;
  const activeGlobalIndex =
    searchText.trim() && occurrences.length > 0 ? matchIndex + 1 : null;

  const toModel = ({ scopeLabel, placeholder }: { scopeLabel: string; placeholder: string }) => ({
    searchText,
    onSearchTextChange: setSearchText,
    occurrenceCount: occurrences.length,
    matchIndex,
    scopeJumpCount: summary.size,
    activeScopeOrder,
    scopeLabel,
    placeholder,
    onNext: () => goToMatch(1),
    onPrevious: () => goToMatch(-1),
    onNextScope: () => goToScope(1),
    onPreviousScope: () => goToScope(-1),
  });

  return { matchIndex, setMatchIndex, summary, activeOccurrence, activeGlobalIndex, toModel };
}
