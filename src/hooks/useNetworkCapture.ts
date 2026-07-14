import { useEffect, useRef, useState } from 'react';
import type { DevtoolsNetworkRequest } from '../types/chrome-har';
import type { ApiRequest } from '../types/network';
import { parseNetworkRequest, shouldCollectRequest } from '../utils/requestParser';
import {
  canInspectWebSockets,
  drainWebSocketEvents,
  getWebSocketPollInterval,
  installWebSocketCapture,
} from '../utils/websocketInspector';
import { applyWebSocketEvents } from '../utils/websocketRequests';
import { getMockRequests, shouldUseMockData } from '../mocks/mockData';

/**
 * 네트워크 캡처. 성격이 다른 두 소스를 한 목록으로 합친다.
 *
 * - HTTP: chrome.devtools.network.onRequestFinished(HAR 엔트리 = 끝난 요청).
 * - WebSocket: HAR에 프레임이 실리지 않으므로 콘솔과 같은 방식으로 페이지의
 *   window.WebSocket을 계측해 폴링으로 가져온다(websocketInspector).
 *
 * 응답 본문은 원본 DevTools 요청의 getContent로만 읽을 수 있어 networkRequestById에
 * 따로 보관한다(WS·목업 항목은 여기 없다).
 */
export function useNetworkCapture() {
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const networkRequestById = useRef(new Map<string, chrome.devtools.network.Request>());

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.devtools?.network) return;

    const handleRequestFinished = (request: chrome.devtools.network.Request) => {
      const networkRequest = request as DevtoolsNetworkRequest;
      if (!shouldCollectRequest(networkRequest)) return;

      const parsed = parseNetworkRequest(networkRequest);
      networkRequestById.current.set(parsed.id, request);
      setRequests((current) => [...current.slice(-999), parsed]);
    };

    chrome.devtools.network.onRequestFinished.addListener(handleRequestFinished);

    return () => {
      chrome.devtools.network.onRequestFinished.removeListener(handleRequestFinished);
    };
  }, []);

  useEffect(() => {
    if (!canInspectWebSockets()) return;

    let cancelled = false;
    let captureInstalled = false;

    const poll = async () => {
      if (cancelled) return;

      try {
        if (!captureInstalled) {
          await installWebSocketCapture();
          captureInstalled = true;
        }
        const { installed, events } = await drainWebSocketEvents();
        // 페이지가 새로고침되면 주입한 훅이 사라진다 — 다음 틱에 재설치한다.
        if (!installed) {
          captureInstalled = false;
          return;
        }
        if (events.length) {
          setRequests((current) => applyWebSocketEvents(current, events));
        }
      } catch {
        captureInstalled = false;
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, getWebSocketPollInterval());

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  // 로컬 개발(npm run dev): DevTools 컨텍스트가 아니라 실데이터 소스가 없으므로 목업을 주입한다.
  // 확장 프로그램 빌드에서는 shouldUseMockData()가 false라 실행되지 않는다.
  useEffect(() => {
    if (!shouldUseMockData()) return;
    setRequests(getMockRequests());
  }, []);

  return { requests, setRequests, networkRequestById };
}
