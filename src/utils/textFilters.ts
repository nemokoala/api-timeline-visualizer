export function parseFilterTerms(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[,\s]+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

export function matchesAnyExclude(text: string, excludeText: string): boolean {
  const terms = parseFilterTerms(excludeText);
  if (!terms.length) return false;

  const haystack = text.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

export function matchesAnyInclude(text: string, includeText: string): boolean {
  const terms = parseFilterTerms(includeText);
  if (!terms.length) return true;

  const haystack = text.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

export function matchesIncludeExcludeFilters(
  text: string,
  includeText: string,
  excludeText: string,
): boolean {
  if (matchesAnyExclude(text, excludeText)) return false;
  return matchesAnyInclude(text, includeText);
}
