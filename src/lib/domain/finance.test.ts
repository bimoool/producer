import { describe, expect, it } from "vitest";
import { rub, summarizeDeals } from "./finance";

const deals = [
  { kind: "one_time", amount: 124050, status: "paid", personalProfit: 50000 },
  { kind: "one_time", amount: 500000, status: "potential", personalProfit: null },
  { kind: "one_time", amount: 100000, status: "potential", personalProfit: null },
  { kind: "monthly", amount: 50000, status: "potential", personalProfit: null },
  { kind: "one_time", amount: 20000, status: "potential", personalProfit: null },
];

describe("summarizeDeals", () => {
  it("реальные данные 09.10.2026: факт отдельно от потенциала", () => {
    const s = summarizeDeals(deals);
    expect(s.actual).toEqual({ revenue: 124050, personalProfit: 50000, paidDeals: 1, avgCheck: 124050, profitUnknown: 0 });
    expect(s.potential).toEqual({ oneTime: 620000, monthly: 50000, count: 4 });
    expect(s.expected).toEqual({ oneTime: 0, monthly: 0, count: 0 });
  });
  it("нет оплаченных сделок — среднего чека нет (без деления на ноль)", () => {
    expect(summarizeDeals([]).actual.avgCheck).toBeNull();
  });
  it("отказ не попадает никуда", () => {
    const s = summarizeDeals([{ kind: "one_time", amount: 1, status: "lost", personalProfit: null }]);
    expect(s.actual.revenue + s.potential.oneTime + s.expected.oneTime).toBe(0);
  });
  it("формат рублей", () => {
    expect(rub(124050)).toBe("124 050 ₽");
    expect(rub(null)).toBe("—");
  });
});
