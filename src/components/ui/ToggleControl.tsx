/** 공용 체크박스 토글(Group time, Auto-scroll, Wrap lines 등). */
export function ToggleControl({
  checked,
  onChange,
  label,
  size = 'md',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** md = 툴바 기본(28px), sm = 네트워크 액션 행의 sm 버튼(24px)과 동일 높이. */
  size?: 'md' | 'sm';
}) {
  const isSm = size === 'sm';
  return (
    <label
      className={`inline-flex select-none items-center gap-[7px] bg-fill font-medium text-ink-sub ${
        isSm ? 'h-6 rounded-lg px-[9px] text-[11px]' : 'h-7 rounded-[9px] px-[11px] text-xs'
      }`}
    >
      <input
        type="checkbox"
        className="m-0 h-3.5 w-3.5 accent-accent"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
