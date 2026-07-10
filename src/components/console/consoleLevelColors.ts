/** 레벨별 글자색. error는 강조를 위해 진한 빨강 원색(--red). 목록 셀과 필터 메뉴가 공유한다. */
export const CONSOLE_LEVEL_TEXT_COLOR: Record<string, string> = {
  log: 'text-ink-sub',
  info: 'text-accent',
  warn: 'text-warn',
  error: 'text-danger-bg',
  debug: 'text-purple',
  table: 'text-teal',
  dir: 'text-teal',
  // REPL: 입력은 눌러 두고(약한 회색), 결과는 강조색으로 구분한다.
  input: 'text-ink-weak',
  result: 'text-accent',
};
