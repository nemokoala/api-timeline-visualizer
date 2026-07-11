import { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useSplitPanelLayout } from '../../hooks/useSplitPanelLayout';
import { usePersistedState } from '../../hooks/usePersistedState';
import { summarizeNetwork } from '../../utils/networkStats';
import { getNetworkSummaryOpen, saveNetworkSummaryOpen } from '../../utils/networkSummaryPrefs';
import { NetworkSummary } from '../network/NetworkSummary';
import { RequestDetailPanel } from '../network/RequestDetailPanel';
import { ResponseDiffModal } from '../network/ResponseDiffModal';
import { SplitPanelResizer } from '../shared/SplitPanelResizer';
import { TimelineView } from '../network/TimelineView';
import { NetworkOptionsMenu } from '../network/NetworkOptionsMenu';
import { ResourceTypeMenu } from '../network/ResourceTypeMenu';
import { MethodMenu } from '../network/MethodMenu';
import { StatusMenu } from '../network/StatusMenu';
import { Button } from '../ui/Button';
import { ToggleControl } from '../ui/ToggleControl';
import { PanelHeader } from './PanelHeader';
import { useT } from '../../i18n';

/** 도킹 패널로 렌더링되는 네트워크 뷰(Flow/Timeline + 요청 상세 분할). */
export function NetworkPanel() {
  const t = useT();
  const ctx = useWorkspace();
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    isStacked,
    layoutStyle,
    startWidthResize,
    startHeightResize,
    resetWidth,
    resetHeight,
    toggleSplitLayout,
  } = useSplitPanelLayout(containerRef);

  const { selectedRequest } = ctx;
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [showSummary, setShowSummary] = usePersistedState(
    getNetworkSummaryOpen,
    saveNetworkSummaryOpen,
  );
  // 툴바 우클릭으로 여는 네트워크 옵션 메뉴 위치(닫혀 있으면 null).
  const [optionsMenu, setOptionsMenu] = useState<{ x: number; y: number } | null>(null);

  // 요약은 열려 있을 때만 집계한다. 요청/타임라인이 바뀔 때만 재계산.
  const summary = useMemo(
    () => (showSummary ? summarizeNetwork(ctx.displayedRequests, ctx.timelineItems) : null),
    [showSummary, ctx.displayedRequests, ctx.timelineItems],
  );

  // 같은 엔드포인트(메서드+호스트+정규화 경로)로 캡처된 다른 응답들 = 비교 후보.
  const diffCandidates = useMemo(() => {
    if (!selectedRequest) return [];
    return ctx.displayedRequests.filter(
      (request) =>
        request.id !== selectedRequest.id &&
        request.method === selectedRequest.method &&
        request.host === selectedRequest.host &&
        request.normalizedPath === selectedRequest.normalizedPath,
    );
  }, [ctx.displayedRequests, selectedRequest]);

  // 선택이 바뀌거나 상세가 닫히면 diff 모달도 닫는다.
  useEffect(() => {
    setIsDiffOpen(false);
  }, [selectedRequest?.id]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader scope="network" />
      <div
        className="flex h-[38px] shrink-0 items-center gap-2.5 overflow-x-auto border-b border-line-weak bg-surface px-2.5"
        onContextMenu={(event) => {
          event.preventDefault();
          setOptionsMenu({ x: event.clientX, y: event.clientY });
        }}
      >
        <ResourceTypeMenu
          enabledKinds={ctx.enabledResourceKinds}
          onToggle={ctx.onToggleResourceKind}
          onSetAll={ctx.onSetAllResourceKinds}
        />
        <MethodMenu
          enabledMethods={ctx.enabledMethods}
          onToggle={ctx.onToggleMethod}
          onSetAll={ctx.onSetAllMethods}
        />
        <StatusMenu
          enabledGroups={ctx.enabledStatusGroups}
          onToggle={ctx.onToggleStatusGroup}
          onSetAll={ctx.onSetAllStatusGroups}
        />
        <span className="h-[18px] w-px shrink-0 bg-line" aria-hidden="true" />
        <ToggleControl
          size="sm"
          label="Collapse IDs"
          title={t('networkPanel.collapsePathIdsTitle')}
          checked={ctx.collapsePathIds}
          onChange={ctx.onCollapsePathIdsChange}
        />
        {ctx.sessionNotice ? (
          <p className="m-0 whitespace-nowrap text-[11px] font-medium text-accent">
            {ctx.sessionNotice}
          </p>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-1" aria-label="Session actions">
          <Button
            size="sm"
            active={showSummary}
            aria-pressed={showSummary}
            title={t('networkPanel.toggleSummaryTitle')}
            onClick={() => setShowSummary((current) => !current)}
          >
            Summary
          </Button>
          <Button size="sm" onClick={ctx.onClear} disabled={!ctx.canClear}>
            Clear
          </Button>
        </div>
      </div>
      {showSummary && summary ? (
        <NetworkSummary
          summary={summary}
          collapsePathIds={ctx.collapsePathIds}
          onSelectRequest={ctx.onSelectRequest}
        />
      ) : null}
      <div
        ref={containerRef}
        className={`grid min-h-0 flex-auto items-stretch overflow-hidden ${selectedRequest && isStacked ? 'split-layout-stacked max-[820px]:grid-cols-[minmax(0,1fr)]!' : ''}`}
        style={selectedRequest ? layoutStyle : undefined}
      >
      <TimelineView
        items={ctx.timelineItems}
        requests={ctx.displayedRequests}
        selectedRequestId={ctx.selectedRequestId}
        searchText={ctx.networkSearchText}
        searchOccurrenceByRequest={ctx.searchOccurrenceByRequest}
        activeGlobalSearchIndex={ctx.activeGlobalSearchIndex}
        collapsePathIds={ctx.collapsePathIds}
        onSelectRequest={ctx.onSelectRequest}
        onResendRequest={ctx.onResendRequest}
        onEnsureThumbnailBody={ctx.onEnsureThumbnailBody}
      />
      {selectedRequest ? (
        <>
          <SplitPanelResizer
            orientation={isStacked ? 'horizontal' : 'vertical'}
            ariaLabel="Resize request detail panel"
            onMouseDown={isStacked ? startHeightResize : startWidthResize}
            onDoubleClick={isStacked ? resetHeight : resetWidth}
          />
          <RequestDetailPanel
            request={selectedRequest}
            isBodyLoading={ctx.bodyLoadingId === selectedRequest.id}
            searchText={ctx.networkSearchText}
            searchOccurrenceIndex={ctx.activeSearchOccurrence?.occurrenceIndex ?? 0}
            searchFocusKey={`${ctx.networkSearchMatchIndex}:${ctx.activeSearchOccurrence?.requestId ?? ''}:${ctx.activeSearchOccurrence?.occurrenceIndex ?? 0}`}
            isStacked={isStacked}
            collapsePathIds={ctx.collapsePathIds}
            compareCandidateCount={diffCandidates.length}
            onCompareResponses={() => setIsDiffOpen(true)}
            onLoadResponseBody={ctx.onLoadResponseBody}
            onToggleLayout={toggleSplitLayout}
            onClose={ctx.onCloseDetail}
          />
        </>
      ) : null}
      </div>
      {isDiffOpen && selectedRequest && diffCandidates.length > 0 ? (
        <ResponseDiffModal
          key={selectedRequest.id}
          baseRequest={selectedRequest}
          candidates={diffCandidates}
          collapsePathIds={ctx.collapsePathIds}
          onEnsureBody={ctx.onEnsureThumbnailBody}
          onClose={() => setIsDiffOpen(false)}
        />
      ) : null}
      {optionsMenu ? (
        <NetworkOptionsMenu
          x={optionsMenu.x}
          y={optionsMenu.y}
          clearOnReload={ctx.clearNetworkOnReload}
          onClearOnReloadChange={ctx.onClearNetworkOnReloadChange}
          onClose={() => setOptionsMenu(null)}
        />
      ) : null}
    </div>
  );
}
