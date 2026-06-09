export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug' | 'table' | 'dir' | 'clear';

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

export type ConsoleLevelFilter = ConsoleLevel | 'all';
