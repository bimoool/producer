export type DealLike = {
  kind: string; // one_time | monthly
  amount: number;
  status: string; // paid | expected | potential | lost
  personalProfit: number | null;
};

export type FinanceSummary = {
  actual: { revenue: number; personalProfit: number; paidDeals: number; avgCheck: number | null; profitUnknown: number };
  expected: { oneTime: number; monthly: number; count: number };
  potential: { oneTime: number; monthly: number; count: number };
};

/**
 * Факт, ожидаемое и потенциальное считаются раздельно и никогда не складываются.
 * Средний чек = фактическая выручка / число оплаченных сделок (null, если сделок нет).
 */
export function summarizeDeals(deals: DealLike[]): FinanceSummary {
  const paid = deals.filter((d) => d.status === "paid");
  const bucket = (status: string) => {
    const list = deals.filter((d) => d.status === status);
    return {
      oneTime: list.filter((d) => d.kind !== "monthly").reduce((s, d) => s + d.amount, 0),
      monthly: list.filter((d) => d.kind === "monthly").reduce((s, d) => s + d.amount, 0),
      count: list.length,
    };
  };
  const revenue = paid.reduce((s, d) => s + d.amount, 0);
  return {
    actual: {
      revenue,
      personalProfit: paid.reduce((s, d) => s + (d.personalProfit ?? 0), 0),
      profitUnknown: paid.filter((d) => d.personalProfit === null).length,
      paidDeals: paid.length,
      avgCheck: paid.length ? Math.round(revenue / paid.length) : null,
    },
    expected: bucket("expected"),
    potential: bucket("potential"),
  };
}

export function rub(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toLocaleString("ru-RU").replace(/ /g, " ")} ₽`;
}
