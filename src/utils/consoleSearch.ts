import type { ConsoleEntry } from '../types/console';
import { countSearchOccurrences, getSearchTerms, textMatchesSearch } from './searchHighlight';

export type ConsoleSearchOccurrence = {
  entryId: string;
  occurrenceIndex: number;
};

export type ConsoleEntrySearchSummary = {
  hitCount: number;
  globalStart: number;
  globalEnd: number;
  entryOrder: number;
};

function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value);
}

function stringifyArgs(args: unknown[]): string {
  return args.map((arg) => stringifyValue(arg)).join(' ');
}

export function buildConsoleSearchText(entry: ConsoleEntry): string {
  return [entry.level, entry.text, entry.stack ?? '', entry.source ?? '', stringifyArgs(entry.args)]
    .join(' ')
    .toLowerCase();
}

export function matchesConsoleSearch(entry: ConsoleEntry, searchText: string): boolean {
  if (!getSearchTerms(searchText).length) return true;
  return textMatchesSearch(buildConsoleSearchText(entry), searchText);
}

export function countSearchOccurrencesInArgValue(value: unknown, searchText: string): number {
  if (!getSearchTerms(searchText).length) return 0;

  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countSearchOccurrencesInArgValue(item, searchText), 0);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((sum, [key, item]) => {
      return sum + countSearchOccurrences(key, searchText) + countSearchOccurrencesInArgValue(item, searchText);
    }, 0);
  }

  if (value === null) return 0;
  if (typeof value === 'string') return countSearchOccurrences(value, searchText);
  if (typeof value === 'number' || typeof value === 'boolean') {
    return countSearchOccurrences(String(value), searchText);
  }

  return countSearchOccurrences(String(value), searchText);
}

export function consoleArgsMatchSearch(args: unknown[], searchText: string): boolean {
  if (!getSearchTerms(searchText).length) return false;
  return args.some((arg) => countSearchOccurrencesInArgValue(arg, searchText) > 0);
}

function appendTextOccurrences(
  occurrences: ConsoleSearchOccurrence[],
  entryId: string,
  markIndex: { value: number },
  searchText: string,
  text: string,
): void {
  const hitCount = countSearchOccurrences(text, searchText);
  for (let index = 0; index < hitCount; index += 1) {
    occurrences.push({ entryId, occurrenceIndex: markIndex.value });
    markIndex.value += 1;
  }
}

function appendArgValueOccurrences(
  occurrences: ConsoleSearchOccurrence[],
  entryId: string,
  markIndex: { value: number },
  searchText: string,
  value: unknown,
): void {
  const hitCount = countSearchOccurrencesInArgValue(value, searchText);
  for (let index = 0; index < hitCount; index += 1) {
    occurrences.push({ entryId, occurrenceIndex: markIndex.value });
    markIndex.value += 1;
  }
}

function buildConsoleEntryOccurrences(entry: ConsoleEntry, searchText: string): ConsoleSearchOccurrence[] {
  const occurrences: ConsoleSearchOccurrence[] = [];
  const markIndex = { value: 0 };

  appendTextOccurrences(occurrences, entry.id, markIndex, searchText, entry.level);

  if (entry.args.length === 0) {
    appendTextOccurrences(occurrences, entry.id, markIndex, searchText, entry.text);
  }

  if (entry.source) {
    appendTextOccurrences(occurrences, entry.id, markIndex, searchText, entry.source);
  }

  for (const arg of entry.args) {
    appendArgValueOccurrences(occurrences, entry.id, markIndex, searchText, arg);
  }

  if (entry.stack) {
    appendTextOccurrences(occurrences, entry.id, markIndex, searchText, entry.stack);
  }

  return occurrences;
}

export function buildConsoleSearchOccurrences(
  entries: ConsoleEntry[],
  searchText: string,
): ConsoleSearchOccurrence[] {
  if (!getSearchTerms(searchText).length) return [];

  const occurrences: ConsoleSearchOccurrence[] = [];

  for (const entry of entries) {
    if (!matchesConsoleSearch(entry, searchText)) continue;
    occurrences.push(...buildConsoleEntryOccurrences(entry, searchText));
  }

  return occurrences;
}

export function buildConsoleOccurrenceSummaryByEntry(
  occurrences: ConsoleSearchOccurrence[],
): Map<string, ConsoleEntrySearchSummary> {
  const summaryByEntry = new Map<string, ConsoleEntrySearchSummary>();
  let globalIndex = 0;
  let entryOrder = 0;
  let lastEntryId: string | null = null;

  for (const occurrence of occurrences) {
    globalIndex += 1;

    if (occurrence.entryId !== lastEntryId) {
      entryOrder += 1;
      lastEntryId = occurrence.entryId;
      summaryByEntry.set(occurrence.entryId, {
        hitCount: 1,
        globalStart: globalIndex,
        globalEnd: globalIndex,
        entryOrder,
      });
      continue;
    }

    const summary = summaryByEntry.get(occurrence.entryId);
    if (!summary) continue;

    summary.hitCount += 1;
    summary.globalEnd = globalIndex;
  }

  return summaryByEntry;
}

export function getConsoleEntryJumpIndices(occurrences: ConsoleSearchOccurrence[]): number[] {
  const indices: number[] = [];
  let lastEntryId: string | null = null;

  occurrences.forEach((occurrence, index) => {
    if (occurrence.entryId === lastEntryId) return;
    indices.push(index);
    lastEntryId = occurrence.entryId;
  });

  return indices;
}

export function getSearchMatchIndexForConsoleEntry(
  occurrences: ConsoleSearchOccurrence[],
  entryId: string,
): number | null {
  const index = occurrences.findIndex((occurrence) => occurrence.entryId === entryId);
  return index >= 0 ? index : null;
}

export function getNextConsoleEntryJumpIndex(
  occurrences: ConsoleSearchOccurrence[],
  currentMatchIndex: number,
  direction: 1 | -1,
): number | null {
  const jumpIndices = getConsoleEntryJumpIndices(occurrences);
  if (!jumpIndices.length) return null;

  const currentEntryId = occurrences[currentMatchIndex]?.entryId;
  if (!currentEntryId) return jumpIndices[0] ?? null;

  const currentJumpPos = jumpIndices.findIndex(
    (index) => occurrences[index]?.entryId === currentEntryId,
  );
  const resolvedJumpPos = currentJumpPos >= 0 ? currentJumpPos : 0;
  const nextJumpPos = (resolvedJumpPos + direction + jumpIndices.length) % jumpIndices.length;

  return jumpIndices[nextJumpPos] ?? null;
}
