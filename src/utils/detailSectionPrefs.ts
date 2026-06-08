const STORAGE_KEY = 'api-flow-detail-sections';

const DEFAULT_OPEN: Record<string, boolean> = {
  general: true,
  headers: false,
  payload: false,
  response: true,
  timing: false,
  replay: false,
};

function readPrefs(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writePrefs(prefs: Record<string, boolean>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage failures in extension context.
  }
}

export function getDetailSectionOpen(sectionId: string, fallback = false): boolean {
  const prefs = readPrefs();
  if (typeof prefs[sectionId] === 'boolean') return prefs[sectionId];
  return DEFAULT_OPEN[sectionId] ?? fallback;
}

export function setDetailSectionOpen(sectionId: string, open: boolean): void {
  const prefs = readPrefs();
  prefs[sectionId] = open;
  writePrefs(prefs);
}
