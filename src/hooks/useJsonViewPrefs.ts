import { useCallback, useSyncExternalStore } from 'react';
import {
  getJsonViewPrefs,
  saveJsonViewPrefs,
  subscribeJsonViewPrefs,
  type JsonViewPrefs,
} from '../utils/jsonViewPrefs';

type SetJsonViewPrefs = (next: JsonViewPrefs | ((prev: JsonViewPrefs) => JsonViewPrefs)) => void;

/**
 * JSON 표시 옵션 훅. 모듈 스토어를 구독해 어느 뷰어에서 토글하든
 * 마운트된 모든 JsonViewer/JsonTree가 동시에 다시 렌더된다.
 */
export function useJsonViewPrefs(): [JsonViewPrefs, SetJsonViewPrefs] {
  const prefs = useSyncExternalStore(subscribeJsonViewPrefs, getJsonViewPrefs, getJsonViewPrefs);
  const setPrefs = useCallback<SetJsonViewPrefs>((next) => {
    const resolved = typeof next === 'function' ? next(getJsonViewPrefs()) : next;
    saveJsonViewPrefs(resolved);
  }, []);
  return [prefs, setPrefs];
}
