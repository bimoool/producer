import { getDeclaration, getReportByDate, openTasksDueBetween, tasksCompletedBetween, type WeeklyReport } from "@/lib/data";
import { addDaysISO, todayISO } from "@/lib/domain/dates";
import { prefillReport, renderReport, reportFieldsSchema, reportPeriodFor, type ReportFields, type ReportPeriod } from "@/lib/domain/report";

export const DEFAULT_CYCLE_START = "2026-10-02";

/** Stored dates are authoritative: reopening never moves a saved cutoff. */
export function storedReportPeriod(row: WeeklyReport): ReportPeriod {
  return {
    weekNumber: row.weekNumber, periodStart: row.periodStart, periodEnd: row.periodEnd,
    ...(row.reportDate ? { reportDate: row.reportDate } : {}),
    ...(row.coverageStart ? { coverageStart: row.coverageStart } : {}),
    ...(row.coverageEnd ? { coverageEnd: row.coverageEnd } : {}),
    ...(row.cutoffDate ? { cutoffDate: row.cutoffDate } : {}),
  };
}

/** Prepare a report without writes or external deliveries. Actuals stop at cutoff. */
export async function buildCurrentReport(day = todayISO(), selectedReportDate?: string): Promise<{
  period: ReportPeriod; fields: ReportFields; text: string; savedId: string | null; status: string | null;
}> {
  const decl = await getDeclaration();
  const period = reportPeriodFor(day, decl?.cycleStart ?? DEFAULT_CYCLE_START, selectedReportDate);
  const existing = decl ? await getReportByDate(decl.id, period.reportDate!) : null;
  if (existing) {
    const text = existing.status === "sent"
      ? (existing.originalText ?? "Отчёт отправлен наставнику. Точный текст ещё не импортирован в систему.")
      : (existing.content ?? "");
    return { period: storedReportPeriod(existing), fields: reportFieldsSchema.parse(existing.fields), text, savedId: existing.id, status: existing.status };
  }
  const from = period.coverageStart!;
  const cutoff = period.cutoffDate!;
  const [done, next] = await Promise.all([
    cutoff >= from ? tasksCompletedBetween(from, cutoff) : Promise.resolve([]),
    openTasksDueBetween(addDaysISO(period.periodEnd, 1), addDaysISO(period.periodEnd, 7)),
  ]);
  const fields = prefillReport({
    // Current item totals have no historical snapshot. Do not claim that they
    // were achieved in this week or by an earlier cutoff; the owner confirms.
    items: (decl?.items ?? []).map((i) => ({
      id: i.id, originalText: i.originalText, status: null, currentValue: null,
      targetValue: i.targetValue, unit: i.unit,
    })),
    completedTaskTitles: done.map((t) => t.title),
    nextWeekTaskTitles: next.map((t) => t.title),
    periodEnd: period.periodEnd,
  });
  return { period, fields, text: renderReport(period, fields), savedId: null, status: null };
}
