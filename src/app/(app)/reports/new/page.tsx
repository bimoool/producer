import { ownerPage } from "@/lib/authz";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { ReportEditor } from "@/components/app/report-editor";
import { todayISO } from "@/lib/domain/dates";
import { buildCurrentReport } from "@/lib/report-service";

export default async function NewReportPage({ searchParams }: PageProps<"/reports/new">) {
  // Личный кабинет — только владелец (проверка на сервере, не только в proxy).
  await ownerPage();
  const sp = await searchParams;
  const day = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayISO();
  const { period, fields, savedId } = await buildCurrentReport(day);
  if (period.weekNumber < 1) redirect("/reports");
  if (savedId) redirect(`/reports/${savedId}`);

  return (
    <>
      <PageHeader
        title="Новый отчёт"
        description="Известные данные подставлены. Остальное заполни сам — система ничего не выдумывает."
      />
      <ReportEditor period={period} initial={fields} />
    </>
  );
}
