/**
 * 안전한 localStorage 헬퍼 모음.
 *
 * 익스텐션 환경에서는 스토리지 접근이 실패할 수 있으므로(쿠키 차단, 시크릿 모드 등)
 * 모든 접근을 try/catch로 감쌉니다. 읽기는 기본값으로 폴백하고, 쓰기 오류는 무시합니다.
 */

export function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 스토리지 오류 무시.
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // 스토리지 오류 무시.
  }
}

export function readFlag(key: string, defaultValue: boolean): boolean {
  const stored = readString(key);
  if (stored === 'true') return true;
  if (stored === 'false') return false;
  return defaultValue;
}

export function writeFlag(key: string, value: boolean): void {
  writeString(key, String(value));
}

export function readEnum<T extends string>(
  key: string,
  allowed: readonly T[],
  defaultValue: T,
): T {
  const stored = readString(key);
  if (stored !== null && (allowed as readonly string[]).includes(stored)) {
    return stored as T;
  }
  return defaultValue;
}

export function readNumber(key: string, defaultValue: number): number {
  const stored = readString(key);
  if (stored === null) return defaultValue;
  const parsed = Number(stored);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function writeNumber(key: string, value: number): void {
  writeString(key, String(value));
}

export function readJson<T>(key: string): T | null {
  const stored = readString(key);
  if (stored === null) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as T;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    writeString(key, JSON.stringify(value));
  } catch {
    // 직렬화/스토리지 오류 무시.
  }
}
