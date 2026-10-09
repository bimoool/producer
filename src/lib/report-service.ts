import { getDeclaration, getReportByPeriod, openTasksDueBetween, tasksCompletedBetween } from "@/lib/data";
import { addDaysISO, todayISO } from "@/lib/domain/dates";
import { prefillReport, renderReport, reportPeriodFor, type ReportFields, type ReportPeriod } from "@/lib/domain/report";

export const DEFAULT_CYCLE_START = "2026-10-02";

/** Текущий отчёт: сохранённый черновик или автоматически подготовленная форма. */
export async function buildCurrentReport(day = todayISO()): Promise<{
  period: ReportPeriod;
  fields: ReportFields;
  text: string;
  savedId: string | null;
}> {
  const decl = await getDeclaration();
  const period = reportPeriodFor(day, decl?.cycleStart ?? DEFAULT_CYCLE_START);
  const existing = await getReportByPeriod(period.periodStart);
  if (existing) {
    return { period, fields: existing.fields as ReportFields, text: existing.content, savedId: existing.id };
  }
  const reportDay = addDaysISO(period.periodEnd, 1);
  const [done, next] = await Promise.all([
    tasksCompletedBetween(period.periodStart, period.periodEnd),
    openTasksDueBetween(reportDay, addDaysISO(reportDay, 7)),
  ]);
  const fields = prefillReport({
    items: (decl?.items ?? []).map((i) => ({
      id: i.id,
      originalText: i.originalText,
      status: i.status,
      currentValue: i.currentValue,
      targetValue: i.targetValue,
      unit: i.unit,
    })),
    completedTaskTitles: done.map((t) => t.title),
    nextWeekTaskTitles: next.map((t) => t.title),
    periodEnd: period.periodEnd,
  });
  return { period, fields, text: renderReport(period, fields), savedId: null };
}
