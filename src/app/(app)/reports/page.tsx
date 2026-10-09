import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { CopyButton } from "@/components/app/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { listReports } from "@/lib/data";
import { formatRu } from "@/lib/domain/dates";

export default async function ReportsPage() {
  const reports = await listReports();
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
                <Badge variant={r.status === "final" ? "default" : "secondary"}>
                  {r.status === "final" ? "Готов" : "Черновик"}
                </Badge>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/reports/${r.id}`}>Открыть</Link>
                </Button>
                <CopyButton text={r.content} size="sm" label="Скопировать" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
