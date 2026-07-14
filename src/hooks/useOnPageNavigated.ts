import { useEffect, useRef } from 'react';

/**
 * 검사 중인 페이지가 새로고침·이동될 때 호출된다(chrome.devtools.network.onNavigated).
 *
 * 핸들러는 ref로 최신 값을 읽으므로, 매 렌더 새 함수를 넘겨도 리스너를 다시 붙이지 않는다.
 * onNavigated는 실제 DevTools에서만 발생하므로 npm run dev(목업)에서는 호출되지 않는다.
 */
export function useOnPageNavigated(handler: () => void): void {
  const latestHandler = useRef(handler);
  latestHandler.current = handler;

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.devtools?.network) return;

    const handleNavigated = () => latestHandler.current();
    chrome.devtools.network.onNavigated.addListener(handleNavigated);

    return () => {
      chrome.devtools.network.onNavigated.removeListener(handleNavigated);
    };
  }, []);
}
