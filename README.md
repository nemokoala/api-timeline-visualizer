# DevLens

Network / Console / Storage를 한 패널에서 보는 Chrome DevTools 확장 프로그램 (Manifest V3).
API 요청을 플로우 그래프 / 타임라인으로 시각화하고, 콘솔 로그와 스토리지를 함께 점검합니다.

## 기술 스택

- React 19 + TypeScript
- Vite (빌드)
- Tailwind CSS v4 (점진 도입 중 — 새 컴포넌트는 유틸리티, 기존 화면은 `src/styles/global.css`)
- [@xyflow/react](https://reactflow.dev/) — Flow 차트 렌더링
- Chrome DevTools Extension API (`chrome.devtools.*`)

## 개발

```bash
npm install
npm run dev      # Vite 개발 서버
npm run build    # tsc + vite build → dist/
npm run preview  # 빌드 결과 미리보기
```

빌드 후 `dist/`를 Chrome 확장 프로그램(개발자 모드 → 압축해제된 확장 프로그램 로드)으로 로드하면 DevTools에 패널이 추가됩니다.

## 뷰어 구성

| 뷰어 | 데이터 모델 | 설명 |
| --- | --- | --- |
| **Network** | 시간순 스트림 | API 요청을 Flow 그래프 / Timeline 두 형태로 표시 |
| **Console** | 시간순 스트림 | 콘솔 로그·객체·스택을 캡처해 표시 |
| **Storage** | key-value 스냅샷 | localStorage / sessionStorage / IndexedDB 조회 |

## 검색 & 필터 설계

검색(Search)과 필터(Include/Exclude)는 **역할이 다르며, 의도적으로 분리**되어 있습니다.

### Include / Exclude 필터 (세 뷰어 공통)

- **역할: 노이즈 제거** — 지속적으로 보고 싶지 않은 항목을 행 단위로 숨김
- 쉼표/공백 구분, 대소문자 무시 (`src/utils/textFilters.ts`)
- 뷰어별로 독립 저장 (`src/utils/filterPrefs.ts`, localStorage)
- 예: 네트워크에서 `analytics, sentry` 제외, 콘솔에서 `debug, vite` 제외
- 네트워크 전용 구조화 필터: 리소스 타입 / HTTP 메서드 / 상태코드 그룹(2xx~5xx/Error)을 공용 드롭다운(`FilterMenu`, 모두 선택/해제 지원)으로 토글 (`src/utils/requestFilterPrefs.ts`)

### 검색 (Search)

검색 동작은 **데이터 모델에 따라 다릅니다.** 이게 의도된 설계입니다.

| 구분 | 뷰어 | 검색 동작 |
| --- | --- | --- |
| **시간순 스트림** | Network, Console | 비매칭 행을 **숨기지 않고**, 매칭만 하이라이트 + 해당 위치로 포커스/스크롤 이동 (`n/m` 네비게이션) |
| **스냅샷** | Storage | 비매칭 행을 **숨겨서** 결과를 좁힘 (필터식) |

**왜 다르게 동작하나?**

- **시간순 뷰(Network·Console)** 는 매칭 항목의 *앞뒤 맥락*(직전/직후 로그·요청)이 디버깅에 중요합니다. 행을 숨기면 이 문맥이 사라지므로, 전체 흐름을 유지한 채 매칭만 강조하고 이동합니다. (크롬 DevTools, VS Code, 브라우저 Ctrl+F의 표준 방식)
- **Storage** 는 시계열이 아니라 key-value 스냅샷이라 행 순서에 의미가 없고, 보존할 "맥락"이 없습니다. 키가 많을 수 있어 검색으로 좁히는 편이 더 유용합니다. IndexedDB 트리도 매칭만 남겨 가지치기하는 게 보기 좋습니다. (크롬 Application 패널 storage와 동일)

### 요약

```
Include/Exclude  → 노이즈 제거(지속 필터)        : 세 뷰어 공통
Search (시간순)  → 맥락 유지 + 하이라이트/이동    : Network, Console
Search (스냅샷)  → 결과 좁히기(필터)             : Storage
```

## 디렉터리 구조

```
src/
  App.tsx           # 최상위 상태·레이아웃, 뷰어 분기
  components/       # 뷰어 및 UI 컴포넌트 (ConsoleView, StorageView, FlowChartView, TimelineView, Toolbar …)
  contexts/         # SearchOptions 등 전역 컨텍스트
  hooks/            # useSplitPanelLayout, useTheme …
  utils/            # 검색·필터·파서 로직 (textFilters, filterPrefs, *Search …)
  types/            # 타입 정의
  styles/           # 스타일
```
