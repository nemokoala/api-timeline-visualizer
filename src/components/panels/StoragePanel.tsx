import { useWorkspace } from '../../contexts/WorkspaceContext';
import { StorageView } from '../storage/StorageView';
import { PanelHeader } from './PanelHeader';

/** 도킹 패널로 렌더링되는 스토리지 뷰. */
export function StoragePanel() {
  const ctx = useWorkspace();

  return (
    <div className="dock-panel-shell">
      <PanelHeader scope="storage" />
      <div className="dock-pane workspace-storage">
        <StorageView
          searchText={ctx.storageSearchText}
          searchMatchIndex={ctx.storageSearchMatchIndex}
          includeText={ctx.storageIncludeText}
          excludeText={ctx.storageExcludeText}
          onSearchOccurrencesChange={ctx.onStorageSearchOccurrencesChange}
          onSearchMatchIndexChange={ctx.onStorageSearchMatchIndexChange}
        />
      </div>
    </div>
  );
}
