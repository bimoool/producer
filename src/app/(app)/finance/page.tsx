import { ownerPage } from "@/lib/authz";
import { PlusIcon } from "lucide-react";
import { DEAL_STATUS, DealDialog, DeleteDealButton } from "@/components/app/deal-form";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listDeals, type Deal } from "@/lib/data";
import { formatRu } from "@/lib/domain/dates";
import { rub, summarizeDeals } from "@/lib/domain/finance";

function DealRow({ d }: { d: Deal }) {
  return (
    <div className="grid gap-1 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium">{d.client}</div>
          <div className="text-sm text-muted-foreground">{d.title}</div>
        </div>
        <div className="text-right text-sm font-semibold tabular-nums whitespace-nowrap">
          {rub(d.amount)}
          {d.kind === "monthly" ? <span className="font-normal text-muted-foreground">/мес</span> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Badge variant={d.status === "paid" ? "default" : "secondary"}>{DEAL_STATUS[d.status as keyof typeof DEAL_STATUS]}</Badge>
        {d.personalProfit !== null ? <span>личная прибыль {rub(d.personalProfit)}</span> : null}
        {d.paidOn ? <span>оплачено {formatRu(d.paidOn)}</span> : null}
        {d.expectedBy ? <span>ждём: {d.expectedBy}</span> : null}
      </div>
      {d.note ? <p className="text-xs text-muted-foreground">{d.note}</p> : null}
      <div className="flex gap-1">
        <DealDialog values={d} trigger={<Button size="sm" variant="ghost">Изменить</Button>} />
        <DeleteDealButton id={d.id} />
      </div>
    </div>
  );
}

export default async function FinancePage() {
  // Личный кабинет — только владелец (проверка на сервере, не только в proxy).
  await ownerPage();
  const deals = await listDeals();
  const s = summarizeDeals(deals);
  const groups = [
    { key: "paid", title: "Факт: оплачено", items: deals.filter((d) => d.status === "paid") },
    { key: "expected", title: "Ожидаем оплату", items: deals.filter((d) => d.status === "expected") },
    { key: "potential", title: "Потенциальные сделки", items: deals.filter((d) => d.status === "potential") },
    { key: "lost", title: "Отказы", items: deals.filter((d) => d.status === "lost") },
  ].filter((g) => g.items.length);

  return (
    <>
      <PageHeader
        title="Финансы"
        description="Факт и потенциал считаются отдельно и не складываются."
        action={
          <DealDialog
            trigger={
              <Button>
                <PlusIcon /> Сделка
              </Button>
            }
          />
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Факт · выручка</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{rub(s.actual.revenue)}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm text-muted-foreground">
            <div>
              Личная прибыль: <span className="text-foreground">{rub(s.actual.personalProfit)}</span>
              {s.actual.profitUnknown ? ` (не указана в ${s.actual.profitUnknown})` : ""}
            </div>
            <div>
              Средний чек: <span className="text-foreground">{s.actual.avgCheck === null ? "—" : rub(s.actual.avgCheck)}</span> · оплаченных
              сделок: {s.actual.paidDeals}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Потенциал · не деньги, пока не оплачено</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{rub(s.potential.oneTime)}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm text-muted-foreground">
            <div>разовые сделки, предложений: {s.potential.count}</div>
            <div>
              Ежемесячные: <span className="text-foreground">{rub(s.potential.monthly)}/мес</span>
            </div>
            {s.expected.count ? (
              <div>
                Ожидаем оплату: {rub(s.expected.oneTime)}
                {s.expected.monthly ? ` + ${rub(s.expected.monthly)}/мес` : ""}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
      <div className="mt-4 grid gap-4">
        {groups.map((g) => (
          <Card key={g.key}>
            <CardHeader>
              <CardTitle className="text-base">{g.title}</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {g.items.map((d) => (
                <DealRow key={d.id} d={d} />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
