import { addDaysISO } from "@/lib/domain/dates";
import type { DailyStat, PlanItem, Reel } from "./vera-template";

export type Totals = {
  days: number;
  from: string;
  to: string;
  views: number;
  reach: number;
  follows: number;
  profileVisits: number;
  linkClicks: number;
  /** Подписки / охват (доля); null, если охвата нет. */
  followConversion: number | null;
};

/** Сумма по дневной статистике за `days` дней, заканчивая `to` (включительно). */
export function periodTotals(daily: DailyStat[], days: number, to: string): Totals {
  const from = addDaysISO(to, -(days - 1));
  const rows = daily.filter((d) => d.date >= from && d.date <= to);
  const sum = (k: keyof Omit<DailyStat, "date">) => rows.reduce((s, r) => s + (r[k] ?? 0), 0);
  const reach = sum("reach");
  const follows = sum("follows");
  return {
    days: rows.length,
    from,
    to,
    views: sum("views"),
    reach,
    follows,
    profileVisits: sum("profileVisits"),
    linkClicks: sum("linkClicks"),
    followConversion: reach > 0 ? follows / reach : null,
  };
}

/** Изменение к предыдущему периоду (доля); null, если сравнивать не с чем. */
export function change(current: number, previous: number): number | null {
  if (!previous) return null;
  return (current - previous) / previous;
}

const PUBLISHED = /опубликован|вышел|выложен|published|готово|done/i;
export const isPublished = (status: string) => PUBLISHED.test(status);

/** Ближайшие публикации: дата сегодня или позже, ещё не опубликованы. */
export function upcoming(plan: PlanItem[], today: string, limit = 5): PlanItem[] {
  return plan
    .filter((p) => p.date !== null && p.date >= today && !isPublished(p.status))
    .sort((a, b) => a.date!.localeCompare(b.date!))
    .slice(0, limit);
}

/** Подсчёт значений (пустое → «Без статуса»), по убыванию. */
export function countBy<T>(items: T[], key: (t: T) => string, empty = "Без статуса"): { label: string; count: number }[] {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it).trim() || empty;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export type PlanFilter = { status?: string; goal?: string; when?: "upcoming" | "past" | "all"; month?: string };

/** Фильтр контент-плана (статус, цель, дата). Без даты попадают только в «все». */
export function filterPlan(plan: PlanItem[], f: PlanFilter, today: string): PlanItem[] {
  return plan
    .filter((p) => !f.status || (p.status || "Без статуса") === f.status)
    .filter((p) => !f.goal || (p.goal || "Без цели") === f.goal)
    .filter((p) => {
      if (f.month) return p.date?.startsWith(f.month) ?? false;
      if (f.when === "upcoming") return p.date !== null && p.date >= today;
      if (f.when === "past") return p.date !== null && p.date < today;
      return true;
    })
    .sort((a, b) => {
      if (a.date === b.date) return a.row - b.row;
      if (a.date === null) return 1;
      if (b.date === null) return -1;
      return f.when === "past" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
    });
}

export const REEL_METRICS = {
  views: "Просмотры",
  reach: "Охват",
  follows: "Подписки",
  saves: "Сохранения",
  shares: "Репосты",
  follows1k: "Подписки на 1k охвата",
} as const;
export type ReelMetric = keyof typeof REEL_METRICS;

export function topReels(reels: Reel[], metric: ReelMetric, limit: number): Reel[] {
  return reels
    .filter((r) => r[metric] !== null)
    .sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0))
    .slice(0, limit);
}
