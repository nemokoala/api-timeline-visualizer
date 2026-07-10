import { useWorkspace } from '../../contexts/WorkspaceContext';
import { ConsoleView } from '../console/ConsoleView';
import { PanelHeader } from './PanelHeader';

/** 도킹 패널로 렌더링되는 콘솔 뷰. */
export function ConsolePanel() {
  const ctx = useWorkspace();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader scope="console" />
      <div className="min-h-0 flex-auto overflow-hidden">
        <ConsoleView
          entries={ctx.consoleEntries}
          selectedEntryId={ctx.selectedConsoleEntryId}
          searchText={ctx.consoleSearchText}
          includeText={ctx.consoleIncludeText}
          excludeText={ctx.consoleExcludeText}
          searchMatchIndex={ctx.consoleSearchMatchIndex}
          enabledLevels={ctx.enabledConsoleLevels}
          onToggleLevel={ctx.onToggleConsoleLevel}
          onSetAllLevels={ctx.onSetAllConsoleLevels}
          onEntriesChange={ctx.onConsoleEntriesChange}
          onSelectedEntryIdChange={ctx.onConsoleSelectedEntryIdChange}
          onSearchOccurrencesChange={ctx.onConsoleSearchOccurrencesChange}
          onSearchMatchIndexChange={ctx.onConsoleSearchMatchIndexChange}
        />
      </div>
    </div>
  );
}
