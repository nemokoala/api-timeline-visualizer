import type { ReactNode } from 'react';

export type SearchOptions = {
  matchCase?: boolean;
  matchWholeWord?: boolean;
};

const DEFAULT_SEARCH_OPTIONS: Required<SearchOptions> = {
  matchCase: false,
  matchWholeWord: false,
};

function resolveSearchOptions(options?: SearchOptions): Required<SearchOptions> {
  return { ...DEFAULT_SEARCH_OPTIONS, ...options };
}

export function getSearchTerms(query: string, options?: SearchOptions): string[] {
  const { matchCase } = resolveSearchOptions(options);
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (matchCase) return terms;
  return terms.map((term) => term.toLowerCase());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTermPattern(term: string, options?: SearchOptions): string {
  const { matchWholeWord } = resolveSearchOptions(options);
  const escaped = escapeRegExp(term);
  return matchWholeWord ? `\\b${escaped}\\b` : escaped;
}

function buildSearchPattern(searchText: string, options?: SearchOptions): RegExp | null {
  const terms = getSearchTerms(searchText, options);
  if (!terms.length) return null;

  const { matchCase } = resolveSearchOptions(options);
  const flags = matchCase ? 'g' : 'gi';
  return new RegExp(terms.map((term) => buildTermPattern(term, options)).join('|'), flags);
}

function partMatchesSearch(part: string, searchText: string, options?: SearchOptions): boolean {
  const pattern = buildSearchPattern(searchText, options);
  if (!pattern) return false;

  const testPattern = new RegExp(`^(?:${pattern.source})$`, pattern.flags.replace('g', ''));
  return testPattern.test(part);
}

export function textMatchesSearch(text: string, query: string, options?: SearchOptions): boolean {
  const terms = getSearchTerms(query, options);
  if (!terms.length) return false;

  const { matchCase } = resolveSearchOptions(options);
  const haystack = matchCase ? text : text.toLowerCase();

  return terms.every((term) => {
    const pattern = new RegExp(buildTermPattern(term, options), matchCase ? '' : 'i');
    return pattern.test(haystack);
  });
}

export function countSearchOccurrences(text: string, searchText: string, options?: SearchOptions): number {
  const pattern = buildSearchPattern(searchText, options);
  if (!pattern) return 0;

  const matches = text.match(pattern);
  return matches?.length ?? 0;
}

export function highlightSearchText(
  text: string,
  searchText: string,
  options?: SearchOptions,
  markClassName = 'search-highlight',
): ReactNode {
  const terms = getSearchTerms(searchText, options);
  if (!terms.length) return text;

  const basePattern = buildSearchPattern(searchText, options);
  if (!basePattern) return text;

  const pattern = new RegExp(`(${basePattern.source})`, basePattern.flags);
  const parts = text.split(pattern).filter((part) => part.length > 0);

  return parts.map((part, index) => {
    if (partMatchesSearch(part, searchText, options)) {
      return (
        <mark key={`${part}-${index}`} className={markClassName}>
          {part}
        </mark>
      );
    }
    return part;
  });
}
