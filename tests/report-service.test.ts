import { beforeEach, describe, expect, it, vi } from "vitest";
import { reportFieldsSchema } from "@/lib/domain/report";

const data = vi.hoisted(() => ({
  getDeclaration: vi.fn(), getReportByDate: vi.fn(),
  tasksCompletedBetween: vi.fn(), openTasksDueBetween: vi.fn(),
}));
vi.mock("@/lib/data", () => data);
import { buildCurrentReport } from "@/lib/report-service";

const declarationId = "00000000-0000-4000-8000-000000000001";
const declaration = {
  id: declarationId, cycleStart: "2026-10-02",
  items: [{ id: "pilot", originalText: "Публично опубликовать пилот YouTube", status: "done", currentValue: 1, targetValue: 1, unit: "выпуск" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  data.getDeclaration.mockResolvedValue(declaration);
  data.getReportByDate.mockResolvedValue(null);
  data.tasksCompletedBetween.mockResolvedValue([{ title: "Подготовлен пилот по закрытой ссылке" }]);
  data.openTasksDueBetween.mockResolvedValue([{ title: "Публичная публикация" }]);
});

describe("подготовка текущего отчёта", () => {
  it("12 ноября выбирает 13 ноября, охват 09–13, срез 12; результаты ограничены срезом", async () => {
    const result = await buildCurrentReport("2026-11-12");
    expect(result.period).toEqual({
      weekNumber: 6, periodStart: "2026-11-07", periodEnd: "2026-11-13",
      reportDate: "2026-11-13", coverageStart: "2026-11-09", coverageEnd: "2026-11-13", cutoffDate: "2026-11-12",
    });
    expect(data.getReportByDate).toHaveBeenCalledWith(declarationId, "2026-11-13");
    expect(data.tasksCompletedBetween).toHaveBeenCalledWith("2026-11-09", "2026-11-12");
    expect(data.openTasksDueBetween).toHaveBeenCalledWith("2026-11-14", "2026-11-20");
    expect(result.fields.done).toBe("— Подготовлен пилот по закрытой ссылке");
    expect(result.savedId).toBeNull();
  });

  it("13 ноября ищет ту же запись, 14 ноября — уже отчёт за 20 ноября", async () => {
    await buildCurrentReport("2026-11-13");
    expect(data.getReportByDate).toHaveBeenLastCalledWith(declarationId, "2026-11-13");
    const saturday = await buildCurrentReport("2026-11-14");
    expect(saturday.period.reportDate).toBe("2026-11-20");
    expect(data.getReportByDate).toHaveBeenLastCalledWith(declarationId, "2026-11-20");
    // The next coverage week has not begun: future results must not be loaded.
    expect(data.tasksCompletedBetween).toHaveBeenCalledTimes(1);
    expect(saturday.fields.done).toBe("");
  });

  it("явная дата выбирает другую пятницу независимо от текущего дня", async () => {
    const result = await buildCurrentReport("2026-11-12", "2026-11-20");
    expect(result.period.reportDate).toBe("2026-11-20");
    expect(result.period.cutoffDate).toBe("2026-11-12");
    expect(data.tasksCompletedBetween).not.toHaveBeenCalled();
    await expect(buildCurrentReport("2026-11-12", "2026-11-19")).rejects.toThrow();
  });

  it("для прошлой пятницы не подмешивает результаты следующей недели", async () => {
    const result = await buildCurrentReport("2026-11-12", "2026-11-06");
    expect(result.period.cutoffDate).toBe("2026-11-06");
    expect(data.tasksCompletedBetween).toHaveBeenCalledWith("2026-11-02", "2026-11-06");
  });

  it("сохранённые поля, статус и дата среза не обновляются при открытии в пятницу", async () => {
    const fields = reportFieldsSchema.parse({ focus: "Мой фокус", stateScore: null, declaration: [{ itemId: "pilot", title: declaration.items[0].originalText, status: "partial", progressText: "Пилот доступен по закрытой ссылке", comment: "Публичного выпуска пока нет" }] });
    data.getReportByDate.mockResolvedValue({
      id: "saved", status: "final", fields, content: "сохранённый текст",
      weekNumber: 6, periodStart: "2026-11-07", periodEnd: "2026-11-13",
      reportDate: "2026-11-13", coverageStart: "2026-11-09", coverageEnd: "2026-11-13", cutoffDate: "2026-11-12",
    });
    const result = await buildCurrentReport("2026-11-13");
    expect(result.period.cutoffDate).toBe("2026-11-12");
    expect(result.fields).toEqual(fields);
    expect(result.text).toBe("сохранённый текст");
    expect(result.status).toBe("final");
    expect(result.savedId).toBe("saved");
    expect(data.tasksCompletedBetween).not.toHaveBeenCalled();
    expect(data.openTasksDueBetween).not.toHaveBeenCalled();
  });

  it("отправленный 06.11 остаётся исходным текстом с историческим периодом", async () => {
    data.getReportByDate.mockResolvedValue({
      id: "b62821db-b04b-4905-9f3a-8c9ad9e5d792", status: "sent", fields: {},
      content: "не использовать", originalText: "Точный текст 06.11\n  без переписывания",
      weekNumber: 5, periodStart: "2026-10-31", periodEnd: "2026-11-06",
      reportDate: null, coverageStart: null, coverageEnd: null, cutoffDate: null,
    });
    const result = await buildCurrentReport("2026-11-12", "2026-11-06");
    expect(result.period).toEqual({ weekNumber: 5, periodStart: "2026-10-31", periodEnd: "2026-11-06" });
    expect(result.text).toBe("Точный текст 06.11\n  без переписывания");
    expect(result.status).toBe("sent");
    expect(data.tasksCompletedBetween).not.toHaveBeenCalled();
  });

  it("не наследует текущие итоги декларации, состояние и денежные значения", async () => {
    const result = await buildCurrentReport("2026-11-12");
    expect(result.fields.declaration[0]).toMatchObject({ status: "unconfirmed", progressText: "", comment: "" });
    expect(result.fields.stateScore).toBeNull();
    expect(result.fields.stateWhy).toBe("");
    expect(result.fields.includeFinance).toBe(false);
    expect(result.fields.finance).toEqual({ cycleMonth: "", actualReceipts: "", expectedPayments: "", netProfit: "", revenue: "", avgCheck: "" });
    expect(result.fields.extraBusiness.netProfit).toBe("");
    // A private-link pilot is a confirmed result, never inferred public completion.
    expect(result.fields.done).toContain("закрытой ссылке");
    expect(result.fields.declaration[0].status).not.toBe("done");
  });
});
