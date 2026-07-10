/**
 * 콘솔 REPL 엔트리 빌더.
 *
 * 사용자가 입력한 표현식(input)과 그 평가 결과(result)를 캡처 로그와 같은 엔트리
 * 스트림에 끼워 넣기 위해 ConsoleEntry 형태로 만든다. 두 레벨 모두 필터 대상이 아니라
 * 항상 표시된다(consoleLevelPrefs 참고).
 */
import type { ConsoleEntry } from '../types/console';
import type { ConsoleEvalResult } from './consoleInspector';

let replSeq = 0;

// 캡처 엔트리 id(`console_...`)와 겹치지 않게 별도 접두사를 쓴다.
function nextReplId(): string {
  replSeq += 1;
  return `console_repl_${Date.now()}_${replSeq}`;
}

/** REPL 입력을 그대로 되비추는 엔트리. 인자 없이 표현식 문자열만 담는다. */
export function buildReplInputEntry(expression: string): ConsoleEntry {
  return {
    id: nextReplId(),
    level: 'input',
    timestamp: Date.now(),
    args: [],
    text: expression,
  };
}

/** REPL 평가 결과 엔트리. 던져진 예외도 정상 결과처럼 result 레벨로 흘려보낸다. */
export function buildReplResultEntry(result: ConsoleEvalResult): ConsoleEntry {
  const { value, threw } = result;
  return {
    id: nextReplId(),
    level: 'result',
    timestamp: Date.now(),
    // 예외는 메시지 문자열뿐이라 인자 블록을 만들지 않는다. 성공 값은 객체/배열이면
    // args[0]으로 넘겨 JsonViewer/JsonTree 경로로 펼쳐 볼 수 있게 한다.
    args: threw ? [] : [value],
    text: stringifyReplValue(value),
  };
}

// 캡처 로그의 in-page formatArgText와 같은 규칙으로 결과 값을 한 줄 텍스트로 만든다.
function stringifyReplValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
