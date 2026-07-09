# Tailwind 마이그레이션 TODO

global.css(≈3,150줄)의 클래스 기반 스타일을 Tailwind v4 유틸리티 + 공용 컴포넌트로 이관하는 작업 목록.
진행 방식: 항목마다 ① TSX를 Tailwind 유틸리티(또는 공용 컴포넌트)로 전환 → ② global.css에서 해당 블록 삭제 → ③ 빌드·프리뷰로 확인 → ④ 체크.

규칙(기존 방침 유지):

- 새로 짜는 부분은 Tailwind 유틸리티만 사용, global.css 클래스와 섞지 않는다.
- 색·그림자는 tailwind.css의 토큰(`bg-surface`, `text-ink-*`, `border-line`, `shadow-card` …)만 쓴다. 하드코딩 hex 금지.
- 서드파티(dockview `dv-*`, react-flow `react-flow__*`) 오버라이드와 스크롤바 등 유틸리티로 못 옮기는 전역 스타일은 삭제하지 말고 마지막 단계에서 별도 레이어 CSS로 정리한다.

## 완료된 것 (참고)

- [x] Tailwind v4 도입 + 테마 토큰 브리지 (`src/styles/tailwind.css`)
- [x] SegmentedControl (`ui/SegmentedControl.tsx`)
- [x] ToggleControl · PillTabs (`ui/ToggleControl.tsx`, `ui/PillTabs.tsx`)
- [x] ResponseDiffModal 본문 (일부 `.input` 등 잔존 → 3번 항목에서 정리)

## 1단계 — 공용 프리미티브

- [x] **1. Button/IconButton** — `ui/Button.tsx` 내부를 Tailwind로 전환, global.css `.btn*` 블록 삭제. 부수 처리: `tailwind-merge` 도입(`utils/cn.ts`), FilterMenu 카운트 배지 인라인화, PanelHeader has-filter 색상, SearchOptionToggles/FlowChartNodes 크기 오버라이드 유틸리티화, RowDeleteButton hover 노출을 `group/row` 패턴으로 전환
- [x] **2. Input 공용 컴포넌트 신설** — `ui/Input.tsx`(Input/Select/TextArea, md/sm) 신설, raw 사용처 교체(ResponseDiffModal, JsonViewer, CookieForm, StorageDetailPanel, WebStoragePane), `.input*` 블록 삭제
- [x] **3. FilterMenu / ColumnMenu 팝오버** — `ui/Menu.tsx`(MenuSurface/MenuCheckItem/MenuSeparator/MenuGroupLabel) 신설, `.column-menu*`·`.resource-type-*`·`.kind-dot*` 삭제, purple/teal/pink 토큰 추가. StatusMenu/MethodMenu 라벨의 `.flow-status`/`.method` 뱃지는 9·18번에서 처리
- [x] **4. 소품들** — SearchHitBadge 이관(+highlight 토큰 추가), `ui/EmptyState.tsx` 공용화. DetailPanelCloseButton은 이미 global 클래스 없음. SplitPanelResizer(`.detail-resizer*`)는 workspace 레이아웃과 얽혀 있어 19번으로 이동

## 2단계 — 레이아웃/헤더

- [x] **5. PanelHeader** — `.panel-header`, `.panel-search*`, `.panel-filters`, `.panel-filter-*`, `.search-position/-nav-*` 이관(FilterField 서브컴포넌트 추출)
- [x] **6. Toolbar** — `.toolbar*` 이관(ToolbarChip 추출, 반응형은 max-[980px]/max-[720px] variant), NetworkPanel의 `.toolbar-notice`/`.toolbar-button-group` 포함
- [x] **7. WorkspaceDock 셸** — `.workspace-dock`, `.dock-panel-shell`, `.dock-pane`, `.json-dock-panel`, `.dock-watermark*`, `.network-actions*` 이관. dockview `dv-*` 테마 변수 오버라이드는 `.dv-dockview` 셀렉터로 유지(20번에서 레이어 정리)

## 3단계 — 데이터 표시부

- [x] **8. DataTable** — `.data-table*` 이관(cn 머지, rowAlign 프롭 신설). 레벨 색조/search-match는 호출부 rowClassName 유틸리티로, storage 셀 정렬은 cellClassName 유틸리티로 이동
- [x] **9. TimelineView 행 표현** — `.method*`(공용 MethodBadge 신설: md/sm/node), `.kind-*`, `.bar*`, `.status`, `.duration/.offset/.size/.path`, `.row-thumb`(bg-checker 유틸리티 신설), `.request-*`, `.slow-text` 이관. warn-bg/warn-strong 토큰 추가
- [x] **10. RequestDetailPanel + DetailSection** — `.detail-panel/-title*/-status/-section*`, `.definition-list`(공용 DefinitionList/DetailTitleBar 신설, DetailSection density 프롭), `.code-snippet*`, 로딩 오버레이 이관. 잔여: `.search-highlight`(JS classList 토글 의존)와 `.response-json-slot` 계열(JsonViewer 내부 결합)은 17·20번에서
- [x] **11. ConsoleView** — `.console-*` 이관(레벨 색 LEVEL_TEXT_COLOR 맵, wrap-lines는 셀 조건부 유틸리티). 잔여: `.console-arg-block .json-viewer-wrap`(17번), `.console-log-list`는 JS 검색 셀렉터용 마커로 유지

## 4단계 — Storage

- [x] **12. StorageView 골격** — `.storage-panel/-header/-workspace/-message/-table-wrap` 이관(컨테이너 쿼리는 `@container`+`@max-[560px]:`, 뷰포트 쿼리는 `max-[820px]:` variant, StorageMessage 추출). `.storage-panel`은 JS 검색 셀렉터용 마커로 유지
- [x] **13. WebStoragePane + RowDeleteButton** — `.storage-add*` 이관(삭제 버튼·셀 정렬은 1·8번에서 선처리)
- [x] **14. CookieForm / CookiePane** — `.cookie-form*`, `.cookie-field*`, `.cookie-check` 이관
- [x] **15. IndexedDbPane + StorageDetailPanel** — `.indexeddb-*`, `.storage-detail-*`, `.storage-edit*` 이관. 잔여: `.storage-detail-value .json-viewer-*`(17번에서)

## 5단계 — 대형 뷰

- [x] **16. ImagePreview / Gallery** — `.image-preview-*` 이관(isGrid 분기 인라인화, bg-checker-lg 유틸리티 신설, ImagePreview에 className 프롭)
- [x] **17. JsonViewer(코스메틱)** — 툴바/로컬검색/리사이즈 핸들/전체화면 백드롭/필드 메뉴/트리 구문색·가이드선(GUIDE_BORDER 맵) 이관, json-string/number 토큰 추가. **의도적 잔여(20번으로)**: 크기 조절 코어(`.json-viewer-wrap/-body/.json-viewer` + `is-fullscreen/is-resized` + `.response-json-slot/.storage-detail-value/.console-arg-block` 컨텍스트 결합 — 서로 캐스케이드로 얽혀 있어 props 리팩터링과 함께 옮겨야 함), `.json-local-hit`/`.search-highlight`(JS classList 토글)
- [x] **18. FlowChart 일가** — `.flow-toolbar*`, `.flow-shape(+toolbar/swatch)`, `.flow-text-note-input`, `.flow-export-*`, `.flow-node` 내부(top/summary/bottom/query/image-title), `.flow-status`(공용 StatusBadge 신설: badge/node) 이관. **의도적 잔여(20번으로)**: `.flow-panel .react-flow__*` 오버라이드, `.flow-node` 카드 + `.flow-text-note` + `.flow-shape-resize-*`(react-flow의 `.selected`/NodeResizer 클래스와 결합 — 유틸리티 important가 이기면 다중선택 강조가 깨져 CSS로 유지)

## 6단계 — 마무리

- [x] **19. App 셸 잔재** — `.app-shell`, `.workspace*`, `.flow-panel/.timeline-panel` 레이아웃, SplitPanelResizer(`.detail-resizer*`) 이관(조상 상태는 `[.split-layout-stacked_&]:`/`[.resizing-split-panel-*_&]:` variant). body의 `.resizing-split-panel-*` 상태 규칙은 CSS(components 레이어)로 유지
- [x] **20. 전역 정리** — 레이어 재구성 완료: `theme < vendor < base < components < utilities`. dockview/react-flow CSS를 `layer(vendor)`로 import(JS import 제거), global.css는 base(토큰·리셋·스크롤바)+components(잔여 코어)로 재편, utilities의 `important` 제거. 죽은 CSS/클래스 스캔·정리(cookie-form-grid 누락 복구 포함)

## 마이그레이션 후 남은 것 (의도적)

global.css(≈540줄)는 전부 레이어 안에 있으며 다음만 남는다:

- **base**: 테마 토큰(`:root`/`[data-theme=dark]`), 박스사이징/바디/버튼 리셋, 스크롤바.
- **components**:
  - 검색 하이라이트(`.search-highlight`/`.json-local-hit` + `is-active`) — JS가 classList로 토글.
  - JsonViewer 크기 조절 코어(`.json-viewer-wrap/-body/.json-viewer` + `is-fullscreen/is-resized` + `.response-json-slot/.storage-detail-value/.console-arg-block` 컨텍스트) — 옮기려면 JsonViewer에 variant prop 리팩터링 필요.
  - flow 카드 코어(`.flow-node`/`.flow-text-note`) — react-flow가 붙이는 `.selected`(다중 선택)와 결합.
  - react-flow/dockview 오버라이드, NodeResizer `!important` 오버라이드, 좁은 화면 분할 강제 규칙.

새 컴포넌트는 Tailwind 유틸리티 + `utils/cn.ts`(tailwind-merge)만 사용할 것.
