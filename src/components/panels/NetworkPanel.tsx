import { useRef } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useSplitPanelLayout } from '../../hooks/useSplitPanelLayout';
import { FlowChartView } from '../network/FlowChartView';
import { RequestDetailPanel } from '../network/RequestDetailPanel';
import { SplitPanelResizer } from '../shared/SplitPanelResizer';
import { TimelineView } from '../network/TimelineView';
import { Button } from '../ui/Button';
import { PanelHeader } from './PanelHeader';
import type { ToggleableResourceKind } from '../../utils/resourceTypePrefs';

type ResourceKindOption = { kind: ToggleableResourceKind; label: string };

// API 계열과 정적 리소스를 구분자로 나눠 표시.
const API_RESOURCE_KIND_OPTIONS: ResourceKindOption[] = [
  { kind: 'fetch', label: 'Fetch' },
  { kind: 'xhr', label: 'XHR' },
  { kind: 'document', label: 'Doc' },
  { kind: 'websocket', label: 'WS' },
];

const STATIC_RESOURCE_KIND_OPTIONS: ResourceKindOption[] = [
  { kind: 'stylesheet', label: 'CSS' },
  { kind: 'script', label: 'JS' },
  { kind: 'image', label: 'Img' },
  { kind: 'font', label: 'Font' },
  { kind: 'media', label: 'Media' },
];

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
        <div className="resource-type-filter" role="group" aria-label="리소스 타입 표시">
          {API_RESOURCE_KIND_OPTIONS.map(({ kind, label }) => (
            <label key={kind} className="toggle-control">
              <input
                type="checkbox"
                checked={ctx.enabledResourceKinds.includes(kind)}
                onChange={(event) => ctx.onToggleResourceKind(kind, event.currentTarget.checked)}
              />
              <span>{label}</span>
            </label>
          ))}
          <span className="resource-type-filter-sep" aria-hidden="true" />
          {STATIC_RESOURCE_KIND_OPTIONS.map(({ kind, label }) => (
            <label key={kind} className="toggle-control">
              <input
                type="checkbox"
                checked={ctx.enabledResourceKinds.includes(kind)}
                onChange={(event) => ctx.onToggleResourceKind(kind, event.currentTarget.checked)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
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
