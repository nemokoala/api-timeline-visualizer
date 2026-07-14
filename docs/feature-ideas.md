# 추가 기능 제안

현재 코드베이스를 훑어 "아직 없는 것"만 골라 정리했다. 각 항목의 **근거**는 해당 기능이
지금 구현돼 있지 **않다는** 것을 보여주는 파일·줄이다. 이미 있는 기능(HAR 파싱 타입, 요청 재전송,
응답 diff, 플로우 차트, 코드 스니펫 복사, 워크스페이스 도킹 등)은 제외했다.

우선순위는 대략 위에서 아래 순이다. 노력(S/M/L)과 효과(낮음/보통/높음)를 함께 적었다.

구현이 끝난 항목은 아래 [완료됨](#완료됨)으로 옮긴다.

---

## 1. 테스트·CI — DX / M / 높음

> ESLint는 붙였다(→ [완료됨](#eslint-도입)). 남은 것은 **테스트와 CI**다.

**문제.** 자동 검증이 `tsc`와 ESLint뿐이다. 테스트가 하나도 없는데 순수 로직 유틸은 매우 많다 —
`requestParser.ts`, `jsonDiff.ts`, `jsonTextTokens.ts`, `searchHighlight.tsx`, `sessionIO.ts`,
`networkStats.ts`, `requestTimings.ts`, 그리고 pref 모듈들의 `normalize()`·레거시 마이그레이션.
이들이 회귀해도 잡아낼 그물이 없다. 확장 프로그램이라 UI를 눈으로 확인하는 비용이 비싸서
(실제 확장에서만 도는 코드가 많다) 유틸 단위 테스트의 가성비가 특히 높다.

**제안.** Vitest로 유틸 계층부터 붙인다(파서 → 검색 → diff → 세션 IO → pref normalize 순).
`storageInspector`/`consoleInspector`는 페이지 컨텍스트에 주입하는 eval 스크립트 문자열이 대부분이라
단위 테스트로 의미 있게 덮이지 않으니 제외한다. 그다음 GitHub Actions로 PR마다
`tsc + lint + test + build`를 돌린다.

---

## 2. 표준 HAR 가져오기 / 내보내기 — Export / M / 높음

**문제.** 세션 저장이 자체 포맷이다 — `sessionIO.ts:8`의 `SESSION_VERSION = 1`,
`{version, exportedAt, requests, flowLayout}` 구조. 표준 `.har` 읽기/쓰기가 없다
(`src`에 `.har` 참조 없음. `types/chrome-har.ts`의 `Har*` 타입은 DevTools 요청 파싱 전용이다).
크롬 DevTools·Charles·Postman과 세션을 주고받을 수 없다.

**제안.** HAR 1.2 export(`ApiRequest` → `log.entries`)와 import를 추가한다. `chrome-har.ts`의
`HarRequest`/`HarResponse`/`HarCookie`/`HarPostData`/`HarTimings` 타입을 매핑에 재사용할 수 있다.
Network 툴바의 Export/Import(`NetworkPanel.tsx`)에 포맷 선택을 붙인다.

---

## 3. 정규식 검색 옵션 — Search / M / 보통

**문제.** 검색 옵션이 대소문자 구분(Aa)과 전체 단어(ab) 둘뿐이다
(`SearchOptionToggles.tsx:22-42`, `searchPrefs.ts:37-51`은 `matchCase`/`wholeWord`만 저장하고
`searchHighlight.tsx:39`도 `matchCase`만 쓴다). `/users/\d+` 같은 패턴 검색을 할 수 없다.

**제안.** 토글에 `.*`(regex)를 추가하고 `searchPrefs`에 영속한다. `searchHighlight.tsx`의 매칭이
리터럴/정규식을 모두 처리하도록 확장하고, 잘못된 정규식은 입력창 옆에 조용히 표시한다.
세 뷰(Network/Console/Storage)가 공용 `SearchOptions`를 쓰므로 한 번에 적용된다.

---

## 4. 테이블 방향키 탐색 — A11y / S / 보통

**문제.** 행을 키보드 위/아래로 옮길 수 없다. `DataTable` 행은 `tabIndex=0`에 Enter/Space만
처리한다. 검색 이동은 있지만 일반 목록 탐색은 마우스나 Tab 연타에 의존한다.

**제안.** roving tabindex와 ArrowUp/Down·Home/End 핸들러를 `DataTable`에 넣어 포커스와 선택을 함께
옮긴다. 가상화를 넣으면 `scrollToIndex`와 연동한다.

---

## 5. 모달·메뉴 포커스 트랩과 포커스 복귀 — A11y / M / 보통

**문제.** `ReplayEditorModal`은 Escape만 처리하고 자동 포커스·Tab 순환·닫을 때 트리거로 포커스 복귀가
없다(`ReplayEditorModal.tsx:54-60`). `FilterMenu`는 바깥 클릭/Escape로 닫히지만 메뉴 항목으로 포커스가
들어가거나 방향키로 항목을 오가는 처리가 없다. `Menu.tsx`의 항목에는 role은 있으나 roving tabindex가
없다(`Menu.tsx:23-42`). 새로 붙인 `RowContextMenu`도 같은 한계를 물려받는다.

**제안.** 공용 focus-trap 훅을 만들어 모달에 적용하고(열릴 때 첫 요소 포커스, Tab 순환, 닫힐 때 복귀),
`FilterMenu`/`ColumnMenu`/`RowContextMenu`는 열리면 첫 항목에 포커스하고 ArrowUp/Down·Home/End로
순회하게 한다.

---

## 6. 콘솔 캡처 범위 확장(group/count/assert/trace/time) — Console / M / 보통

**문제.** `installConsoleCapture`가 `['log','info','warn','error','debug','table','dir']`만 래핑한다
(`consoleInspector.ts`). `console.group`/`groupEnd`/`count`/`assert`/`trace`/`time`/`timeEnd`는
잡지 않는다. 게다가 `table`/`dir`은 캡처만 하고 일반 텍스트로 표시된다.

**제안.** 래핑 목록을 넓히고 엔트리에 그룹 depth를 실어 보낸다. 뷰에서는 그룹 들여쓰기·접기,
`console.table`의 표 렌더, `assert` 실패의 error 스타일을 지원한다.

---

## 7. 콘솔·스토리지 내보내기 — Export / S / 보통

**문제.** 내보내기가 네트워크에만 있다. Export 버튼은 `NetworkPanel.tsx`에만 있고,
콘솔 툴바에는 Clear만, 스토리지 헤더에는 Refresh만 있다(`StorageView.tsx`).

**제안.** 콘솔 로그를 JSON/텍스트로, 스토리지 스냅샷(local/session/cookies/indexedDB)을 JSON으로
내보내는 버튼을 각 패널에 붙인다. `sessionIO.ts`의 `downloadJson`을 재사용한다.

---

## 8. Cache Storage / Service Worker 탭 — Storage / L / 보통

**문제.** 스토리지 탭이 localStorage/sessionStorage/Cookies/IndexedDB 넷뿐이다
(`StorageView.tsx`). 크롬 Application 패널의 Cache Storage·Service Worker 조회가 없어
PWA·오프라인 캐시 디버깅을 못 한다.

**제안.** `caches.keys()` → 각 캐시의 `keys()`/`match()`를 `inspectedWindow.eval`로 읽어 Cache Storage
탭을 추가한다(`storageInspector.ts`의 캡처 패턴 재사용). Service Worker 등록 상태는
`navigator.serviceWorker.getRegistrations()`로 읽어 보조 정보로 보여준다.

---

## 9. 응답 본문 타입별 렌더(HTML/XML) — Network / M / 낮음

**문제.** JSON이 아닌 응답은 평문으로만 보인다. `parseResponseContent`는 JSON만 파싱하고 나머지는
원문을 반환한다(`requestParser.ts`). 상세 패널은 응답을 `JsonViewer`로 보내므로
(`mimeType`을 넘기긴 한다) HTML/XML/CSS는 구문 강조도 미리보기도
없다(base64 이미지만 `ImagePreview`로 처리).

**제안.** `mimeType`으로 렌더러를 분기한다 — HTML은 sandbox iframe 미리보기 + 원문 토글,
XML/SVG는 트리, `text/*`는 라이트 구문 강조. `JsonViewer`는 JSON 전용으로 남긴다.

---

## 후속 정리 대상

- **ESLint 경고 67건 정리.** 대부분 React Compiler 기반 새 규칙(`set-state-in-effect` 21,
  `refs` 12)과 `exhaustive-deps`(17), `only-export-components`(14)다. 앞의 둘은 의도한 패턴이라
  경고로 낮춰 둔 것이니(위 [ESLint 도입](#eslint-도입)), 규칙을 끌지 코드를 고칠지 파일별로
  판단해야 한다. `exhaustive-deps`는 진짜 버그가 섞여 있을 수 있어 먼저 볼 값어치가 있다.

- **WebSocket 캡처의 사각지대.** 훅은 `inspectedWindow.eval`로 주입되므로 **패널을 열기 전에 이미
  열려 있던 소켓**과 **Worker/SharedWorker 안에서 만든 소켓**은 잡히지 않는다(그 소켓들은 우리가
  감싼 `window.WebSocket`을 거치지 않는다). 페이지를 새로고침하면 훅이 재주입되어 이후 소켓은
  전부 잡힌다. 근본 해결책은 CDP뿐인데 DevTools가 이미 붙어 있어 `chrome.debugger`를 쓸 수 없다.

- **WS 프레임이 네트워크 검색 대상이 아니다.** `requestSearch.ts`는 URL·헤더·본문만 훑으므로
  프레임 본문은 전역 검색(히트 카운트·↑↓ 내비)에 걸리지 않는다. 상세 패널 안에서 하이라이트는
  되지만 검색이 그 행으로 데려가 주지는 않는다. 프레임을 검색 스코프에 넣으려면 `buildSearchOccurrences`에
  frames를 순회하는 섹션(`messages`)을 추가하고, `getMatchingDetailSections`에도 같은 이름을 물려야 한다.

- **IndexedDB 새 레코드 추가(put/add).** 이번엔 기존 값 수정만 했다. 신규 추가는 키(out-of-line)
  또는 키패스 값(in-line)·autoIncrement 여부에 따라 입력 UI가 달라져 미뤘다. `setIndexedDbRecord`의
  스크립트 패턴을 재사용하되, 스토어의 `keyPath`/`autoIncrement`를 보고 키 입력 필드를 조건부로
  띄우는 폼(`StorageDetailPanel` 또는 스토어 헤더의 "+ Add")이 이 작업의 본체다.

- **행 메뉴에서 편집 후 재전송.** 행 컨텍스트 메뉴의 Resend는 즉시 전송이다(크롬 DevTools의
  "Replay XHR"과 같다). 보내기 전에 URL·헤더·본문을 고치려면 상세 패널의 Edit을 거쳐야 한다.
  행에서 바로 편집기를 열려면 `ReplayEditorModal`의 draft 상태를 `NetworkPanel`로 끌어올려야 하는데,
  draft는 지금 `CodeSnippetBlock` 안에서 cURL/fetch 스니펫과 한 몸이다("미리보기가 곧 보낼 내용").
  그 결합을 푸는 게 이 작업의 본체다.

- **아직 i18n에 안 물린 영어 전용 라벨.** 이번 i18n 이전은 한국어 UI 문자열과 그에 바로 붙어 있던
  영어 문구(툴바 칩, 테마 토글 등)까지만 키로 옮겼다. 원래부터 영어였던 짧은 라벨들 —
  버튼 동사(`Edit`/`Copy`/`Send`/`Reset`/`Cancel`/`+ Add`, `Loading…`/`Sending…`/`Sent ✓`),
  `DetailSection` 제목(`General`/`Headers`/`Cookies`/`Payload`/`Response`/`Timing`/`Replay`),
  `ReplayEditorModal`의 눈썹 문구(`Edit & resend`)와 aria 라벨 몇 개 — 는 그대로 두었다.
  고유명사(`Network`/`Storage`/`Console`/`JSON`/HTTP 메서드/`cURL`/`fetch`)는 의도적으로 제외.
  결과적으로 한국어 모드에서도 이 라벨들은 영어로 남는다. 완전한 이중 언어를 원하면 이들도
  `src/i18n/ko.ts`·`en.ts`에 키를 추가하고 해당 컴포넌트에서 `t()`로 바꾸면 된다.

---

## 완료됨

### ESLint 도입

검증 장치가 `tsc` 하나뿐이었다 — 린터가 없는데 `RequestDetailPanel.tsx:80`엔 `eslint-disable`
주석만 남아 있었다. ESLint 10 flat config(`eslint.config.js`) + `typescript-eslint` +
`react-hooks` + `react-refresh`를 붙이고 `npm run lint`를 추가했다.

**첫 실행에서 실제 버그 1건을 잡았다.** `exportFlowImage.ts`의 `resolveNodeSize`가
`Number(node.style?.width) ?? DEFAULT_NODE_WIDTH`였는데, `Number()`는 `null`/`undefined`를 반환하지
않으므로 `??` 우변이 영영 쓰이지 않는다(`no-constant-binary-expression`). `style.width`가 없거나
`'240px'` 같은 문자열이면 `NaN`이 그대로 흘러가 플로우 차트 이미지 내보내기의 뷰포트 계산이
깨진다. `toPixels()` 헬퍼로 고쳤다 — 숫자로 못 읽으면 `undefined`를 돌려 기본값이 실제로 쓰이게 한다.

**새 React Compiler 규칙 넷은 경고로 낮췄다** — `set-state-in-effect`(21), `refs`(12),
`immutability`, `preserve-manual-memoization`. v7의 이 규칙들이 잡는 곳 대부분은 이 코드베이스가
의도해서 쓰는 패턴이다(렌더 중 `latestRef.current = value`로 최신값을 담아 effect가 "값이 바뀔 때"가
아니라 "트리거가 바뀔 때"만 돌게 하는 식 — `DataTable`의 `rowIndexByIdRef`, `rootRefLatest`).
에러로 두면 린트가 항상 실패해 아무도 안 보게 된다. 하나씩 따져 고치는 건 후속 과제(아래).

`tsc`의 `noUnusedLocals`는 켜지 않았다 — ESLint의 `no-unused-vars`(error)와 역할이 겹친다.
(예전 메모에 있던 `storageSearch.ts:62` 미사용 변수는 이미 없다.)

### App.tsx 분해 — 캡처·필터·검색을 공용 훅으로

WebSocket 폴링을 얹고 나니 App.tsx가 1026줄이 됐는데, 그중 JSX는 24줄뿐이었다. 나머지는 전부
상태와 배선 — 즉 컴포넌트가 아니라 앱 전체의 상태 저장소였다. 특히 반복이 분명했다: 필터 토글
핸들러 8개(리소스·메서드·상태·콘솔레벨)가 "배열에 넣고 빼고 표준 순서로 정규화"를 네 번 복붙했고,
검색 오케스트레이션은 네트워크·스토리지·콘솔이 세 벌이었다. 새 캡처 소스가 생길 때마다 App이
자라는 구조이기도 했다.

훅 다섯 개로 걷어냈다 — `useNetworkCapture`(HTTP `onRequestFinished` + WS 폴링 + 목업),
`useConsoleCapture`, `useOnPageNavigated`, `useToggleableSet`(토글 8개 → 4줄),
`useSearchScope`(검색 3벌 → 각 8줄, 매치 인덱스·스코프 점프·검색바 모델을 한 벌로).
결과 792줄. 세 요약 함수(`build*Summary*`)가 `*Order` 필드 이름만 다르고 구조가 같아서
`getScopeKey`/`getScopeOrder`로 일반화할 수 있었다 — 유틸 자체는 뷰가 타입을 그대로 쓰므로 건드리지 않았다.

응답 본문 로딩·세션 IO·dock 조작·컨텍스트 조립(약 140줄)은 중복이 아니라 단일 목적 코드라 이번엔
남겼다. 여기까지 더 빼면 App은 200줄대가 되지만 손대는 파일이 많아, 테스트가 없는 지금은
회귀 위험이 이득보다 크다고 봤다(1번 항목 참고).

### WebSocket 프레임 캡처 — 네트워크 뷰에서 송수신 내용 보기

**왜 안 보였나.** 네트워크 수집은 `chrome.devtools.network.onRequestFinished`(App.tsx) 하나뿐인데,
이건 HAR 엔트리 = **끝난 HTTP 요청**만 준다. WebSocket은 101 이후 계속 열려 있는 연결이고 프레임은
HAR에 실리지 않으므로 이 API로는 원리상 볼 수 없다. `RequestKind`에 `'websocket'`이 있고
필터 토글에도 WS가 있었지만, 실제로 프레임을 가진 항목이 들어온 적은 없었다.

**어떻게 풀었나.** `chrome.debugger`(CDP `Network.webSocketFrame*`)는 쓸 수 없다 — DevTools가 이미
같은 탭에 붙어 있어 debugger attach가 충돌한다. 그래서 콘솔 캡처(`consoleInspector`)와 **같은 방식**을
택했다: `inspectedWindow.eval`로 페이지의 `window.WebSocket`을 Proxy로 감싸(`websocketInspector.ts`)
send/message/open/close/error를 페이지 쪽 버퍼에 쌓고, 패널이 400ms마다 drain한다. Proxy의
`construct` 트랩이라 `instanceof WebSocket`과 `WebSocket.OPEN` 같은 정적 상수는 원본 그대로 동작한다
(브라우저에서 실측 확인).

**표시.** 각 WS 연결은 `ApiRequest`(`type: 'websocket'`, `status: 101`) 한 항목으로 네트워크 목록에
들어가고(`websocketRequests.ts`가 소켓 id로 제자리 갱신), 상세 패널에서 Messages 섹션이 열린다 —
방향(↑송신/↓수신/•상태)·시각·크기·본문의 가상화 목록이고, 행을 누르면 JsonViewer로 펼쳐진다.
WS 항목에서는 의미 없는 Headers/Cookies/Payload/Response/Replay 섹션을 감춘다. 바이너리 프레임은
내용을 옮기지 않고 크기만 잰다(`[Binary 2.4 KB]`). 연결 지속 시간은 마지막 프레임까지로 늘려
타임라인에서도 길이를 갖는다. 프레임은 연결당 2000개까지 보관하고 넘으면 오래된 것부터 버린다.

### 패널 검색바–필터 행 정렬·디자인 정리

검색 input 가시성 개선(746083b) 때 input을 알약형 컨테이너로 감쌌지만 행의 좌우 패딩은
예전 값(`pl-2.5 pr-1.5`)을 그대로 둬서, 아래 Include/Exclude 필터 행(`px-2`)과 좌우 가장자리가
2px씩 어긋났다(펼친 필터가 있는 패널에서 재현). 두 행 모두 `px-2`로 통일하고, 알약 밖에
떠 있던 Aa/ab 토글은 VS Code처럼 검색 알약 **안쪽 오른쪽**으로 옮겨 아래 행의 꽉 찬 알약들과
시각 언어를 맞췄다. 토글이 안으로 들어가면서 검색 내비 클러스터의 왼쪽 구분선(`border-l`)은
알약 테두리와 이중선이 되어 제거했고, 필터 행의 고정 높이(`h-[30px]`)를 걷어내 홀수 픽셀
여백(1px/5px)을 정리했다. 처음엔 두 행 사이가 2px라 알약끼리 붙어 보인다는 피드백이 있어
필터 행에 `pt-0.5`를 줘 행 간 4px / 하단 4px로 맞췄다. Include/Exclude placeholder에도 `placeholder:text-ink-faint`를 줘서
검색창과 톤을 통일했다.

### 전역 설정 창(⚙)

설정이 여기저기 흩어져 있었다 — 특히 JSON 표시(가이드선·무지개색)와 "새로고침 시 기록 지우기"는
**우클릭 메뉴에만** 있어 사실상 아무도 못 찾았다. 툴바에 톱니바퀴(⚙) → `SettingsModal`을 두어
**전역 설정만** 한곳에 모았다. 크롬 DevTools의 설정 기어와 같은 패턴이다.

- **넣은 것**: 모양(테마 라이트/다크, 언어 한/영), JSON 표시(들여쓰기 가이드·무지개색),
  캡처(새로고침 시 기록 지우기). 라벨은 i18n 키(기존 `jsonViewer.*`·`networkOptions.*` 재사용).
- **안 넣은 것**: 필터·wrap·auto-scroll·컬럼·레이아웃 같은 **뷰별 컨텍스트 컨트롤**은 쓰는 자리에
  그대로 뒀다(모달로 옮기면 오히려 불편). 즉 "모든 설정을 모으는 창"이 아니라 "흩어진 전역 설정을
  한곳에서도 만질 수 있게"가 목표다.
- **동기화**: JSON 표시는 뷰어 우클릭 메뉴와 **같은 pref store(`useJsonViewPrefs`)** 를 쓰므로
  어느 쪽에서 바꾸든 모든 JsonViewer/JsonTree와 설정 창이 함께 갱신된다. 기존 우클릭 메뉴는
  편의를 위해 남겨 뒀다. 무지개색은 가이드선이 꺼지면 효과가 없어 그때만 노출한다.
- 툴바의 테마·언어 퀵토글 버튼도 그대로 뒀다(자주 쓰는 것은 빠른 접근이 낫다). `useTheme`에
  특정 테마로 지정하는 `setTheme`를 더해 세그먼트 컨트롤에서 쓴다.

### IndexedDB 레코드 값 편집 + 80건 초과 페이지네이션

읽기·삭제만 되던 IndexedDB에 값 수정과 "더 불러오기"를 붙였다. 둘 다 삭제와 같은
"페이지 컨텍스트 eval 스크립트 → 폴링 → 정리" op 패턴을 따른다(`storageInspector`).

- **값 수정(`setIndexedDbRecord`)**: 표시된 직렬화 키와 일치하는 레코드를 커서로 찾아
  `cursor.update`한다. 편집 텍스트는 JSON 파싱을 시도하고, 안 되면 문자열 그대로 저장한다
  (문자열 값 스토어 대응). `StorageDetail.editTarget`에 indexeddb 변형을 더해 `StorageDetailPanel`의
  기존 Edit 흐름을 재사용하고, `StorageView`의 저장 라우팅에서 `setIndexedDbRecord`로 보낸다.
  Blob 등 구조화 클론 전용 값은 JSON 왕복이 안 되니(`__apiFlowBlob` 마커로 판별) 편집 대상에서 뺐다.
- **페이지네이션(`fetchMoreIndexedDbRecords`)**: 커서를 로드된 개수만큼 `advance`해 다음 구간을
  읽는다. 추가분은 `StorageView`가 **스냅샷(단일 소스)** 에 append하므로 `filterIndexedDB`·선택
  인덱스와 어긋나지 않는다(`filterIndexedDB`가 `...store`로 count·truncated를 보존). 오프셋은
  필터와 무관하게 원본 스냅샷 기준으로 잡는다. IndexedDbPane은 `truncated`일 때 "Showing N of M +
  Load more"를 보여준다.

> 원 제안은 `put`/`add`(신규 레코드 추가)까지였으나 이번엔 **기존 값 수정**만 했다. 새 레코드 추가는
> 키/키패스·autoIncrement 입력 UI가 필요해 분리했다(후속). 실제 쓰기/추가 로드는
> `chrome.devtools.inspectedWindow.eval`이 있는 실제 확장에서만 동작한다 — dev 프리뷰(mock 스냅샷,
> `canInspectPageStorage()`=false)에선 편집·페이지네이션 **UI 렌더**까지만 확인했고, 스크립트는
> 검증된 삭제 스크립트 패턴을 그대로 따랐다.

### DataTable 행 가상화 — 콘솔·네트워크

행이 쌓이면 버벅이는 진짜 원인은 메모리가 아니라 **모든 행을 DOM에 그리는 것**이었다
(`DataTable`의 `rows.map`). `@tanstack/react-virtual`로 보이는 행만 그린다. 검증에서 콘솔
2100개→DOM 23행, 네트워크 1600개→DOM 18행으로 줄었고, 검색은 전체 데이터를 대상으로 돌아
off-screen 매치로도 점프·하이라이트된다.

- **prop 게이트.** `DataTable`에 `virtualized`(기본 off)를 두고 **콘솔·네트워크(Timeline)만**
  켰다. 스토리지(localStorage/세션/쿠키, IndexedDB는 80건 페이지네이션)는 데이터가 유계라
  회귀 위험만 큰데 이득이 적어 **가상화하지 않았다** — 기존 비가상 렌더 경로를 그대로 탄다.
- **off-screen 스크롤.** 가상화에선 화면 밖 행이 DOM에 없어 `data-row-id` 조회가 실패한다.
  `DataTable`에 `scrollToId`(+`scrollToAlign`) prop을 두어 virtualizer가 해당 행을 마운트한 뒤,
  각 뷰의 기존 하이라이트/미세 스크롤이 이어받는다. 이 효과는 "행 목록이 바뀔 때"가 아니라
  "scrollToId가 바뀔 때"만 돌게 해(인덱스 맵은 ref로 읽음), 새 요청이 스트리밍돼도 선택 행으로
  튀지 않는다. 콘솔은 활성 검색 히트(`align:center`), 네트워크는 선택 행(`align:auto`)에 물렸다.
- **가변 높이.** wrap 모드·JSON 서브행·타임라인 막대 때문에 행 높이가 제각각이라
  `measureElement`로 실측한다. sticky 헤더에 가리지 않도록 행의 `scroll-margin-top`(=헤더 높이)은
  가상 분기에서도 유지한다.
- **네트워크 썸네일.** 이미지 행 지연 로드가 `IntersectionObserver`로 "화면 근처 행"을 관찰했는데,
  가상화에선 그 행이 스크롤에 따라 붙었다 떨어진다. 관찰 등록을 `registerRowRef`(행 마운트 시점)로
  옮겨, 마운트된 이미지 행만 관찰하고 언마운트 시 해제한다.

> 원 제안은 스토리지 검색 이동도 함께 연동하자 했으나, 위 이유로 스토리지는 비가상 그대로 뒀다.
> 스토리지를 나중에 가상화한다면 `StorageView`의 `data-row-id` 조회 스크롤을 `scrollToId`로
> 바꾸면 된다(콘솔과 동일 패턴).

### 콘솔 엔트리 상한 — 무한 누적 방지

콘솔 엔트리가 무한히 쌓여(`setConsoleEntries`에 상한 없음) `setInterval` 로깅 페이지를 오래 열면
메모리·필터·렌더 비용이 계속 늘었다. 최근 `CONSOLE_MAX = 10000`개만 남기고 앞에서 버린다.
in-page 버퍼(`consoleInspector.ts`)에도 10000 상한을 둬 drain 전 폭주도 방어한다.

> 원 제안의 "N개 숨김" 안내는 넣지 않았다. 네트워크가 이미 `slice(-999)`로 **조용히** 자르고 있어
> 그 동작과 맞췄다 — devtools에선 오래된 로그가 잘리는 게 예상된 동작이라 배너 없이 둔다.
> 정말 필요하면 App에 드롭 카운트를 두고 콘솔 상단 배너로 노출하면 된다.

### 한국어/영어 다국어(i18n) — 라이브러리 없이

UI가 한국어로 하드코딩돼 있어 언어 전환이 없었다. 한/영 2개만 우선 지원하면 되고, 한국어는
복수형 규칙이 없고 영어도 단순하며, SSR·라우팅 i18n이 필요 없는 클라이언트 SPA다. 그래서
`i18next`류(~40KB, ICU·lazy-load 등 여기선 노는 기능)를 들이지 않고, `themePrefs` 패턴에 맞춘
경량 자체 구현으로 갔다. 진짜 비용은 런타임이 아니라 흩어진 문자열을 키로 뽑는 이전 작업이고,
그 비용은 어느 쪽을 골라도 같다.

- **구조.** `src/i18n/ko.ts`(원본) + `en.ts` + `index.tsx`(Provider·`useT`·`useLocale`·보간).
  키는 `namespace.key` 평면 문자열, 값 안 `{var}`는 `t(key, { var })`로 치환한다. `ko`의 키 집합이
  `MessageKey`가 되고 `en`은 `Record<MessageKey, string>`이라 **키를 하나라도 빠뜨리면 빌드가
  깨진다** — i18next의 JSON 방식보다 강한 안전장치다(키 자동완성도 공짜).
- **언어 결정·저장.** `localePrefs.ts`가 `themePrefs`와 같은 방식으로 localStorage에 저장하고,
  저장값이 없으면 `navigator.language`(ko*면 한국어, 아니면 영어)를 따른다. `LocaleProvider`는
  `main.tsx` 루트에 물렸고, 툴바에 테마 토글 옆 언어 토글(현재 언어 코드 표시, 클릭 시 전환)을 뒀다.
- **훅을 못 쓰는 유틸의 처리.** `requestResend.validateReplayDraft`는 이제 번역된 문장 대신
  `MessageKey`를 반환하고, `ResendOutcome`은 `errorKey`(번역 대상)와 `error`(브라우저가 준 원문
  런타임 오류)를 나눠 담는다. 번역은 UI 경계(App·RequestDetailPanel·ReplayEditorModal)에서 `t()`로
  한다 — 유틸에 `t`를 주입하지 않으려는 선택이다.
- **범위.** 한국어 UI 문자열 전부 + 그에 붙어 있던 영어 문구(툴바 칩·테마 토글)를 키로 옮겼다.
  원래부터 영어였던 짧은 라벨과 고유명사는 두었다(→ [후속 정리 대상](#후속-정리-대상)).
  이전 대상은 약 40개 파일 스캔 후 22개 파일 95개 문자열로 좁혔고, 정적 라벨 파일은 네임스페이스를
  나눠 병렬로 배선했다. 주석(한국어 유지 규칙)은 건드리지 않았다.

### 스토리지 세부 패널의 값 뷰어 — 덜어냈다가 되돌림

한때 세부 패널이 목록 인라인 펼침과 같은 값을 또 보여줘 답답하다고 보고, `isExpandableStorageValue`로
JSON 값이면 세부 패널의 읽기 전용 `JsonViewer`를 생략하고 "값은 목록에서 행을 펼쳐(▶) 보세요"
안내만 띄웠다(350b8fc).

**되돌렸다.** 실제로 써 보니 행을 눌러 세부 탭을 연 사용자는 거기서 값을 볼 것이라 기대하는데
안내 문구만 나와 기능이 고장 난 것처럼 읽혔다. 값을 보려면 세부 패널을 연 뒤 다시 목록 행의 ▶를
눌러야 해 동선도 늘어났다. 중복을 줄이려다 세부 패널의 본래 역할(선택한 항목의 전체 내용 보기)을
깎은 셈이다. 지금은 값 종류와 무관하게 항상 `JsonViewer`를 그린다 — 인라인 펼침은 목록에서
훑어보는 용도로, 세부 패널은 선택 항목을 자세히 보는 용도로 공존한다. Details(메타) 섹션은 다시
기본 접힘(`defaultOpen={false}`)이고, `storageDetail.expandRowHint`·`editHint` i18n 키는 지웠다.

### IndexedDB 이미지 그리드 타일 크기 조절

이미지 blob을 Grid로 볼 때 타일 크기가 104px 고정이라, 썸네일이 작아 뭔지 알아보기 어렵거나
반대로 패널을 넓혀도 열이 늘기만 하고 이미지는 그대로였다. 갤러리 툴바(레이아웃 토글 옆)에 크기
슬라이더를 뒀다(72~320px, 8px 단위. `storageImagePrefs`에 저장).

**열 개수 대신 타일 크기를 조절 대상으로 삼았다.** 그리드가 `auto-fill`이라 타일 최소 폭만 주면
열 개수는 패널 폭에 맞춰 저절로 정해진다 — 열 개수를 직접 고정하면 패널을 좁혔을 때 타일이
찌그러진다. 이미지 높이는 타일 폭의 0.85배로 따라가 카드가 세로로 늘어지지 않는다.

슬라이더는 Grid일 때만 보인다(Large는 카드를 한 장씩 크게 보는 모드라 무의미). 전역 설정이 아니라
그 뷰에서만 의미 있는 컨트롤이라 SettingsModal이 아니라 쓰는 자리에 뒀다(CLAUDE.md 규칙).

### 표시 옵션 확장 — 배열 개수, 가이드 색 모드, 목록 얼룩말 줄무늬

배열이 길면 끝까지 스크롤해 세어 보기 전엔 요소가 몇 개인지 알 수 없었고, 들여쓰기 가이드선은
무지개색 아니면 단색뿐이라 "레벨은 구분하되 조용한" 중간이 없었다. 목록은 행이 빽빽해 가로로
훑을 때 줄이 밀렸다. 세 옵션을 더했다.

**JSON 뷰어(`JsonViewPrefs`)**

- **배열 개수 표시(`arrayLength`, 기본 on).** `renderJsonValue`의 배열 분기에서 여는 `[` 옆에
  `ArrayLengthBadge`를 붙인다. 값이 아니라 파생 정보라 `select-none`으로 드래그 복사에서 빼고,
  검색 하이라이트도 걸지 않았다 — JSON 본문에 없는 숫자가 검색에 잡히면 뷰어 내부 검색의 히트
  카운트가 실제와 어긋난다. 빈 배열은 `[]`로 끝나 배지가 붙지 않는다.
- **가이드 색 모드(`guideColor`).** 불리언 `rainbow`를 `'plain' | 'rainbow' | 'zebra'`로 바꿨다.
  얼룩말은 무채색 두 톤(`--json-guide-zebra-0/1`)을 깊이에 따라 번갈아 써, 무지개보다 눈에 덜
  띄면서도 인접 레벨을 구분해 준다. 이미 저장된 `rainbow` 불리언은 `normalize()`에서
  `true→rainbow`, `false→plain`으로 이어받는다(레거시 키 마이그레이션).

둘 다 설정 창(⚙ → JSON 표시)과 뷰어 우클릭 메뉴 양쪽에 있다 — 같은 `useJsonViewPrefs` store를
보므로 어느 쪽에서 만져도 마운트된 모든 뷰어가 함께 다시 그려진다. 색 모드는 셋 중 하나라 설정
창에선 `SegmentedControl`, 우클릭 메뉴에선 `role="menuitemradio"` 항목으로 낸다. 라벨·순서가
갈리지 않도록 목록은 `GUIDE_COLOR_OPTIONS` 한곳에 둔다. `JsonViewer`와 인라인 `JsonTree`가 같은
`renderJsonValue`를 쓰므로 양쪽에 함께 걸린다.

**목록(`TableViewPrefs`, 신설)**

- **행 얼룩말 줄무늬(`rowStripe`, 기본 on).** `DataTable`이 홀수 행에 아주 옅은 배경
  (`--row-stripe`)을 깔아 Network·Console·Storage 목록을 가로로 따라가기 쉽게 한다. 설정 창의
  `목록 표시` 그룹에 토글이 있다(`useTableViewPrefs` — jsonViewPrefs와 같은 반응형 store 패턴).

줄무늬는 행 컨테이너가 아니라 **셀 그리드(`data-row-cells`)에만** 칠한다. 컨테이너에 칠하면 펼친
서브행(네트워크 타임라인 막대·인라인 JSON 트리)까지 물든다. 선택된 행은 강조 배경(`bg-accent-soft`)을
가리지 않도록 줄무늬를 건너뛰고, hover 시에는 `group-hover/row:bg-transparent`로 줄무늬를 비워
컨테이너의 hover 색이 그대로 드러나게 한다 — 안 그러면 안쪽 줄무늬가 hover/선택 배경을 덮는다.
짝/홀은 `row.index`로 판정하므로 가상화(보이는 행만 렌더)에서도 줄무늬가 어긋나지 않는다.

### 네트워크 뷰 정리와 새로고침 시 자동 지우기, JsonViewer 표시 옵션

- **Flow/Timeline 토글을 숨기고 Timeline을 고정**했다. `NetworkPanel`이 뷰 모드와 무관하게 항상
  `TimelineView`를 그린다(persisted가 `flow`여도 타임라인). `networkViewMode` 상태 자체는 남겨 뒀다.
- **툴바의 Export/Import 버튼을 숨겼다.** Clear·Summary·Collapse IDs는 유지. `onExportSession` 등
  컨텍스트 배선은 남아 있다(현재 미사용, 무해).
- **새로고침 시 기록 자동 삭제 옵션**을 추가했다. 검사 중인 페이지가 이동/새로고침되면
  (`chrome.devtools.network.onNavigated`) 켜져 있을 때 캡처 기록을 지운다. 기본 꺼짐, localStorage
  영속. 툴바 우클릭으로 여는 `NetworkOptionsMenu`(MenuSurface + MenuCheckItem)로 조절한다 —
  버튼을 늘리는 대신 우클릭에 담았다. onNavigated는 실제 DevTools에서만 발생하므로 dev 모드로는
  이 동작만 재현 불가.
- **JsonViewer 표시 옵션 2종**: 들여쓰기 가이드선 on/off, 무지개색(depth별 색) on/off. 뷰어 본문
  우클릭으로 여는 설정 팝오버(MenuCheckItem 체크박스, 토글해도 안 닫힘)로 조절한다. 무지개색은
  가이드가 꺼지면 비활성. 기본은 둘 다 켜짐(기존 모습 유지). prefs는 모듈 스토어 +
  `useSyncExternalStore`로 반응형이라, 한 뷰어에서 바꾸면 인라인 `JsonTree`를 포함한 모든 인스턴스가
  함께 갱신된다. 설정 팝오버는 `JsonViewSettingsMenu`로 뽑아, 콘솔·스토리지 행을 펼쳤을 때 나오는
  인라인 `JsonTree`에서도 우클릭으로 열 수 있다. 인라인 트리는 행 안이라 우클릭이 행 복사 메뉴로
  버블링되는데, `stopPropagation`으로 막고 JSON 설정 메뉴를 대신 띄운다.

### 경로의 ID를 접어 보이던 것을 기본은 실제 값으로

`/private/development/48213/90577/…` 같은 경로가 `:id`로 접혀 실제 값을 볼 수 없었다.
경로 정규화(`normalizePath`: 숫자·UUID·날짜·긴 해시 → `:id`·`:date`·`:hash`)는 같은 엔드포인트
묶음 판정(diff 후보, `NetworkPanel`의 `normalizedPath` 비교)에 필요하지만, 화면 표시까지
정규화 값을 쓸 이유는 없었다.

- 표시 기본값을 **실제 경로**로 바꿨다. 네트워크 툴바에 `Collapse IDs` 토글(기본 꺼짐,
  localStorage 영속)을 두어 원하면 `:id` 형태로 접어 볼 수 있다.
- 표시용 헬퍼 `displayPath(parts, collapseIds)`를 `normalizeUrl.ts`에 두고, 타임라인 행·플로우
  노드·상세 패널 제목·응답 diff 제목·요약 Top N이 모두 이 헬퍼를 쓴다. 묶음·정렬·검색 등
  로직은 종전대로 `normalizedPath`를 그대로 쓴다 — 표시 방식만 바뀐다.
- 목업이 `:id`를 문자 그대로 넣고 있어(정규화를 흉내만 냄) 토글 효과가 안 보였다. 실제 숫자 ID를
  넣고 `normalizePath`를 적용하도록 고쳤고, 겸사겸사 목업 `path`가 쿼리를 포함하던 실데이터와의
  불일치도 바로잡았다.

### 모달에서 input을 드래그하다 밖에서 손을 떼면 닫히던 문제

`ReplayEditorModal`·`ResponseDiffModal`의 배경은 `onClick={onClose}`였다. input 안에서
텍스트를 드래그하다(mousedown 내부) 모달 밖에서 손을 떼면(mouseup 배경), `click`은 두 지점의
공통 조상(=배경)에서 발생한다. 그래서 배경 `onClick`이 곧장 실행되어 실수로 닫혔다. 내부 요소의
`stopPropagation`은 click이 애초에 배경에서 나므로 소용이 없었다.

공용 훅 `useBackdropDismiss`로 고쳤다 — `onMouseDown`으로 "누르기가 배경 자신에서 시작했는지"를
기억하고, 그 경우에만 배경 클릭으로 닫는다. 두 모달이 같은 훅을 쓴다.

### 자동 스크롤된 행이 sticky 헤더에 가려지던 문제

`DataTable`의 헤더는 `sticky top-0`이라 스크롤된 목록의 위쪽을 덮는다. 그런데 `TimelineView`가
선택된 행을 `scrollIntoView({ block: 'nearest' })`로 끌어올 때 행을 스크롤 컨테이너 상단에 맞추는데,
그 지점이 곧 헤더 아래다. 목록을 아래로 스크롤한 상태에서 위쪽 행이 선택될 때만 나타나 "가끔 살짝
가리는" 증상으로 보였지만, 재보면 정확히 헤더 높이(28px)만큼 가려진다.

같은 뿌리의 두 번째 버그: `searchScroll.ts`의 `isVisibleInContainer`는 행이 컨테이너 top보다 4px만
아래면 "보인다"고 판정했다. 헤더에 17.7px 가려진 행도 보임으로 처리되어 콘솔·스토리지의 검색 이동이
아무 일도 하지 않았다.

- `DataTable`이 `ResizeObserver`로 헤더 실제 높이를 재서 각 행의 `scroll-margin-top`으로 준다.
  `scrollIntoView`가 이 값을 존중하므로 네트워크·콘솔·스토리지 세 테이블이 함께 고쳐진다.
  하드코딩한 픽셀이 아니라 실측이라 폰트·줌이 바뀌어도 따라간다.
- `searchScroll`은 대상의 `scroll-margin-top`을 그대로 읽어 가려짐 판정에 더한다.
  두 곳이 같은 하나의 값을 근거로 삼는다.

### 요약 배너가 요청 목록을 0px로 밀어내던 문제

`NetworkSummary`가 `max-h-[280px] shrink-0`이라, 네트워크 패널이 280px보다 낮으면 요약이 가용
높이를 다 먹고도 줄어들지 않아 요청 테이블 높이가 0이 됐다(패널이 짧으면 목록이 통째로 사라짐).
상한을 `min(280px, 45%)`로 바꿔 패널 높이의 45%를 넘지 못하게 했다. 내부는 이미 `overflow-y-auto`라
넘치는 내용은 스크롤된다.

### 후속 정리 (5건 중 4건)

- `copyToClipboard` 인라인 중복 2개를 지우고 `utils/clipboard.ts`의 `copyText()`로 모았다.
  `JsonViewer`에는 같은 이름의 지역 변수가 있어 별칭으로 import한다.
- `MenuActionItem`을 `ui/Menu.tsx`로 올리고, `MenuCheckItem`과 공유하는 항목 클래스도 `itemBase`로 묶었다.
- 요청 종류별 색상 맵을 `formatters.ts`의 `REQUEST_KIND_TEXT_COLOR` 하나로 합쳤다.
  `Record<RequestKind, string>`으로 전수 정의해 `TimelineView`의 `?? 'text-ink-weak'` 폴백도 지웠다.
- HAR `ssl`은 스펙상 `connect`에 포함되므로(HAR 1.1 호환용 중첩, `time` 총합에도 따로 더해지지 않는다)
  `normalizeTimings`가 `connect -= ssl`로 겹침을 걷어낸 뒤 순차 세그먼트를 만든다. 목업도 스펙에 맞게
  `connect`가 `ssl`을 포함하도록 고쳤다 — 화면에 찍히는 값은 그대로다.

행 메뉴의 Resend는 즉시 재전송으로 구현했다. `App`이 `onResendRequest`를 소유하고 결과를 세션 알림에
띄운다. `ReplayEditorModal`은 draft를 편집하는 상세 패널 쪽에 그대로 남겼다 — 위 [후속 정리 대상](#후속-정리-대상) 참고.

### 행 우클릭 컨텍스트 메뉴 — DX

`DataTable`에 `onRowContextMenu`를 추가하고, 공용 팝오버 `shared/RowContextMenu.tsx`
(바깥 클릭·Escape·항목 선택 시 닫힘, 뷰포트 밖으로 나가면 위치 클램프)를 만들었다.
클립보드 헬퍼는 `utils/clipboard.ts`의 `copyText()`로 분리했다.

- 네트워크 행: Copy URL / Copy as cURL / Copy as fetch / Copy response / Open in new tab / Resend.
  응답 본문은 행을 선택해야 지연 로드되므로, 아직 없으면 Copy response는 비활성.
  Resend는 `canResendRequest`가 false인 요청(websocket, 비-http URL)에서 비활성.
- 콘솔 행: Copy message / Copy arguments as JSON / Copy source / Copy stack.
- 스토리지 행: Copy key·value·JSON(+쿠키는 name·domain), 기존 삭제 핸들러를 재사용한 Delete.

우클릭은 행을 **선택하지 않는다.** `onRowClick`이 토글이라(선택된 행 재클릭 시 해제) 우클릭에
재사용하면 선택이 풀린다. 메뉴는 우클릭된 행을 콜백 인자로 직접 받는다.

### 네트워크 타이밍 워터폴 — Network

HAR `timings`(blocked/dns/connect/ssl/send/wait/receive)를 `utils/requestTimings.ts`의
`normalizeTimings()`로 정규화해 `ApiRequest`/`TimelineItem`에 실었다. `-1`·음수·0 단계는 버리고,
세그먼트 합이 `duration`을 넘지 않도록 클램프한다. 쓸 수 있는 단계가 없으면 `undefined`로 남겨
기존 동작으로 되돌아간다.

- 상세 패널 Timing 섹션: 누적 막대 + `단계 — Xms (Y%)` 행.
- 타임라인 막대: 단계별 색 세그먼트 + 단계를 나열한 tooltip.
- 단계 데이터가 없는 요청은 종전대로 단일 막대.

### 콘솔 커맨드라인(REPL) — Console

콘솔 하단에 입력창을 붙이고 `consoleInspector.ts`의 `evalConsoleExpression()`으로 실행한다.
이 함수는 페이지 쪽 예외에 reject하지 않고 `{ value, threw }`를 돌려준다 — 던진 표현식은
크래시가 아니라 정상적인 REPL 결과다.

- 입력·결과는 새 레벨 `input`/`result`로 같은 엔트리 스트림에 끼어들어 캡처된 로그와 시간순으로 섞인다.
- 두 레벨은 **필터 대상이 아니다.** 사용자가 직접 친 것이라 레벨 필터로 숨기면 안 되고,
  기존 사용자의 영속된 레벨 배열에 없는 값이라 마이그레이션도 필요 없다.
- 히스토리(↑/↓), Enter 제출. 객체·배열 결과는 기존 `JsonViewer` 경로로 렌더된다.
- DevTools 밖(`npm run dev`)에서는 설명 문구와 함께 비활성화된다.

### 네트워크 요약·통계 패널 — Network

`utils/networkStats.ts`에 순수 집계 함수 `summarizeNetwork()`를 두고,
`network/NetworkSummary.tsx`가 그린다. `NetworkPanel` 툴바의 Summary 토글로 열고 닫으며
열림 상태는 localStorage에 영속한다. 열려 있을 때만 `useMemo`로 집계한다.

총 요청 수 / 총 전송량 / 평균·최대 duration / 느린 요청 수 / 에러 수·에러율,
타입별·상태그룹별 분포 막대, 느린 요청 Top 5와 큰 요청 Top 5(클릭하면 해당 요청 선택).
느림·에러 판정은 `TimelineItem`의 `isSlow`/`isError`를 그대로 쓴다.

### 툴바 개수 칩이 필터를 반영하지 않던 문제

콘솔 모드에서 `requestCount`와 `totalRequestCount`에 둘 다 `displayedConsoleEntries.length`가
넘어가, 레벨 필터와 Include/Exclude가 개수에 반영되지 않았다.

레벨 필터 상태 `enabledConsoleLevels`를 `App.tsx`로 끌어올려 해결했다. App은 이미
`enabledMethods`/`enabledStatusGroups`/`enabledResourceKinds`와 Include/Exclude 텍스트를
모두 `usePersistedState`로 소유하고 있었고, 콘솔 레벨만 `ConsoleView`의 지역 상태로 남아 있었다.
`groupRepeatedEntries`는 `utils/consoleGrouping.ts`로 옮겨 App과 뷰가 같은 병합 규칙을 공유한다 —
칩의 "shown"은 테이블이 실제로 그리는 **묶인 행 수**와 항상 일치한다.
콘솔 툴바 칩도 네트워크와 같은 `N shown / M captured` 형태가 됐다.

### 콘솔 미리보기 요약 때문에 검색 하이라이트가 어긋나던 문제

검색 히트 수는 원본 텍스트에서 세는데(`consoleSearch.ts`) 셀에는 `formatJsonTextPreview`가
120자로 줄인 문자열이 그려져, 잘려 나간 히트만큼 `.search-highlight` 마크가 모자랐고 활성 마크가
엉뚱한 곳에 붙었다.

스토리지가 이미 쓰던 방식(`StorageValueCell.tsx`)대로, 검색 중에는 요약하지 않고 원본을 그리도록
`ConsoleView`의 Message 셀을 고쳤다.
