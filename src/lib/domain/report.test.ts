import { describe, expect, it } from "vitest";
import { isLastReportOfMonth, prefillReport, renderReport, reportFieldsSchema, reportPeriodFor, reportDateSchema } from "./report";

import { todayISO } from "./dates";

const items = [
  { id: "a", originalText: "Провести 15 кастдевов", status: null, currentValue: null, targetValue: 15, unit: "кастдевов" },
  { id: "b", originalText: "Провести 3 встречи", status: "in_progress", currentValue: 1, targetValue: 3, unit: "встречи" },
  { id: "c", originalText: "Снять пилот", status: null, currentValue: 0, targetValue: 1, unit: "выпуск" },
];

describe("reportPeriodFor", () => {
  it("сохраняет календарный период первого отчёта", () => {
    expect(reportPeriodFor("2026-10-09", "2026-10-02")).toMatchObject({
      weekNumber: 1, periodStart: "2026-10-02", periodEnd: "2026-10-09",
    });
  });
  it.each(["2026-11-09", "2026-11-12", "2026-11-13"])("%s выбирает пятницу 13 ноября", (day) => {
    expect(reportPeriodFor(day, "2026-10-02")).toMatchObject({
      weekNumber: 6, periodStart: "2026-11-07", periodEnd: "2026-11-13",
      reportDate: "2026-11-13", coverageStart: "2026-11-09", coverageEnd: "2026-11-13", cutoffDate: day,
    });
  });
  it.each(["2026-11-14", "2026-11-15", "2026-11-16"])("%s выбирает следующую пятницу", (day) => {
    expect(reportPeriodFor(day, "2026-10-02")).toMatchObject({
      weekNumber: 7, reportDate: "2026-11-20", coverageStart: "2026-11-16", coverageEnd: "2026-11-20", cutoffDate: day,
    });
  });
  it("явный выбор прошлой даты ограничивает срез концом периода", () => {
    expect(reportPeriodFor("2026-11-12", "2026-10-02", "2026-11-06")).toMatchObject({
      weekNumber: 5, periodStart: "2026-10-31", periodEnd: "2026-11-06", cutoffDate: "2026-11-06",
    });
  });
  it("явный выбор будущей даты не переносит срез в будущее", () => {
    expect(reportPeriodFor("2026-11-12", "2026-10-02", "2026-11-20").cutoffDate).toBe("2026-11-12");
  });
  it.each(["2026-11-12", "2026-02-30", "not-a-date"])("отклоняет недопустимую отчётную дату %s", (day) => {
    expect(reportDateSchema.safeParse(day).success).toBe(false);
    expect(() => reportPeriodFor("2026-11-12", "2026-10-02", day)).toThrow();
  });
  it.each([
    ["2026-11-12T18:59:59.999Z", "2026-11-12", "2026-11-13"],
    ["2026-11-12T19:00:00.000Z", "2026-11-13", "2026-11-13"],
    ["2026-11-13T18:59:59.999Z", "2026-11-13", "2026-11-13"],
    ["2026-11-13T19:00:00.000Z", "2026-11-14", "2026-11-20"],
    ["2026-11-15T19:00:00.000Z", "2026-11-16", "2026-11-20"],
  ])("граница суток Екатеринбурга %s", (instant, day, friday) => {
    expect(todayISO(new Date(instant))).toBe(day);
    expect(reportPeriodFor(todayISO(new Date(instant)), "2026-10-02").reportDate).toBe(friday);
  });
  it("переходит через границу года", () => {
    expect(reportPeriodFor("2026-12-31", "2026-10-02").reportDate).toBe("2027-01-01");
    expect(reportPeriodFor("2027-01-02", "2026-10-02").reportDate).toBe("2027-01-08");
  });
});

describe("isLastReportOfMonth", () => {
  it("09.10 — не последний, 30.10 — последний", () => {
    expect(isLastReportOfMonth("2026-10-09")).toBe(false);
    expect(isLastReportOfMonth("2026-10-30")).toBe(true);
  });
});

describe("prefillReport", () => {
  const f = prefillReport({ items, completedTaskTitles: [], nextWeekTaskTitles: ["Позвонить"], periodEnd: "2026-10-09" });

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
    expect(text.startsWith("ОТЧЁТ ЗА 1 НЕДЕЛЮ\nПериод: 02.10.2026–09.10.2026")).toBe(true);
    expect(text).toContain("1) Провести 15 кастдевов — Требует подтверждения");
    expect(text).toContain("2) Провести 3 встречи — в процессе; 1 из 3 встречи (33%)");
    expect(text).toContain("Фокус:\n");
    expect(text).toContain("Заполняется в последнем отчёте месяца.");
    const headers = ["1. Статус по декларации", "2. Работа за неделю", "3. Финансы за месяц", "4. Дополнительный бизнес", "5. Состояние", "6. Обратная связь, вызовы, идеи"];
    const positions = headers.map((h) => text.indexOf(h));
    expect(positions.every((p) => p > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
  it("пустые данные не ломают отчёт", () => {
    const text = renderReport({ weekNumber: 1, periodStart: "2026-10-02", periodEnd: "2026-10-09" }, reportFieldsSchema.parse({}));
    expect(text).toContain("Требует подтверждения");
    expect(text).toContain("Оценка: Требует уточнения");
  });
  it("финансы выводятся, когда включены", () => {
    const f = reportFieldsSchema.parse({ includeFinance: true, finance: { revenue: "100 000 ₽" }, stateScore: 7, stateWhy: "нормально" });
    const text = renderReport({ weekNumber: 5, periodStart: "2026-10-24", periodEnd: "2026-10-30" }, f);
    expect(text).toContain("Выручка: 100 000 ₽");
    expect(text).toContain("Оценка: 7/10 — нормально");
  });
});

describe("report metadata and confirmed facts", () => {
  it("показывает дату, охват и фиксированный срез", () => {
    const period = reportPeriodFor("2026-11-12", "2026-10-02");
    const text = renderReport(period, reportFieldsSchema.parse({}));
    expect(text).toContain("Отчётная дата: 13.11.2026");
    expect(text).toContain("Фактический охват: 09.11.2026–13.11.2026");
    expect(text).toContain("Дата среза: 12.11.2026");
  });
  it("историческая запись без метаданных не получает новый охват", () => {
    const text = renderReport({ weekNumber: 5, periodStart: "2026-10-31", periodEnd: "2026-11-06" }, reportFieldsSchema.parse({}));
    expect(text).toContain("Период: 31.10.2026–06.11.2026");
    expect(text).not.toContain("Фактический охват:");
    expect(text).not.toContain("Дата среза:");
  });
  it("неизвестные деньги остаются пустыми, состояние — null", () => {
    const f = prefillReport({ items: [], completedTaskTitles: [], nextWeekTaskTitles: [], periodEnd: "2026-11-13" });
    expect(f.stateScore).toBeNull();
    expect(Object.values(f.finance).every((v) => v === "")).toBe(true);
    expect(f.includeFinance).toBe(false);
  });
  it("различает поступления, ожидаемые оплаты, выручку и личную прибыль", () => {
    const f = reportFieldsSchema.parse({ includeFinance: true, finance: { actualReceipts: "10 000 ₽", expectedPayments: "20 000 ₽", revenue: "30 000 ₽", netProfit: "5 000 ₽" } });
    const text = renderReport(reportPeriodFor("2026-11-12", "2026-10-02"), f);
    expect(text).toContain("Фактические поступления: 10 000 ₽");
    expect(text).toContain("Ожидаемые оплаты: 20 000 ₽");
    expect(text).toContain("Выручка: 30 000 ₽");
    expect(text).toContain("Личная прибыль: 5 000 ₽");
  });
  it("частичный закрытый пилот не становится опубликованным выпуском", () => {
    const fields = reportFieldsSchema.parse({ declaration: [{ itemId: "pilot", title: "Опубликовать выпуск YouTube", status: "partial", progressText: "0 из 1", comment: "Пилот доступен по закрытой ссылке; публичной публикации нет." }] });
    const text = renderReport(reportPeriodFor("2026-11-12", "2026-10-02"), fields);
    expect(text).toContain("частично");
    expect(text).toContain("публичной публикации нет");
    expect(fields.declaration[0].status).toBe("partial");
  });
});
