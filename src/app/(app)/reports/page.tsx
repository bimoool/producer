import { ownerPage } from "@/lib/authz";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { CopyButton } from "@/components/app/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ReportDatePicker } from "@/components/app/report-date-picker";
import { buildCurrentReport } from "@/lib/report-service";
import { listReports } from "@/lib/data";
import { formatRu } from "@/lib/domain/dates";

export default async function ReportsPage() {
  // Личный кабинет — только владелец (проверка на сервере, не только в proxy).
  await ownerPage();
  const [reports, current] = await Promise.all([listReports(), buildCurrentReport()]);
  return (
    <>
      <PageHeader
        title="Отчёты"
        description="Пятничные отчёты: черновики и история"
        action={
          <Button asChild>
            <Link href="/reports/new">Отчёт за неделю</Link>
          </Button>
        }
      />
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Актуальная неделя · отчёт на {formatRu(current.period.reportDate ?? current.period.periodEnd)}</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted-foreground">{current.status === "sent" ? "Отправлен" : current.status === "final" ? "Готов" : current.savedId ? "Черновик" : "Черновик ещё не сохранён"}</p>
          <Button asChild className="w-fit"><Link href={current.savedId ? `/reports/${current.savedId}` : "/reports/new"}>Открыть актуальный отчёт</Link></Button>
        </CardContent>
      </Card>
      <ReportDatePicker date={current.period.reportDate ?? current.period.periodEnd} />
      {reports.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Отчётов пока нет</EmptyTitle>
            <EmptyDescription>Создай первый — форма уже подготовлена.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-3">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">
                  <Link href={`/reports/${r.id}`} className="hover:underline">
                    Неделя {r.weekNumber} · {formatRu(r.periodStart)}–{formatRu(r.periodEnd)}
                  </Link>
                </CardTitle>
                <div className="flex flex-wrap justify-end gap-1">
                  <Badge variant={r.status === "draft" ? "secondary" : "default"}>
                    {r.status === "sent" ? "Отправлен" : r.status === "final" ? "Готов" : "Черновик"}
                  </Badge>
                  {r.status === "sent" && !r.originalText ? <Badge variant="outline">текст не импортирован</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                {r.reportDate ? <p className="text-sm text-muted-foreground">Отчётная дата: {formatRu(r.reportDate)} · фактический охват: {formatRu(r.coverageStart)}–{formatRu(r.coverageEnd)} · срез: {formatRu(r.cutoffDate)}</p> : null}
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/reports/${r.id}`}>Открыть</Link>
                  </Button>
                  {(r.status === "sent" ? r.originalText : r.content) ? (
                    <CopyButton text={(r.status === "sent" ? r.originalText : r.content) ?? ""} size="sm" label="Скопировать" />
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
