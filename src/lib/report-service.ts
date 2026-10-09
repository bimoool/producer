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
  status: string | null;
}> {
  const decl = await getDeclaration();
  const period = reportPeriodFor(day, decl?.cycleStart ?? DEFAULT_CYCLE_START);
  const existing = await getReportByPeriod(period.periodStart);
  if (existing) {
    const text =
      existing.status === "sent"
        ? (existing.originalText ?? "Отчёт отправлен наставнику. Точный текст ещё не импортирован в систему.")
        : (existing.content ?? "");
    return { period, fields: existing.fields as ReportFields, text, savedId: existing.id, status: existing.status };
  }
  const [done, next] = await Promise.all([
    tasksCompletedBetween(period.periodStart, period.periodEnd),
    openTasksDueBetween(addDaysISO(period.periodEnd, 1), addDaysISO(period.periodEnd, 7)),
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
  return { period, fields, text: renderReport(period, fields), savedId: null, status: null };
}
