import { ownerPage } from "@/lib/authz";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { ReportEditor } from "@/components/app/report-editor";
import { ReportDatePicker } from "@/components/app/report-date-picker";
import { reportDateSchema, reportPeriodFor } from "@/lib/domain/report";
import { todayISO } from "@/lib/domain/dates";
import { buildCurrentReport } from "@/lib/report-service";

export default async function NewReportPage({ searchParams }: PageProps<"/reports/new">) {
  // Личный кабинет — только владелец (проверка на сервере, не только в proxy).
  await ownerPage();
  const sp = await searchParams;
  const selected = sp.date === undefined ? null : reportDateSchema.safeParse(sp.date);
  if (selected && !selected.success) {
    return (
      <>
        <PageHeader title="Выбрать отчёт" description="Укажите существующую календарную дату, которая приходится на пятницу." />
        <ReportDatePicker date={reportPeriodFor(todayISO(), "2026-10-02").periodEnd} error="Отчётная дата должна быть пятницей." />
      </>
    );
  }
  const { period, fields, savedId } = await buildCurrentReport(todayISO(), selected?.success ? selected.data : undefined);
  if (period.weekNumber < 1) redirect("/reports");
  if (savedId) redirect(`/reports/${savedId}`);

  return (
    <>
      <PageHeader
        title="Новый отчёт"
        description="Известные данные подставлены. Остальное заполни сам — система ничего не выдумывает."
      />
      <ReportDatePicker date={period.reportDate ?? period.periodEnd} />
      <ReportEditor period={period} initial={fields} />
    </>
  );
}
