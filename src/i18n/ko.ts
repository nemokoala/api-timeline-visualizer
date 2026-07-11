/**
 * 한국어 메시지 — 번역의 원본(source of truth).
 *
 * 이 객체의 키 집합이 `MessageKey`가 되고, en.ts는 이 키를 모두 채워야
 * 타입 체크를 통과한다(누락 키 = 빌드 에러). 키는 `namespace.name` 평면 문자열이다.
 * 값 안의 `{var}`는 t(key, { var })로 치환된다.
 */
export const ko = {
  // 공통
  'common.copy': '복사',
  'common.resendUnsupported': '이 요청 유형은 재전송할 수 없습니다.',

  // 툴바
  'toolbar.captureSummary': '캡처 요약',
  'toolbar.shown': '{count}개 표시',
  'toolbar.captured': '{count}개 캡처',
  'toolbar.storageViewer': '스토리지 뷰어',
  'toolbar.workspacePanels': '워크스페이스 패널',
  'toolbar.moveToPanel': '{label} 패널로 이동',
  'toolbar.openPanel': '{label} 패널 열기',
  'toolbar.resetLayout': '레이아웃 초기화',
  'toolbar.resetLayoutTitle': '레이아웃 초기화 (기본 배치로)',
  'toolbar.themeToLight': '라이트 모드로 전환',
  'toolbar.themeToDark': '다크 모드로 전환',
  'toolbar.switchToKorean': '한국어로 전환',
  'toolbar.switchToEnglish': 'English로 전환',

  // 재전송 알림(App)
  'resend.sending': '{method} {path} 재전송 중…',
  'resend.sent': '{method} {path} 재전송함.',
  'resend.failed': '재전송 실패: {error}',

  // 요청 재전송 편집(ReplayEditorModal) + 검증(requestResend)
  'replay.error.methodRequired': '메서드를 입력해 주세요.',
  'replay.error.urlScheme': 'URL은 http:// 또는 https:// 로 시작해야 합니다.',
  'replay.error.urlInvalid': '올바른 URL이 아닙니다.',
  'replay.title': '요청을 고쳐서 다시 보내기',
  'replay.method': 'HTTP 메서드',
  'replay.url': '요청 URL',
  'replay.headerName': '헤더 이름',
  'replay.headerValue': '헤더 값',
  'replay.emptyHeaderName': '빈',
  'replay.deleteHeader': '헤더 삭제',
  'replay.deleteHeaderAria': '{name} 헤더 삭제',
  'replay.noHeaders': '헤더 없음',
  'replay.body': '요청 본문',
  'replay.bodyPlaceholder': '본문 없음',
  'replay.jsonParseFail': 'JSON 파싱 실패: {error}',
  'replay.noBodyForMethod': '{method} 요청은 본문을 보내지 않습니다.',
  'replay.resetTitle': '원래 캡처된 요청으로 되돌립니다',
  'replay.sendTitle': '검사 대상 페이지에서 이 요청을 보냅니다',

  // 요청 상세(RequestDetailPanel)
  'requestDetail.openNewTab': '새 탭에서 열기',
  'requestDetail.compareWith': '같은 엔드포인트의 다른 응답 {count}개와 비교',
  'requestDetail.noCompare': '같은 엔드포인트로 캡처된 다른 응답이 없습니다.',
  'requestDetail.modifiedFromOriginal': '원 요청에서 수정된 내용이 있습니다',
  'requestDetail.editResendTitle': 'URL·메서드·헤더·본문을 고쳐서 보냅니다.',
  'requestDetail.resendTitle':
    '검사 대상 페이지에서 이 요청을 다시 보냅니다. 재전송된 요청은 목록에 새 항목으로 잡힙니다.',

  // 네트워크 메뉴/요약/패널
  'methodMenu.aria': 'HTTP 메서드 표시',
  'statusMenu.aria': '상태코드 그룹 표시',
  'resourceTypeMenu.aria': '리소스 타입 표시',
  'resourceTypeMenu.groupRequests': '요청',
  'resourceTypeMenu.groupStatic': '정적 리소스',
  'networkOptions.aria': '네트워크 옵션',
  'networkOptions.clearOnReload': '새로고침 시 기록 지우기',
  'networkSummary.noRequests': '표시할 요청이 없습니다.',
  'networkSummary.noSizeInfo': '크기 정보 없음',
  'networkPanel.collapsePathIdsTitle': '경로의 ID·날짜·해시를 :id 등으로 접어서 표시합니다.',
  'networkPanel.toggleSummaryTitle': '요약 통계 보기/숨기기',

  // 플로우 차트 노드
  'flowNode.bringToFront': '맨 앞으로',
  'flowNode.sendToBack': '맨 뒤로',
  'flowNode.notePlaceholder': '메모 입력...',
  'flowNode.changeTextColor': '글자 색 변경',
  'flowNode.textColorAria': '글자 색 {color}',
  'flowNode.smallerText': '글자 작게',
  'flowNode.largerText': '글자 크게',
  'flowNode.hideBackground': '배경 없애기',
  'flowNode.showBackground': '배경 표시',
  'flowNode.changeColor': '색상 변경',
  'flowNode.colorAria': '색상 {color}',
  'flowNode.outlineOnly': '테두리만 표시',
  'flowNode.fillColor': '색 채우기',

  // 플로우 차트 뷰
  'flowView.showQueryInTitle': '카드 타이틀에 쿼리 문자열 표시',
  'flowView.addTextNote': '텍스트 메모 추가',
  'flowView.addRectangle': '사각형 도형 추가',
  'flowView.resetEdits': '편집 초기화',

  // JSON 뷰어
  'jsonViewer.prevMatch': '이전 검색 결과',
  'jsonViewer.prevMatchTitle': '이전 (Shift+Enter)',
  'jsonViewer.nextMatch': '다음 검색 결과',
  'jsonViewer.nextMatchTitle': '다음 (Enter)',
  'jsonViewer.openFullscreen': '화면을 가득 채우는 창으로 열기',
  'jsonViewer.copyValue': '값 복사',
  'jsonViewer.copyString': '문자열 복사',
  'jsonViewer.resizeAria': '뷰어 높이 조절 (더블클릭 시 기본값)',
  'jsonViewer.resizeTitle': '드래그로 높이 조절 · 더블클릭으로 기본값',
  'jsonViewer.displaySettings': 'JSON 표시 설정',
  'jsonViewer.indentGuide': '들여쓰기 가이드',
  'jsonViewer.rainbow': '무지개색',

  // JSON 행 미리보기
  'jsonRowPreview.collapse': 'JSON 접기',
  'jsonRowPreview.expand': 'JSON 펼치기',

  // 공유 메뉴
  'rowMenu.aria': '행 작업',
  'columnMenu.aria': '열 표시 설정',
  'filterMenu.selectAll': '모두 선택',
  'filterMenu.clearAll': '모두 해제',

  // 패널 헤더
  'panelHeader.popOutAria': '패널을 창으로 분리',
  'panelHeader.popOutTitle': '창으로 분리 (플로팅)',
  'panelHeader.collapseFilters': '필터 접기',
  'panelHeader.expandFilters': '필터 펼치기',
  'panelHeader.expandFiltersActive': '필터 펼치기 (필터 적용 중)',

  // 워크스페이스 독(빈 상태)
  'workspaceDock.noPanels': '표시할 패널이 없습니다.',
  'workspaceDock.reopenTopHint': '상단에서 Network · Storage · Console을 선택해 다시 여세요.',
  'workspaceDock.noJsonData': 'JSON 데이터가 없습니다.',
  'workspaceDock.reopenHint': '패널을 닫고 다시 Pop out 해 주세요.',

  // 콘솔 레벨 메뉴
  'consoleLevelMenu.aria': '콘솔 로그 레벨 표시',
  'consoleLevelMenu.groupOther': '기타',

  // 스토리지 상세
  'storageDetail.expandRowHint': '값은 목록에서 행을 펼쳐(▶) 보세요.',
  'storageDetail.editHint': '편집은 상단 Edit 버튼.',

  // 응답 비교 모달
  'responseDiff.loading': '응답 본문을 불러오는 중…',
  'responseDiff.noRequest': '비교할 요청이 없습니다.',
  'responseDiff.identical': '두 응답이 동일합니다.',
  'responseDiff.compareTarget': '− 비교 대상',
  'responseDiff.selectRequest': '비교할 요청 선택',
  'responseDiff.currentRequest': '+ 현재 요청',
  'responseDiff.changeSummary': '변경 요약',
};

export type MessageKey = keyof typeof ko;
