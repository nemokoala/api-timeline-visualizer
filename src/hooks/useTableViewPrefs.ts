import { useCallback, useSyncExternalStore } from 'react';
import {
  getTableViewPrefs,
  saveTableViewPrefs,
  subscribeTableViewPrefs,
  type TableViewPrefs,
} from '../utils/tableViewPrefs';

type SetTableViewPrefs = (next: TableViewPrefs | ((prev: TableViewPrefs) => TableViewPrefs)) => void;

/**
 * 목록 표시 옵션 훅. 모듈 스토어를 구독해 설정 창에서 토글하면
 * 마운트된 모든 DataTable이 동시에 다시 렌더된다.
 */
export function useTableViewPrefs(): [TableViewPrefs, SetTableViewPrefs] {
  const prefs = useSyncExternalStore(subscribeTableViewPrefs, getTableViewPrefs, getTableViewPrefs);
  const setPrefs = useCallback<SetTableViewPrefs>((next) => {
    const resolved = typeof next === 'function' ? next(getTableViewPrefs()) : next;
    saveTableViewPrefs(resolved);
  }, []);
  return [prefs, setPrefs];
}
