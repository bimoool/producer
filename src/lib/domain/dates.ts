import { TZDate } from "@date-fns/tz";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

export const TIMEZONE = "Asia/Yekaterinburg";

/** ISO-дата (YYYY-MM-DD) «сегодня» в часовом поясе пользователя. */
export function todayISO(now: Date = new Date()): string {
  return format(new TZDate(now, TIMEZONE), "yyyy-MM-dd");
}

export function addDaysISO(iso: string, days: number): string {
  return format(addDays(parseISO(iso), days), "yyyy-MM-dd");
}

export function diffDaysISO(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(a), parseISO(b));
}

/** 2026-10-02 → 02.10.2026 */
export function formatRu(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

/** День недели 0 = вс … 6 = сб для ISO-даты. */
export function weekdayISO(iso: string): number {
  return parseISO(iso).getDay();
}
