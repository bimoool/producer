import { describe, expect, it } from "vitest";
import { change, countBy, filterPlan, isPublished, periodTotals, topReels, upcoming } from "./insights";
import type { DailyStat, PlanItem, Reel } from "./vera-template";

const day = (date: string, v: number, reach: number | null, follows: number | null): DailyStat => ({ date, views: v, reach, follows, profileVisits: 1, linkClicks: null });
const empty = { igViews: null, igFollows: null, leads: null, revenue: null, tgClicks: null, ytViews: null, ytSubs: null, vkViews: null, vkSubs: null };
const plan = (row: number, date: string | null, status: string, goal = "Подписки"): PlanItem => ({
  row, date, dateText: date ?? "", idea: `идея ${row}`, goal, cta: "", audience: "", hypothesis: "", contentType: "", tags: "", status, results: empty, conclusion: "",
});

describe("periodTotals", () => {
  const daily = [day("2026-09-01", 100, 50, 1), day("2026-10-01", 1000, 800, 8), day("2026-10-09", 2000, null, null)];
  it("сумма за окно включительно, пустые значения не ломают", () => {
    const t = periodTotals(daily, 30, "2026-10-09");
    expect(t).toMatchObject({ from: "2026-09-10", days: 2, views: 3000, reach: 800, follows: 8, profileVisits: 2, linkClicks: 0 });
    expect(t.followConversion).toBeCloseTo(0.01);
  });
  it("нет охвата — конверсии нет (без деления на ноль)", () => {
    expect(periodTotals([], 30, "2026-10-09").followConversion).toBeNull();
  });
  it("изменение к прошлому периоду", () => {
    expect(change(150, 100)).toBeCloseTo(0.5);
    expect(change(5, 0)).toBeNull();
  });
});

describe("контент-план", () => {
  const items = [plan(3, "2026-10-15", "Опубликован"), plan(4, "2026-10-20", "Запланирован"), plan(5, "2026-10-09", "Съёмка", "Лиды"), plan(6, null, "Идея"), plan(7, "2026-10-01", "")];
  it("ближайшие: с сегодняшнего дня, не опубликованные, по дате", () => {
    expect(upcoming(items, "2026-10-09").map((p) => p.row)).toEqual([5, 4]);
  });
  it("распознавание статуса «опубликован»", () => {
    expect(isPublished("Опубликован")).toBe(true);
    expect(isPublished("опубликовано")).toBe(true);
    expect(isPublished("Запланирован")).toBe(false);
  });
  it("фильтры по статусу, цели, дате", () => {
    expect(filterPlan(items, { status: "Запланирован" }, "2026-10-09").map((p) => p.row)).toEqual([4]);
    expect(filterPlan(items, { status: "Без статуса" }, "2026-10-09").map((p) => p.row)).toEqual([7]);
    expect(filterPlan(items, { goal: "Лиды" }, "2026-10-09").map((p) => p.row)).toEqual([5]);
    expect(filterPlan(items, { when: "upcoming" }, "2026-10-09").map((p) => p.row)).toEqual([5, 3, 4]);
    expect(filterPlan(items, { when: "past" }, "2026-10-09").map((p) => p.row)).toEqual([7]);
    expect(filterPlan(items, { month: "2026-10" }, "2026-10-09").map((p) => p.row)).toEqual([7, 5, 3, 4]);
    expect(filterPlan(items, {}, "2026-10-09").map((p) => p.row)).toEqual([7, 5, 3, 4, 6]);
  });
  it("подсчёт статусов", () => {
    expect(countBy(items, (p) => p.status)[0]).toEqual({ label: "Без статуса", count: 1 });
    expect(countBy(items, (p) => p.status)).toHaveLength(5);
  });
});

describe("topReels", () => {
  const r = (views: number | null, follows: number | null) => ({ views, follows }) as Reel;
  it("сортировка по метрике, пустые значения исключаются", () => {
    expect(topReels([r(1, 5), r(10, null), r(5, 1)], "follows", 5).map((x) => x.follows)).toEqual([5, 1]);
    expect(topReels([r(1, 5), r(10, null), r(5, 1)], "views", 2).map((x) => x.views)).toEqual([10, 5]);
  });
});
