export type ConsoleLevel =
  | 'log'
  | 'info'
  | 'warn'
  | 'error'
  | 'debug'
  | 'table'
  | 'dir'
  | 'clear'
  // REPL 입력(input)과 평가 결과(result)는 사용자가 직접 만드는 레벨이다.
  // 캡처 로그가 아니라 레벨 필터 대상이 아니며(FILTERABLE_CONSOLE_LEVELS에 없음) 항상 표시된다.
  | 'input'
  | 'result';

export type ConsoleEntry = {
  id: string;
  level: ConsoleLevel;
  timestamp: number;
  args: unknown[];
  text: string;
  stack?: string;
  source?: string;
  repeatCount?: number;
};
