import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

type DefinitionListProps = {
  rows: Array<[string, ReactNode]>;
  /** dl에 추가(예: gap-1로 촘촘하게). */
  className?: string;
  /** 각 행 grid에 추가(예: 라벨 열 폭 변경). */
  rowClassName?: string;
  /** dt/dd 공통 텍스트 스타일 덮어쓰기(예: text-[11px]). */
  textClassName?: string;
};

/** 상세 패널 공용 라벨-값 목록. */
export function DefinitionList({ rows, className, rowClassName, textClassName }: DefinitionListProps) {
  return (
    <dl className={cn('m-0 grid gap-2', className)}>
      {rows.map(([label, value]) => (
        <div key={label} className={cn('grid grid-cols-[92px_minmax(0,1fr)] gap-2.5', rowClassName)}>
          <dt className={cn('text-[12px] text-ink-weak', textClassName)}>{label}</dt>
          <dd className={cn('m-0 min-w-0 text-[12px] text-ink [overflow-wrap:anywhere]', textClassName)}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
