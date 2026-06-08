import type { ReactNode } from 'react';

export function getSearchTerms(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

export function textMatchesSearch(text: string, query: string): boolean {
  const terms = getSearchTerms(query);
  if (!terms.length) return false;

  const haystack = text.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSearchPattern(searchText: string): RegExp | null {
  const terms = getSearchTerms(searchText);
  if (!terms.length) return null;
  return new RegExp(terms.map(escapeRegExp).join('|'), 'gi');
}

export function countSearchOccurrences(text: string, searchText: string): number {
  const pattern = buildSearchPattern(searchText);
  if (!pattern) return 0;

  const matches = text.match(pattern);
  return matches?.length ?? 0;
}

export function highlightSearchText(text: string, searchText: string): ReactNode {
  const terms = getSearchTerms(searchText);
  if (!terms.length) return text;

  const basePattern = buildSearchPattern(searchText);
  if (!basePattern) return text;

  const pattern = new RegExp(`(${basePattern.source})`, basePattern.flags);
  const parts = text.split(pattern).filter((part) => part.length > 0);

  return parts.map((part, index) => {
    const isMatch = terms.some((term) => part.toLowerCase() === term.toLowerCase());
    if (isMatch) {
      return (
        <mark key={`${part}-${index}`} className="search-highlight">
          {part}
        </mark>
      );
    }
    return part;
  });
}
