/**
 * 영어 메시지.
 *
 * `Record<MessageKey, string>`로 타입을 걸어 ko.ts의 키를 하나라도 빠뜨리면
 * 빌드가 깨지도록 한다(오탈자/누락 방지).
 */
import type { MessageKey } from './ko';

export const en: Record<MessageKey, string> = {
  // 공통
  'common.copy': 'Copy',
  'common.resendUnsupported': 'This request type cannot be resent.',

  // 툴바
  'toolbar.captureSummary': 'Capture summary',
  'toolbar.shown': '{count} shown',
  'toolbar.captured': '{count} captured',
  'toolbar.storageViewer': 'Storage viewer',
  'toolbar.workspacePanels': 'Workspace panels',
  'toolbar.moveToPanel': 'Go to {label} panel',
  'toolbar.openPanel': 'Open {label} panel',
  'toolbar.resetLayout': 'Reset layout',
  'toolbar.resetLayoutTitle': 'Reset layout (to default)',
  'toolbar.themeToLight': 'Switch to light mode',
  'toolbar.themeToDark': 'Switch to dark mode',
  'toolbar.switchToKorean': 'Switch to Korean',
  'toolbar.switchToEnglish': 'Switch to English',

  // 재전송 알림(App)
  'resend.sending': 'Resending {method} {path}…',
  'resend.sent': 'Resent {method} {path}.',
  'resend.failed': 'Resend failed: {error}',

  // 요청 재전송 편집(ReplayEditorModal) + 검증(requestResend)
  'replay.error.methodRequired': 'Enter an HTTP method.',
  'replay.error.urlScheme': 'The URL must start with http:// or https://.',
  'replay.error.urlInvalid': 'That is not a valid URL.',
  'replay.title': 'Edit and resend request',
  'replay.method': 'HTTP method',
  'replay.url': 'Request URL',
  'replay.headerName': 'Header name',
  'replay.headerValue': 'Header value',
  'replay.emptyHeaderName': 'empty',
  'replay.deleteHeader': 'Delete header',
  'replay.deleteHeaderAria': 'Delete {name} header',
  'replay.noHeaders': 'No headers',
  'replay.body': 'Request body',
  'replay.bodyPlaceholder': 'No body',
  'replay.jsonParseFail': 'JSON parse failed: {error}',
  'replay.noBodyForMethod': '{method} requests do not send a body.',
  'replay.resetTitle': 'Revert to the originally captured request',
  'replay.sendTitle': 'Send this request from the inspected page',

  // 요청 상세(RequestDetailPanel)
  'requestDetail.openNewTab': 'Open in new tab',
  'requestDetail.compareWith': 'Compare with {count} other response(s) from the same endpoint',
  'requestDetail.noCompare': 'No other responses captured for the same endpoint.',
  'requestDetail.modifiedFromOriginal': 'Modified from the original request',
  'requestDetail.editResendTitle': 'Edit the URL, method, headers, or body and send.',
  'requestDetail.resendTitle':
    'Resend this request from the inspected page. The resent request appears as a new entry in the list.',

  // WebSocket 메시지(WebSocketMessages)
  'websocket.sent': 'Sent — browser to server',
  'websocket.received': 'Received — server to browser',
  'websocket.status': 'Connection status change',
  'websocket.all': 'All',
  'websocket.open': 'Open',
  'websocket.closed': 'Closed',
  'websocket.directionFilter': 'Message direction filter',
  'websocket.messageList': 'WebSocket message list',
  'websocket.noMessages': 'No messages exchanged yet.',
  'websocket.dropped': 'Dropped {count} older message(s) over the capture limit.',

  // 네트워크 메뉴/요약/패널
  'methodMenu.aria': 'Show HTTP methods',
  'statusMenu.aria': 'Show status code groups',
  'resourceTypeMenu.aria': 'Show resource types',
  'resourceTypeMenu.groupRequests': 'Requests',
  'resourceTypeMenu.groupStatic': 'Static resources',
  'networkOptions.aria': 'Network options',
  'networkOptions.clearOnReload': 'Clear log on page reload',
  'networkSummary.noRequests': 'No requests to show.',
  'networkSummary.noSizeInfo': 'No size info',
  'networkPanel.collapsePathIdsTitle': 'Collapse IDs, dates, and hashes in the path to :id and the like.',
  'networkPanel.toggleSummaryTitle': 'Show/hide summary stats',

  // 플로우 차트 노드
  'flowNode.bringToFront': 'Bring to front',
  'flowNode.sendToBack': 'Send to back',
  'flowNode.notePlaceholder': 'Enter a note...',
  'flowNode.changeTextColor': 'Change text color',
  'flowNode.textColorAria': 'Text color {color}',
  'flowNode.smallerText': 'Smaller text',
  'flowNode.largerText': 'Larger text',
  'flowNode.hideBackground': 'Hide background',
  'flowNode.showBackground': 'Show background',
  'flowNode.changeColor': 'Change color',
  'flowNode.colorAria': 'Color {color}',
  'flowNode.outlineOnly': 'Outline only',
  'flowNode.fillColor': 'Fill color',

  // 플로우 차트 뷰
  'flowView.showQueryInTitle': 'Show query string in card titles',
  'flowView.addTextNote': 'Add text note',
  'flowView.addRectangle': 'Add rectangle',
  'flowView.resetEdits': 'Reset edits',

  // JSON 뷰어
  'jsonViewer.prevMatch': 'Previous match',
  'jsonViewer.prevMatchTitle': 'Previous (Shift+Enter)',
  'jsonViewer.nextMatch': 'Next match',
  'jsonViewer.nextMatchTitle': 'Next (Enter)',
  'jsonViewer.openFullscreen': 'Open as a full-screen panel',
  'jsonViewer.copyValue': 'Copy value',
  'jsonViewer.copyString': 'Copy as string',
  'jsonViewer.resizeAria': 'Resize viewer height (double-click to reset)',
  'jsonViewer.resizeTitle': 'Drag to resize · double-click to reset',
  'jsonViewer.displaySettings': 'JSON display settings',
  'jsonViewer.arrayLength': '{count} items',
  'jsonViewer.arrayLengthOption': 'Array item count',
  'jsonViewer.indentGuide': 'Indent guides',
  'jsonViewer.guideColor': 'Guide color',
  'jsonViewer.guideColorPlain': 'Plain',
  'jsonViewer.guideColorRainbow': 'Rainbow',
  'jsonViewer.guideColorZebra': 'Zebra',

  // 이미지 갤러리(스토리지 blob)
  'imageGallery.gridSize': 'Grid tile size',
  'imageGallery.gridSizeTitle': 'Tile size {size}px · columns fit the panel width',

  // JSON 행 미리보기
  'jsonRowPreview.collapse': 'Collapse JSON',
  'jsonRowPreview.expand': 'Expand JSON',

  // 공유 메뉴
  'rowMenu.aria': 'Row actions',
  'columnMenu.aria': 'Column display settings',
  'filterMenu.selectAll': 'Select all',
  'filterMenu.clearAll': 'Clear all',

  // 패널 헤더
  'panelHeader.popOutAria': 'Pop panel out to a window',
  'panelHeader.popOutTitle': 'Pop out (floating)',
  'panelHeader.collapseFilters': 'Collapse filters',
  'panelHeader.expandFilters': 'Expand filters',
  'panelHeader.expandFiltersActive': 'Expand filters (filter active)',

  // 워크스페이스 독(빈 상태)
  'workspaceDock.noPanels': 'No panels to show.',
  'workspaceDock.reopenTopHint': 'Pick Network · Storage · Console above to reopen.',
  'workspaceDock.noJsonData': 'No JSON data.',
  'workspaceDock.reopenHint': 'Close the panel and Pop out again.',

  // 콘솔 레벨 메뉴
  'consoleLevelMenu.aria': 'Show console log levels',
  'consoleLevelMenu.groupOther': 'Other',

  // 응답 비교 모달
  'responseDiff.loading': 'Loading response bodies…',
  'responseDiff.noRequest': 'No request to compare.',
  'responseDiff.identical': 'The two responses are identical.',
  'responseDiff.compareTarget': '− Compare target',
  'responseDiff.selectRequest': 'Select request to compare',
  'responseDiff.currentRequest': '+ Current request',
  'responseDiff.changeSummary': 'Change summary',

  // 설정 창(전역 설정)
  'settings.open': 'Open settings',
  'settings.title': 'Settings',
  'settings.appearance': 'Appearance',
  'settings.theme': 'Theme',
  'settings.themeLight': 'Light',
  'settings.themeDark': 'Dark',
  'settings.language': 'Language',
  'settings.jsonDisplay': 'JSON display',
  'settings.listDisplay': 'List display',
  'table.rowStripe': 'Zebra row stripes',
  'settings.capture': 'Capture',
  'settings.close': 'Close',
};
