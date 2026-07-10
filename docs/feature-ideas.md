# 추가 기능 제안

현재 코드베이스를 훑어 "아직 없는 것"만 골라 정리했다. 각 항목의 **근거**는 해당 기능이
지금 구현돼 있지 **않다는** 것을 보여주는 파일·줄이다. 이미 있는 기능(HAR 파싱 타입, 요청 재전송,
응답 diff, 플로우 차트, 코드 스니펫 복사, 워크스페이스 도킹 등)은 제외했다.

우선순위는 대략 위에서 아래 순이다. 노력(S/M/L)과 효과(낮음/보통/높음)를 함께 적었다.

구현이 끝난 항목은 아래 [완료됨](#완료됨)으로 옮긴다.

---

## 1. 테스트·린트·CI 인프라 — DX / M / 높음

**문제.** 자동화된 검증 장치가 전혀 없다. `package.json`의 scripts는 `dev`/`build`/`preview`
셋뿐이고(`package.json:5-9`), 저장소 루트에 ESLint·Prettier·Vitest 설정이 없으며 `.github`
디렉터리도 없다. 반면 순수 로직 유틸은 매우 많다 — `requestParser.ts`, `jsonDiff.ts`,
`jsonTextTokens.ts`, `searchHighlight.tsx`, `textFilters.ts`, `sessionIO.ts`,
`networkStats.ts`, `requestTimings.ts`. 이들이 회귀해도 잡아낼 그물이 없다.

**제안.** Vitest로 유틸 계층부터 단위 테스트를 붙인다(파서 → 검색 → 토크나이저 → 세션 IO 순).
ESLint(`react-hooks` 규칙 포함 — 이미 `RequestDetailPanel.tsx:80`에 `eslint-disable` 주석이 있다)와
Prettier를 설정하고, GitHub Actions로 PR마다 `tsc + lint + test + build`를 돌린다.

> 참고: `tsc`에 `noUnusedLocals`가 꺼져 있어 죽은 import가 빌드를 통과한다.
> 현재도 `storageSearch.ts:62`에 미사용 변수가 하나 남아 있다.

---

## 2. DataTable 행 가상화 — Perf / L / 높음

**문제.** `DataTable`은 모든 행을 그대로 그린다(`DataTable.tsx`의 `rows.map(...)`).
가상화 라이브러리가 코드베이스에 없다. 네트워크는 최대 1000개로 잘리지만(`App.tsx` `slice(-999)`)
콘솔은 상한이 없어 수천 행이면 스크롤·검색 이동·리렌더가 급격히 느려진다.
콘솔 wrap 모드와 JSON 펼침 서브행 때문에 행 높이가 가변이라 부담이 더 크다.

**제안.** 이미 TanStack Table을 쓰므로 `@tanstack/react-virtual`이 잘 맞는다. 검색 이동이
`data-row-id`로 DOM을 찾는 현재 흐름(`ConsoleView.tsx`, `StorageView.tsx`)을
`scrollToIndex`와 연동하고, `renderSubRow`(타임라인 막대·JSON 트리)의 가변 높이를 measure한다.

> 주의: 지금 행이 sticky 헤더 뒤로 숨지 않는 건 `DataTable`이 행에 실어 주는
> `scroll-margin-top` 덕이고, `scrollIntoView`가 그 값을 알아서 존중한다.
> `scrollToIndex`는 이를 존중하지 않으므로 헤더 높이를 직접 빼 줘야 한다.

---

## 3. 콘솔 엔트리 버퍼 상한 — Perf / S / 높음

**문제.** 콘솔 엔트리가 무한히 쌓인다. 네트워크는 `App.tsx`에서 상한을 두지만 콘솔은
`setConsoleEntries((current) => [...current, ...drained])`에 잘라내는 코드가 없고,
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
`HarRequest`/`HarResponse`/`HarCookie`/`HarPostData`/`HarTimings` 타입을 매핑에 재사용할 수 있다.
Network 툴바의 Export/Import(`NetworkPanel.tsx`)에 포맷 선택을 붙인다.

---

## 5. 정규식 검색 옵션 — Search / M / 보통

**문제.** 검색 옵션이 대소문자 구분(Aa)과 전체 단어(ab) 둘뿐이다
(`SearchOptionToggles.tsx:22-42`, `searchPrefs.ts:37-51`은 `matchCase`/`wholeWord`만 저장하고
`searchHighlight.tsx:39`도 `matchCase`만 쓴다). `/users/\d+` 같은 패턴 검색을 할 수 없다.

**제안.** 토글에 `.*`(regex)를 추가하고 `searchPrefs`에 영속한다. `searchHighlight.tsx`의 매칭이
리터럴/정규식을 모두 처리하도록 확장하고, 잘못된 정규식은 입력창 옆에 조용히 표시한다.
세 뷰(Network/Console/Storage)가 공용 `SearchOptions`를 쓰므로 한 번에 적용된다.

---

## 6. 테이블 방향키 탐색 — A11y / S / 보통

**문제.** 행을 키보드 위/아래로 옮길 수 없다. `DataTable` 행은 `tabIndex=0`에 Enter/Space만
처리한다. 검색 이동은 있지만 일반 목록 탐색은 마우스나 Tab 연타에 의존한다.

**제안.** roving tabindex와 ArrowUp/Down·Home/End 핸들러를 `DataTable`에 넣어 포커스와 선택을 함께
옮긴다. 가상화를 넣으면 `scrollToIndex`와 연동한다.

---

## 7. 모달·메뉴 포커스 트랩과 포커스 복귀 — A11y / M / 보통

**문제.** `ReplayEditorModal`은 Escape만 처리하고 자동 포커스·Tab 순환·닫을 때 트리거로 포커스 복귀가
없다(`ReplayEditorModal.tsx:54-60`). `FilterMenu`는 바깥 클릭/Escape로 닫히지만 메뉴 항목으로 포커스가
들어가거나 방향키로 항목을 오가는 처리가 없다. `Menu.tsx`의 항목에는 role은 있으나 roving tabindex가
없다(`Menu.tsx:23-42`). 새로 붙인 `RowContextMenu`도 같은 한계를 물려받는다.

**제안.** 공용 focus-trap 훅을 만들어 모달에 적용하고(열릴 때 첫 요소 포커스, Tab 순환, 닫힐 때 복귀),
`FilterMenu`/`ColumnMenu`/`RowContextMenu`는 열리면 첫 항목에 포커스하고 ArrowUp/Down·Home/End로
순회하게 한다.

---

## 8. 콘솔 캡처 범위 확장(group/count/assert/trace/time) — Console / M / 보통

**문제.** `installConsoleCapture`가 `['log','info','warn','error','debug','table','dir']`만 래핑한다
(`consoleInspector.ts`). `console.group`/`groupEnd`/`count`/`assert`/`trace`/`time`/`timeEnd`는
잡지 않는다. 게다가 `table`/`dir`은 캡처만 하고 일반 텍스트로 표시된다.

**제안.** 래핑 목록을 넓히고 엔트리에 그룹 depth를 실어 보낸다. 뷰에서는 그룹 들여쓰기·접기,
`console.table`의 표 렌더, `assert` 실패의 error 스타일을 지원한다.

---

## 9. 콘솔·스토리지 내보내기 — Export / S / 보통

**문제.** 내보내기가 네트워크에만 있다. Export 버튼은 `NetworkPanel.tsx`에만 있고,
콘솔 툴바에는 Clear만, 스토리지 헤더에는 Refresh만 있다(`StorageView.tsx`).

**제안.** 콘솔 로그를 JSON/텍스트로, 스토리지 스냅샷(local/session/cookies/indexedDB)을 JSON으로
내보내는 버튼을 각 패널에 붙인다. `sessionIO.ts`의 `downloadJson`을 재사용한다.

---

## 10. Cache Storage / Service Worker 탭 — Storage / L / 보통

**문제.** 스토리지 탭이 localStorage/sessionStorage/Cookies/IndexedDB 넷뿐이다
(`StorageView.tsx`). 크롬 Application 패널의 Cache Storage·Service Worker 조회가 없어
PWA·오프라인 캐시 디버깅을 못 한다.

**제안.** `caches.keys()` → 각 캐시의 `keys()`/`match()`를 `inspectedWindow.eval`로 읽어 Cache Storage
탭을 추가한다(`storageInspector.ts`의 캡처 패턴 재사용). Service Worker 등록 상태는
`navigator.serviceWorker.getRegistrations()`로 읽어 보조 정보로 보여준다.

---

## 11. IndexedDB 레코드 추가·수정과 80건 초과 페이지네이션 — Storage / M / 보통

**문제.** IndexedDB가 읽기 + 삭제만 지원하고 80건에서 잘린다. `MAX_INDEXED_DB_RECORDS = 80`
(`storageInspector.ts:8`)이고 `truncated` 플래그로 안내만 뜰 뿐(`IndexedDbPane.tsx`) 더 불러오기가 없다.
편집 함수는 `deleteIndexedDbRecord`뿐이라(`storageInspector.ts:127`) localStorage(`setWebStorageItem`)나
쿠키(`setCookie`)와 달리 값을 고칠 수 없다.

**제안.** 커서 오프셋 기반 "더 불러오기"로 상한을 넘기고, IDB 레코드 `put`/`add`를
`storageInspector`에 구현한다. `StorageDetailPanel`의 저장 흐름을 IDB에도 연결한다.

---

## 12. 응답 본문 타입별 렌더(HTML/XML) — Network / M / 낮음

**문제.** JSON이 아닌 응답은 평문으로만 보인다. `parseResponseContent`는 JSON만 파싱하고 나머지는
원문을 반환한다(`requestParser.ts`). 상세 패널은 응답을 `JsonViewer`로 보내므로
(`mimeType`을 넘기긴 한다) HTML/XML/CSS는 구문 강조도 미리보기도
없다(base64 이미지만 `ImagePreview`로 처리).

**제안.** `mimeType`으로 렌더러를 분기한다 — HTML은 sandbox iframe 미리보기 + 원문 토글,
XML/SVG는 트리, `text/*`는 라이트 구문 강조. `JsonViewer`는 JSON 전용으로 남긴다.

---

## 후속 정리 대상

- **행 메뉴에서 편집 후 재전송.** 행 컨텍스트 메뉴의 Resend는 즉시 전송이다(크롬 DevTools의
  "Replay XHR"과 같다). 보내기 전에 URL·헤더·본문을 고치려면 상세 패널의 Edit을 거쳐야 한다.
  행에서 바로 편집기를 열려면 `ReplayEditorModal`의 draft 상태를 `NetworkPanel`로 끌어올려야 하는데,
  draft는 지금 `CodeSnippetBlock` 안에서 cURL/fetch 스니펫과 한 몸이다("미리보기가 곧 보낼 내용").
  그 결합을 푸는 게 이 작업의 본체다.

---

## 완료됨

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
