import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: ReactNode;
  /** 안내 문구(선택). */
  children?: ReactNode;
};

/** 목록/캔버스가 비었을 때의 중앙 안내 블록. */
export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className="grid min-h-[220px] place-content-center gap-[7px] text-center text-ink-weak">
      <strong className="text-[14px] text-ink-strong">{title}</strong>
      {children ? <span>{children}</span> : null}
    </div>
  );
}
