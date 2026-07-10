# 추가 기능 제안

현재 코드베이스를 훑어 "아직 없는 것"만 골라 정리했다. 각 항목의 **근거**는 해당 기능이
지금 구현돼 있지 **않다는** 것을 보여주는 파일·줄이다. 이미 있는 기능(HAR 파싱 타입, 요청 재전송,
응답 diff, 플로우 차트, 코드 스니펫 복사, 워크스페이스 도킹 등)은 제외했다.

우선순위는 대략 위에서 아래 순이다. 노력(S/M/L)과 효과(낮음/보통/높음)를 함께 적었다.

---

## 1. 테스트·린트·CI 인프라 — DX / M / 높음

**문제.** 자동화된 검증 장치가 전혀 없다. `package.json`의 scripts는 `dev`/`build`/`preview`
셋뿐이고(`package.json:5-9`), 저장소 루트에 ESLint·Prettier·Vitest 설정이 없으며 `.github`
디렉터리도 없다. 반면 순수 로직 유틸은 매우 많다 — `requestParser.ts`, `jsonDiff.ts`,
`jsonTextTokens.ts`, `searchHighlight.tsx`, `textFilters.ts`, `sessionIO.ts`. 이들이 회귀해도
잡아낼 그물이 없다.

**제안.** Vitest로 유틸 계층부터 단위 테스트를 붙인다(파서 → 검색 → 토크나이저 → 세션 IO 순).
ESLint(`react-hooks` 규칙 포함 — 이미 `RequestDetailPanel.tsx:79`에 `eslint-disable` 주석이 있다)와
Prettier를 설정하고, GitHub Actions로 PR마다 `tsc + lint + test + build`를 돌린다.

> 참고: `tsc`에 `noUnusedLocals`가 꺼져 있어 죽은 import가 빌드를 통과한다.
> 현재도 `storageSearch.ts:62`에 미사용 변수가 하나 남아 있다.

---

## 2. DataTable 행 가상화 — Perf / L / 높음

**문제.** `DataTable`은 모든 행을 그대로 그린다(`DataTable.tsx:172`의 `rows.map(...)`).
가상화 라이브러리가 코드베이스에 없다. 네트워크는 최대 1000개로 잘리지만(`App.tsx:336` `slice(-999)`)
콘솔은 상한이 없어(`App.tsx:308`) 수천 행이면 스크롤·검색 이동·리렌더가 급격히 느려진다.
콘솔 wrap 모드와 JSON 펼침 서브행 때문에 행 높이가 가변이라 부담이 더 크다.

**제안.** 이미 TanStack Table을 쓰므로 `@tanstack/react-virtual`이 잘 맞는다. 검색 이동이
`data-row-id`로 DOM을 찾는 현재 흐름(`ConsoleView.tsx:344`, `StorageView.tsx:277`)을
`scrollToIndex`와 연동하고, `renderSubRow`(타임라인 막대·JSON 트리)의 가변 높이를 measure한다.

---

## 3. 콘솔 엔트리 버퍼 상한 — Perf / S / 높음

**문제.** 콘솔 엔트리가 무한히 쌓인다. 네트워크는 `App.tsx:336`에서 상한을 두지만 콘솔은
`App.tsx:308`의 `setConsoleEntries((current) => [...current, ...drained])`에 잘라내는 코드가 없고,
`consoleInspector.ts`의 in-page 버퍼에도 상한 상수가 없다. `setInterval` 로깅을 하는 페이지를
오래 열어두면 메모리가 계속 늘고, 가상화가 없는 지금은 UI가 멈춘다.

**제안.** 링 버퍼 상한(예: 최근 5000개)을 두고 초과분을 앞에서 버린다. 상한에 닿으면
"오래된 로그 N개 숨김" 안내를 띄운다.

---

## 4. 표준 HAR 가져오기 / 내보내기 — Export / M / 높음

**문제.** 세션 저장이 자체 포맷이다 — `sessionIO.ts:8`의 `SESSION_VERSION = 1`,
`{version, exportedAt, requests, flowLayout}` 구조. 표준 `.har` 읽기/쓰기가 없다
(`src`에 `.har` 참조 없음. `types/chrome-har.ts`의 `Har*` 타입은 DevTools 요청 파싱 전용이다).
크롬 DevTools·Charles·Postman과 세션을 주고받을 수 없다.

**제안.** HAR 1.2 export(`ApiRequest` → `log.entries`)와 import를 추가한다. `chrome-har.ts`의
`HarRequest`/`HarResponse`/`HarCookie`/`HarPostData` 타입을 매핑에 재사용할 수 있다.
Network 툴바의 Export/Import(`NetworkPanel.tsx:98-103`)에 포맷 선택을 붙인다.

---

## 5. 행 우클릭 컨텍스트 메뉴 — DX / M / 높음

**문제.** 데이터 행에 우클릭 메뉴가 없다. `DataTable`은 헤더 컨텍스트 메뉴만 지원하고
(`DataTable.tsx:48`, `:120`의 `onHeaderContextMenu`), 데이터 행은 Enter/Space만 처리한다
(`DataTable.tsx:189-194`). Copy as cURL·응답 복사는 상세 패널까지 들어가야만 가능하다
(`RequestDetailPanel.tsx:299`, `:433`).

**제안.** `DataTable`에 `onRowContextMenu`를 추가한다. 네트워크 행에는 Copy URL / Copy as cURL /
Copy as fetch / Copy response / Open in new tab / Resend를, 스토리지·콘솔 행에는 Copy key·value·
message를 붙인다. `requestCodeSnippets.ts`와 기존 클립보드 헬퍼를 재사용한다.

---

## 6. 네트워크 타이밍 워터폴 — Network / L / 보통

**문제.** 요청 타이밍이 총 소요시간 하나뿐이다. `ApiRequest`에는 `startedAt`/`endedAt`/`duration`만
있고(`types/network.ts:34-38`), `requestParser.ts:44`는 `request.time` 총합만 읽는다.
DNS/Connect/SSL/TTFB/Download 분해가 없어 느린 요청이 연결 대기 탓인지 서버 처리 탓인지 알 수 없다.
`TimelineView`도 단계 없는 단일 막대만 그린다(`types/network.ts:72-87`).

**제안.** HAR `timings`(blocked/dns/connect/ssl/send/wait/receive)를 파싱해 `ApiRequest`에 단계
필드를 추가하고, 상세 패널 Timing 섹션(`RequestDetailPanel.tsx:277-291`)과 타임라인 막대를 단계별
세그먼트로 그린다. 단계 데이터가 없으면 지금처럼 총합만 보여준다.

---

## 7. 정규식 검색 옵션 — Search / M / 보통

**문제.** 검색 옵션이 대소문자 구분(Aa)과 전체 단어(ab) 둘뿐이다
(`SearchOptionToggles.tsx:22-42`, `searchPrefs.ts:37-51`은 `matchCase`/`wholeWord`만 저장하고
`searchHighlight.tsx:39`도 `matchCase`만 쓴다). `/users/\d+` 같은 패턴 검색을 할 수 없다.

**제안.** 토글에 `.*`(regex)를 추가하고 `searchPrefs`에 영속한다. `searchHighlight.tsx`의 매칭이
리터럴/정규식을 모두 처리하도록 확장하고, 잘못된 정규식은 입력창 옆에 조용히 표시한다.
세 뷰(Network/Console/Storage)가 공용 `SearchOptions`를 쓰므로 한 번에 적용된다.

---

## 8. 콘솔 커맨드라인(REPL) — Console / M / 보통

**문제.** 콘솔 뷰가 캡처 전용이다. 툴바에는 레벨 필터·Auto-scroll·Wrap·Clear만 있고
표현식을 입력할 창이 없다. `consoleInspector.ts`는 버퍼를 drain·clear만 한다.
디버깅 중 변수 확인이나 즉석 호출을 할 수 없다.

**제안.** 콘솔 하단에 입력창을 붙이고 `evalInInspectedPage`(`consoleInspector.ts:52`)로 실행한다.
입력과 결과를 전용 레벨의 엔트리로 스트림에 끼워 넣고, 히스토리(↑/↓)와 결과의 `JsonViewer` 렌더를
지원한다.

---

## 9. 테이블 방향키 탐색 — A11y / S / 보통

**문제.** 행을 키보드 위/아래로 옮길 수 없다. `DataTable` 행은 `tabIndex=0`에 Enter/Space만
처리한다(`DataTable.tsx:189-194`). 검색 이동은 있지만 일반 목록 탐색은 마우스나 Tab 연타에 의존한다.

**제안.** roving tabindex와 ArrowUp/Down·Home/End 핸들러를 `DataTable`에 넣어 포커스와 선택을 함께
옮긴다. 가상화를 넣으면 `scrollToIndex`와 연동한다.

---

## 10. 모달·메뉴 포커스 트랩과 포커스 복귀 — A11y / M / 보통

**문제.** `ReplayEditorModal`은 Escape만 처리하고 자동 포커스·Tab 순환·닫을 때 트리거로 포커스 복귀가
없다(`ReplayEditorModal.tsx:54-60`). `FilterMenu`는 바깥 클릭/Escape로 닫히지만 메뉴 항목으로 포커스가
들어가거나 방향키로 항목을 오가는 처리가 없다. `Menu.tsx`의 항목에는 role은 있으나 roving tabindex가
없다(`Menu.tsx:23-42`).

**제안.** 공용 focus-trap 훅을 만들어 모달에 적용하고(열릴 때 첫 요소 포커스, Tab 순환, 닫힐 때 복귀),
`FilterMenu`/`ColumnMenu`는 열리면 첫 항목에 포커스하고 ArrowUp/Down·Home/End로 순회하게 한다.

---

## 11. 콘솔 캡처 범위 확장(group/count/assert/trace/time) — Console / M / 보통

**문제.** `installConsoleCapture`가 `['log','info','warn','error','debug','table','dir']`만 래핑한다
(`consoleInspector.ts:209`). `console.group`/`groupEnd`/`count`/`assert`/`trace`/`time`/`timeEnd`는
잡지 않는다. 게다가 `table`/`dir`은 캡처만 하고 일반 텍스트로 표시된다.

**제안.** 래핑 목록을 넓히고 엔트리에 그룹 depth를 실어 보낸다. 뷰에서는 그룹 들여쓰기·접기,
`console.table`의 표 렌더, `assert` 실패의 error 스타일을 지원한다.

---

## 12. 콘솔·스토리지 내보내기 — Export / S / 보통

**문제.** 내보내기가 네트워크에만 있다. Export 버튼은 `NetworkPanel.tsx:98`에만 있고,
콘솔 툴바에는 Clear만, 스토리지 헤더에는 Refresh만 있다(`StorageView.tsx:420-426`).

**제안.** 콘솔 로그를 JSON/텍스트로, 스토리지 스냅샷(local/session/cookies/indexedDB)을 JSON으로
내보내는 버튼을 각 패널에 붙인다. `sessionIO.ts`의 `downloadJson`을 재사용한다.

---

## 13. Cache Storage / Service Worker 탭 — Storage / L / 보통

**문제.** 스토리지 탭이 localStorage/sessionStorage/Cookies/IndexedDB 넷뿐이다
(`StorageView.tsx:436-441`). 크롬 Application 패널의 Cache Storage·Service Worker 조회가 없어
PWA·오프라인 캐시 디버깅을 못 한다.

**제안.** `caches.keys()` → 각 캐시의 `keys()`/`match()`를 `inspectedWindow.eval`로 읽어 Cache Storage
탭을 추가한다(`storageInspector.ts`의 캡처 패턴 재사용). Service Worker 등록 상태는
`navigator.serviceWorker.getRegistrations()`로 읽어 보조 정보로 보여준다.

---

## 14. IndexedDB 레코드 추가·수정과 80건 초과 페이지네이션 — Storage / M / 보통

**문제.** IndexedDB가 읽기 + 삭제만 지원하고 80건에서 잘린다. `MAX_INDEXED_DB_RECORDS = 80`
(`storageInspector.ts:8`)이고 `truncated` 플래그로 안내만 뜰 뿐(`IndexedDbPane.tsx`) 더 불러오기가 없다.
편집 함수는 `deleteIndexedDbRecord`뿐이라(`storageInspector.ts:127`) localStorage(`setWebStorageItem`)나
쿠키(`setCookie`)와 달리 값을 고칠 수 없다.

**제안.** 커서 오프셋 기반 "더 불러오기"로 상한을 넘기고, IDB 레코드 `put`/`add`를
`storageInspector`에 구현한다. `StorageDetailPanel`의 저장 흐름을 IDB에도 연결한다.

---

## 15. 네트워크 요약·통계 패널 — Network / M / 보통

**문제.** 집계 지표가 없다. 툴바는 "N shown / M captured" 개수 칩만 보여준다(`Toolbar.tsx:47-56`).
총 전송량(`ApiRequest.size`는 이미 있다, `types/network.ts:49`), 타입별 분포, 상태코드별 개수,
에러율, 가장 느린/큰 요청 같은 요약이 없다.

**제안.** 요약 카드를 추가한다 — 총 요청/총 크기/평균·최대 duration/타입별·상태그룹별 카운트/에러율/
Top N 느린·큰 요청. `displayedRequests`와 `timelineItems`의 `isSlow`/`isError`
(`types/network.ts:85-86`)를 그대로 집계하면 된다.

---

## 16. 응답 본문 타입별 렌더(HTML/XML) — Network / M / 낮음

**문제.** JSON이 아닌 응답은 평문으로만 보인다. `parseResponseContent`는 JSON만 파싱하고 나머지는
원문을 반환한다(`requestParser.ts:76-88`). 상세 패널은 응답을 `JsonViewer`로 보내므로
(`RequestDetailPanel.tsx:264-267`, `mimeType`을 넘기긴 한다) HTML/XML/CSS는 구문 강조도 미리보기도
없다(base64 이미지만 `ImagePreview`로 처리).

**제안.** `mimeType`으로 렌더러를 분기한다 — HTML은 sandbox iframe 미리보기 + 원문 토글,
XML/SVG는 트리, `text/*`는 라이트 구문 강조. `JsonViewer`는 JSON 전용으로 남긴다.

---

## 알려진 작은 불일치 (버그라기보다 정리 대상)

- **툴바 개수 칩이 필터를 반영하지 않는다.** 콘솔 모드에서 `requestCount`와 `totalRequestCount`가
  둘 다 `displayedConsoleEntries.length`로 넘어간다(`App.tsx:845-846`). `displayedConsoleEntries`는
  `clear`만 걸러내므로(`App.tsx:238-241`) 레벨 필터와 Include/Exclude가 개수에 반영되지 않는다.
  ConsoleView가 필터를 로컬 상태로 들고 있어 App이 알 수 없는 구조 탓이다.

- **콘솔은 미리보기를 요약할 때 검색 하이라이트 개수가 어긋난다.** 검색 히트 수는 원본 텍스트에서
  세지만(`consoleSearch.ts`) 셀에는 `formatJsonTextPreview`가 줄인 문자열이 그려진다. 120자를 넘는
  JSON에서 히트가 요약에 잘려 나가면 렌더된 `.search-highlight` 마크 수가 계산치보다 적어져 활성
  마크가 어긋난다. 스토리지 쪽은 검색 중에 요약을 끄는 방식으로 이미 맞춰 뒀다
  (`StorageValueCell.tsx`). 콘솔에도 같은 처리를 하면 된다.
