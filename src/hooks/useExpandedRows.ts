import { useCallback, useState } from 'react';

/** 표에서 JSON을 펼쳐 둔 행 id 집합. 행 id는 호출부가 정하는 임의의 문자열. */
export function useExpandedRows() {
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const isExpanded = useCallback((id: string) => expandedIds.has(id), [expandedIds]);

  return { expandedIds, isExpanded, toggle };
}
