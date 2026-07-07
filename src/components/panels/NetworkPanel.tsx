import { useRef } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useSplitPanelLayout } from '../../hooks/useSplitPanelLayout';
import { FlowChartView } from '../network/FlowChartView';
import { RequestDetailPanel } from '../network/RequestDetailPanel';
import { SplitPanelResizer } from '../shared/SplitPanelResizer';
import { TimelineView } from '../network/TimelineView';
import { ResourceTypeMenu } from '../network/ResourceTypeMenu';
import { Button } from '../ui/Button';
import { PanelHeader } from './PanelHeader';

/** 도킹 패널로 렌더링되는 네트워크 뷰(Flow/Timeline + 요청 상세 분할). */
export function NetworkPanel() {
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

  return (
    <div className="dock-panel-shell">
      <PanelHeader scope="network" />
      <div className="network-actions">
        <div className="segmented-control" aria-label="Network view mode">
          <button
            className={ctx.networkViewMode === 'flow' ? 'active' : ''}
            type="button"
            onClick={() => ctx.onNetworkViewModeChange('flow')}
          >
            Flow
          </button>
          <button
            className={ctx.networkViewMode === 'timeline' ? 'active' : ''}
            type="button"
            onClick={() => ctx.onNetworkViewModeChange('timeline')}
          >
            Timeline
          </button>
        </div>
        <span className="network-actions-sep" aria-hidden="true" />
        <ResourceTypeMenu
          enabledKinds={ctx.enabledResourceKinds}
          onToggle={ctx.onToggleResourceKind}
        />
        {ctx.networkViewMode === 'flow' ? (
          <>
            <span className="network-actions-sep" aria-hidden="true" />
            <label className="toggle-control">
              <input
                type="checkbox"
                checked={ctx.groupFlowByTime}
                onChange={(event) => ctx.onGroupFlowByTimeChange(event.currentTarget.checked)}
              />
              <span>Group time</span>
            </label>
          </>
        ) : null}
        {ctx.sessionNotice ? <p className="toolbar-notice">{ctx.sessionNotice}</p> : null}
        <div className="toolbar-button-group" aria-label="Session actions">
          <Button onClick={ctx.onExportSession} disabled={!ctx.canExport}>
            Export
          </Button>
          <Button onClick={ctx.onImportSession}>Import</Button>
          <Button onClick={ctx.onClear} disabled={!ctx.canClear}>
            Clear
          </Button>
        </div>
      </div>
      <div
        ref={containerRef}
        className={`workspace network-dock-panel ${selectedRequest && isStacked ? 'split-layout-stacked' : ''}`}
        style={selectedRequest ? layoutStyle : undefined}
      >
      {ctx.networkViewMode === 'flow' ? (
        <FlowChartView
          items={ctx.timelineItems}
          requests={ctx.displayedRequests}
          selectedRequestId={ctx.selectedRequestId}
          groupByTime={ctx.groupFlowByTime}
          searchText={ctx.networkSearchText}
          searchOccurrenceByRequest={ctx.searchOccurrenceByRequest}
          activeGlobalSearchIndex={ctx.activeGlobalSearchIndex}
          layoutRevision={ctx.flowLayoutRevision}
          layoutSnapshot={ctx.flowLayoutSnapshot}
          onSelectRequest={ctx.onSelectRequest}
          onLayoutChange={ctx.onFlowLayoutChange}
        />
      ) : (
        <TimelineView
          items={ctx.timelineItems}
          requests={ctx.displayedRequests}
          selectedRequestId={ctx.selectedRequestId}
          searchText={ctx.networkSearchText}
          searchOccurrenceByRequest={ctx.searchOccurrenceByRequest}
          activeGlobalSearchIndex={ctx.activeGlobalSearchIndex}
          onSelectRequest={ctx.onSelectRequest}
          onEnsureThumbnailBody={ctx.onEnsureThumbnailBody}
        />
      )}
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
            onLoadResponseBody={ctx.onLoadResponseBody}
            onToggleLayout={toggleSplitLayout}
            onClose={ctx.onCloseDetail}
          />
        </>
      ) : null}
      </div>
    </div>
  );
}
