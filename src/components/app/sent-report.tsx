"use client";

import { LockIcon, TriangleAlertIcon } from "lucide-react";
import { importReportText } from "@/app/actions";
import { CopyButton } from "@/components/app/copy-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatRu } from "@/lib/domain/dates";
import { useFormAction } from "./use-action";

export type ReportFacts = {
  source?: string;
  declaration?: { position: number; status: string; progress?: string; note?: string }[];
  results?: string[];
  notDone?: string[];
  insight?: string;
  extraBusiness?: { name: string; personalIncome: number | null }[];
  state?: { score: number | null; why?: string };
  requestToTen?: string;
};

const ITEM_STATUS: Record<string, string> = {
  done: "выполнено",
  in_progress: "в процессе",
  partial: "частично",
  not_done: "не выполнено",
};

function ImportForm({ reportId }: { reportId: string }) {
  const { formAction, pending } = useFormAction(importReportText, { success: "Текст сохранён без изменений" });
  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="reportId" value={reportId} />
      <Textarea
        name="originalText"
        rows={10}
        required
        placeholder="Вставьте сюда точный текст, который был отправлен наставнику"
        className="font-mono text-sm"
      />
      <p className="text-xs text-muted-foreground">
        Текст сохранится как есть — система его не переписывает. Изменить его после сохранения нельзя.
      </p>
      <Button type="submit" disabled={pending} className="justify-self-start">
        Сохранить оригинал
      </Button>
    </form>
  );
}

export function SentReport({
  report,
}: {
  report: {
    id: string;
    weekNumber: number;
    periodStart: string;
    periodEnd: string;
    sentOn: string | null;
    originalText: string | null;
    facts: ReportFacts | null;
  };
}) {
  const f = report.facts;
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Отчёт за {report.weekNumber} неделю</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-1.5">
            <LockIcon className="size-3.5" />
            Отправлен{report.sentOn ? ` ${formatRu(report.sentOn)}` : ""} · период {formatRu(report.periodStart)}–
            {formatRu(report.periodEnd)} · не изменяется
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Отправленный текст</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {report.originalText ? (
            <>
              <pre className="max-h-[32rem] overflow-auto rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{report.originalText}</pre>
              <CopyButton text={report.originalText} />
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                Точный текст отправленного отчёта ещё нужно импортировать. Ниже — только подтверждённые факты, это не текст отчёта.
              </div>
              <ImportForm reportId={report.id} />
            </>
          )}
        </CardContent>
      </Card>

      {f ? (
        <Card>
          <CardHeader>
            <CardTitle>Подтверждённые факты</CardTitle>
            {f.source ? <CardDescription>{f.source}</CardDescription> : null}
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            {f.declaration?.length ? (
              <div>
                <div className="mb-1 font-medium">Декларация</div>
                <ul className="grid gap-0.5">
                  {f.declaration.map((d) => (
                    <li key={d.position}>
                      {d.position}) {ITEM_STATUS[d.status] ?? d.status}
                      {d.progress ? ` — ${d.progress}` : ""}
                      {d.note ? <span className="text-muted-foreground"> · {d.note}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {f.results?.length ? (
              <div>
                <div className="mb-1 font-medium">Сделано</div>
                <ul className="grid list-disc gap-0.5 pl-5">
                  {f.results.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {f.notDone?.length ? (
              <div>
                <div className="mb-1 font-medium">Не сделано</div>
                <ul className="grid list-disc gap-0.5 pl-5">
                  {f.notDone.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {f.insight ? (
              <div>
                <div className="font-medium">Главный инсайт</div>
                <p>{f.insight}</p>
              </div>
            ) : null}
            {f.extraBusiness?.length ? (
              <div>
                <div className="mb-1 font-medium">Дополнительный бизнес</div>
                {f.extraBusiness.map((b) => (
                  <div key={b.name}>
                    {b.name}: личный доход {b.personalIncome === null ? "—" : `${b.personalIncome} ₽`}
                  </div>
                ))}
              </div>
            ) : null}
            {f.state ? (
              <div>
                <div className="font-medium">Состояние: {f.state.score ?? "—"}/10</div>
                {f.state.why ? <p className="text-muted-foreground">{f.state.why}</p> : null}
              </div>
            ) : null}
            {f.requestToTen ? (
              <div>
                <div className="font-medium">Запрос к предпринимательской десятке</div>
                <p>{f.requestToTen}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
