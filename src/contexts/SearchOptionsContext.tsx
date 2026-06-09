import { createContext, useContext, type ReactNode } from 'react';
import type { SearchOptions } from '../utils/searchHighlight';

const defaultSearchOptions: Required<SearchOptions> = {
  matchCase: false,
  matchWholeWord: false,
};

const SearchOptionsContext = createContext<Required<SearchOptions>>(defaultSearchOptions);

export function SearchOptionsProvider({
  value,
  children,
}: {
  value: Required<SearchOptions>;
  children: ReactNode;
}) {
  return <SearchOptionsContext.Provider value={value}>{children}</SearchOptionsContext.Provider>;
}

export function useSearchOptions(): Required<SearchOptions> {
  return useContext(SearchOptionsContext);
}
