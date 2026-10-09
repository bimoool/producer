import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { ReportEditor } from "@/components/app/report-editor";
import { getDeclaration, getReportByPeriod, openTasksDueBetween, tasksCompletedBetween } from "@/lib/data";
import { addDaysISO, todayISO } from "@/lib/domain/dates";
import { prefillReport, reportPeriodFor } from "@/lib/domain/report";

export default async function NewReportPage({ searchParams }: PageProps<"/reports/new">) {
  const sp = await searchParams;
  const day = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayISO();
  const decl = await getDeclaration();
  const cycleStart = decl?.cycleStart ?? "2026-10-02";
  const period = reportPeriodFor(day, cycleStart);
  if (period.weekNumber < 1) redirect("/reports");

  const existing = await getReportByPeriod(period.periodStart);
  if (existing) redirect(`/reports/${existing.id}`);

  const reportDay = addDaysISO(period.periodEnd, 1);
  const [done, next] = await Promise.all([
    tasksCompletedBetween(period.periodStart, period.periodEnd),
    openTasksDueBetween(reportDay, addDaysISO(reportDay, 7)),
  ]);
  const initial = prefillReport({
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

  return (
    <>
      <PageHeader
        title="Новый отчёт"
        description="Известные данные подставлены. Остальное заполни сам — система ничего не выдумывает."
      />
      <ReportEditor period={period} initial={initial} />
    </>
  );
}
