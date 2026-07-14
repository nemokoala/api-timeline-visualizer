import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { ConsoleEntry } from '../types/console';
import {
  canInspectConsole,
  drainConsoleEntries,
  getConsolePollInterval,
  installConsoleCapture,
} from '../utils/consoleInspector';
import { getMockConsoleEntries, shouldUseMockData } from '../mocks/mockData';

// 콘솔 엔트리 상한. 네트워크(slice(-999))처럼 최근 것만 남기고 오래된 건 버려
// 메모리·필터·렌더 비용을 묶는다. setInterval 로깅 페이지를 오래 열어둬도 안전하다.
const CONSOLE_MAX = 10000;

/**
 * 검사 대상 페이지의 콘솔 로그를 캡처해 쌓는다.
 *
 * 페이지에 훅을 주입하고(installConsoleCapture) 주기적으로 버퍼를 비워 온다.
 * setter를 함께 돌려주는 이유는 콘솔 REPL이 입력/결과 줄을 같은 스트림에 끼워 넣기 때문이다.
 */
export function useConsoleCapture(): [ConsoleEntry[], Dispatch<SetStateAction<ConsoleEntry[]>>] {
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);

  useEffect(() => {
    if (!canInspectConsole()) return;

    let cancelled = false;
    let captureInstalled = false;

    const poll = async () => {
      if (cancelled) return;

      try {
        if (!captureInstalled) {
          await installConsoleCapture(true);
          captureInstalled = true;
        }
        const { installed, entries: drained } = await drainConsoleEntries();
        // 페이지가 새로고침/이동되면 주입한 훅이 사라진다. 이 경우 drain은 예외 없이
        // installed=false를 돌려주므로, 플래그를 리셋해 다음 틱에 재설치한다.
        // (이 처리가 없으면 콘솔이 조용히 영영 비어버린다.)
        if (!installed) {
          captureInstalled = false;
          return;
        }
        if (drained.length) {
          setEntries((current) => {
            const combined = current.length ? [...current, ...drained] : drained;
            return combined.length > CONSOLE_MAX ? combined.slice(-CONSOLE_MAX) : combined;
          });
        }
      } catch {
        // Page reloading — reset flag so capture is reinstalled on next poll.
        captureInstalled = false;
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, getConsolePollInterval());

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  // 로컬 개발(npm run dev)에서는 DevTools 컨텍스트가 없어 캡처가 돌지 않으므로 목업을 넣는다.
  useEffect(() => {
    if (!shouldUseMockData()) return;
    setEntries(getMockConsoleEntries());
  }, []);

  return [entries, setEntries];
}
