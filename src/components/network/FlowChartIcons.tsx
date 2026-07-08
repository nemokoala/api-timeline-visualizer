/**
 * Flow 차트 도구막대용 인라인 SVG 아이콘들.
 * currentColor로 그려 버튼 상태에 따라 색이 따라온다.
 */

export function TextIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 6.5V5h14v1.5M12 5v14M9.5 19h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SquareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function ResetIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 5v5h5M5.5 14a7 7 0 1 0 1.8-7.2L5 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 맨 앞으로(위 레이어가 강조된 두 장).
export function BringToFrontIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="9" y="9" width="11" height="11" rx="2" fill="currentColor" />
    </svg>
  );
}

// 맨 뒤로(아래 레이어가 강조된 두 장).
export function SendToBackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="11" height="11" rx="2" fill="currentColor" />
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" fill="var(--surface)" />
    </svg>
  );
}

// 복사(겹친 두 장의 종이) 아이콘.
export function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 15.5V6.5A1.5 1.5 0 0 1 6.5 5H15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
