/**
 * 쿠키 표시/입력 값 변환 헬퍼. CookiePane·CookieForm·StorageDetailPanel이 공유한다.
 */
import type { CookieSameSite } from "../../types/storage";
import { formatLocaleDateTime } from "../../utils/formatters";

export function formatCookieExpires(expires: number | null): string {
  if (expires === null) return "Session";
  return formatLocaleDateTime(expires * 1000);
}

export function formatSameSite(sameSite: CookieSameSite): string {
  switch (sameSite) {
    case "none":
      return "None";
    case "lax":
      return "Lax";
    case "strict":
      return "Strict";
    default:
      return "—";
  }
}

export function hostnameFromUrl(url: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** epoch seconds → datetime-local input용 로컬 시간 문자열(YYYY-MM-DDTHH:mm). */
export function epochToLocalInput(expires: number | null): string {
  if (expires === null) return "";
  const date = new Date(expires * 1000);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
