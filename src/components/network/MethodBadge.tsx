import { cn } from '../../utils/cn';

/* GET 등 기본은 파랑, 쓰기 계열은 주황, DELETE는 빨강. */
function methodTone(method: string): string {
  switch (method.toUpperCase()) {
    case 'POST':
    case 'PUT':
    case 'PATCH':
      return 'bg-warn-soft text-warn-strong';
    case 'DELETE':
      return 'bg-danger-soft text-danger';
    default:
      return 'bg-accent-soft text-accent-strong';
  }
}

const sizes = {
  /** 드롭다운/목록용 기본 크기. */
  md: 'min-w-[46px] rounded-md px-1.5 py-[2px] text-center text-[11px]',
  /** 타임라인 행·상세 타이틀용 컴팩트 크기. */
  sm: 'min-w-10 rounded-md px-[5px] py-px text-center text-[10px]',
  /** 플로우 노드 상단용 — 폭 제한 없이 한 줄 높이에 맞춘다. */
  node: 'min-w-0 rounded-[5px] px-[5px] text-[10px] leading-4',
};

type MethodBadgeProps = {
  method: string;
  size?: keyof typeof sizes;
  className?: string;
};

/** HTTP 메서드 뱃지(GET/POST/…) — 메서드별 색조. */
export function MethodBadge({ method, size = 'md', className }: MethodBadgeProps) {
  return (
    <span className={cn('flex-none font-bold', sizes[size], methodTone(method), className)}>
      {method}
    </span>
  );
}
