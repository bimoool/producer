import { notFound } from "next/navigation";
import { ReportEditor } from "@/components/app/report-editor";
import { SentReport, type ReportFacts } from "@/components/app/sent-report";
import { getReport } from "@/lib/data";
import { reportFieldsSchema } from "@/lib/domain/report";

export default async function ReportPage({ params }: PageProps<"/reports/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const report = await getReport(id);
  if (!report) notFound();
  if (report.status === "sent") {
    return <SentReport report={{ ...report, facts: report.facts as ReportFacts | null }} />;
  }
  const fields = reportFieldsSchema.parse(report.fields);
  return (
    <ReportEditor
      key={report.updatedAt.toISOString()}
      id={report.id}
      period={{ weekNumber: report.weekNumber, periodStart: report.periodStart, periodEnd: report.periodEnd }}
      initial={fields}
      initialStatus={report.status === "final" ? "final" : "draft"}
    />
  );
}
