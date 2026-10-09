import { describe, expect, it } from "vitest";
import { isLastReportOfMonth, prefillReport, renderReport, reportFieldsSchema, reportPeriodFor } from "./report";

const items = [
  { id: "a", originalText: "Провести 15 кастдевов", status: null, currentValue: null, targetValue: 15, unit: "кастдевов" },
  { id: "b", originalText: "Провести 3 встречи", status: "in_progress", currentValue: 1, targetValue: 3, unit: "встречи" },
  { id: "c", originalText: "Снять пилот", status: null, currentValue: 0, targetValue: 1, unit: "выпуск" },
];

describe("reportPeriodFor", () => {
  it("первый отчёт 09.10.2026 — неделя 1, 02.10–08.10", () => {
    expect(reportPeriodFor("2026-10-09", "2026-10-02")).toEqual({
      weekNumber: 1,
      periodStart: "2026-10-02",
      periodEnd: "2026-10-08",
    });
  });
  it("в субботу и четверг указывает на последнюю пятницу", () => {
    expect(reportPeriodFor("2026-10-10", "2026-10-02").weekNumber).toBe(1);
    expect(reportPeriodFor("2026-10-15", "2026-10-02").weekNumber).toBe(1);
    expect(reportPeriodFor("2026-10-16", "2026-10-02")).toEqual({
      weekNumber: 2,
      periodStart: "2026-10-09",
      periodEnd: "2026-10-15",
    });
  });
});

describe("isLastReportOfMonth", () => {
  it("09.10 — не последний, 30.10 — последний", () => {
    expect(isLastReportOfMonth("2026-10-08")).toBe(false);
    expect(isLastReportOfMonth("2026-10-29")).toBe(true);
  });
});

describe("prefillReport", () => {
  const f = prefillReport({ items, completedTaskTitles: [], nextWeekTaskTitles: ["Позвонить"], periodEnd: "2026-10-08" });

  it("неизвестный статус → требует подтверждения, а не «не выполнено»", () => {
    expect(f.declaration[0].status).toBe("unconfirmed");
    expect(f.declaration[0].progressText).toBe("");
  });
  it("подтверждённый ноль показывается как ноль", () => {
    expect(f.declaration[2].progressText).toBe("0 из 1 выпуск (0%)");
  });
  it("ничего не выдумывает в ручных полях", () => {
    expect(f.focus).toBe("");
    expect(f.done).toBe("");
    expect(f.stateScore).toBeNull();
    expect(f.includeFinance).toBe(false);
    expect(f.nextPlan).toBe("— Позвонить");
  });
});

describe("renderReport", () => {
  it("строгая структура и пустые поля для заполнения", () => {
    const period = reportPeriodFor("2026-10-09", "2026-10-02");
    const text = renderReport(period, prefillReport({ items, completedTaskTitles: [], nextWeekTaskTitles: [], periodEnd: period.periodEnd }));
    expect(text.startsWith("ОТЧЁТ ЗА 1 НЕДЕЛЮ\nПериод: 02.10.2026–08.10.2026")).toBe(true);
    expect(text).toContain("1) Провести 15 кастдевов — Требует подтверждения");
    expect(text).toContain("2) Провести 3 встречи — в процессе (1 из 3 встречи (33%))");
    expect(text).toContain("Фокус:\n");
    expect(text).toContain("Заполняется в последнем отчёте месяца.");
    const headers = ["1. Статус по декларации", "2. Работа за неделю", "3. Финансы за месяц", "4. Дополнительный бизнес", "5. Состояние", "6. Обратная связь, вызовы, идеи"];
    const positions = headers.map((h) => text.indexOf(h));
    expect(positions.every((p) => p > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
  it("пустые данные не ломают отчёт", () => {
    const text = renderReport({ weekNumber: 1, periodStart: "2026-10-02", periodEnd: "2026-10-08" }, reportFieldsSchema.parse({}));
    expect(text).toContain("Требует подтверждения");
    expect(text).toContain("Оценка:");
  });
  it("финансы выводятся, когда включены", () => {
    const f = reportFieldsSchema.parse({ includeFinance: true, finance: { revenue: "100 000 ₽" }, stateScore: 7, stateWhy: "нормально" });
    const text = renderReport({ weekNumber: 4, periodStart: "2026-10-23", periodEnd: "2026-10-29" }, f);
    expect(text).toContain("Выручка: 100 000 ₽");
    expect(text).toContain("Оценка: 7/10 — нормально");
  });
});
