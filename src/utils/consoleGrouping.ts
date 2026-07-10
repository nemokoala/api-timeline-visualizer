/**
 * 연속된 동일 로그를 한 행으로 접는다(repeatCount로 표시). 콘솔 뷰가 그리는 실제 행 수는
 * 이 그룹핑을 거친 뒤의 개수이므로, 툴바 개수 칩도 같은 함수로 세어 표를 정직하게 반영한다.
 */
import type { ConsoleEntry } from '../types/console';

// 그룹 머리(previous)와 같은 로그인지. 스택이 있는 항목은 접지 않는다(위치 정보 손실 방지).
function canMergeWithGroupHead(previous: ConsoleEntry, entry: ConsoleEntry): boolean {
  return (
    previous.level === entry.level &&
    previous.text === entry.text &&
    previous.source === entry.source &&
    !previous.stack &&
    !entry.stack
  );
}

export function groupRepeatedEntries(entries: ConsoleEntry[]): ConsoleEntry[] {
  const grouped: ConsoleEntry[] = [];

  for (const entry of entries) {
    const previous = grouped[grouped.length - 1];
    if (previous && canMergeWithGroupHead(previous, entry)) {
      previous.repeatCount = (previous.repeatCount ?? 1) + 1;
      continue;
    }

    grouped.push({ ...entry, repeatCount: 1 });
  }

  return grouped;
}

/** groupRepeatedEntries가 만들 행 수만 센다(배열을 만들지 않음). 툴바 개수 칩용. */
export function countGroupedConsoleRows(entries: ConsoleEntry[]): number {
  let count = 0;
  let groupHead: ConsoleEntry | null = null;

  for (const entry of entries) {
    if (groupHead && canMergeWithGroupHead(groupHead, entry)) continue;
    count += 1;
    groupHead = entry;
  }

  return count;
}
