"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { markReportSent, saveReport } from "@/app/actions";
import { ConfirmAction } from "@/components/app/confirm-delete";
import { CopyButton } from "@/components/app/copy-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatRu } from "@/lib/domain/dates";
import { renderReport, type ReportFields, type ReportItemStatus, type ReportPeriod } from "@/lib/domain/report";

const STATUS_OPTIONS: { value: ReportItemStatus; label: string }[] = [
  { value: "unconfirmed", label: "Требует подтверждения" },
  { value: "done", label: "Выполнено" },
  { value: "in_progress", label: "В процессе" },
  { value: "partial", label: "Частично" },
  { value: "not_done", label: "Не выполнено" },
];

function TextField(props: { id: string; label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Textarea
        id={props.id}
        rows={props.rows ?? 2}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}

export function ReportEditor({
  id,
  period,
  initial,
  initialStatus = "draft",
}: {
  id?: string;
  period: ReportPeriod;
  initial: ReportFields;
  initialStatus?: "draft" | "final";
}) {
  const router = useRouter();
  const [f, setF] = useState<ReportFields>(initial);
  const [status, setStatus] = useState(initialStatus);
  const [dirty, setDirty] = useState(!id);
  const [pending, start] = useTransition();
  const text = useMemo(() => renderReport(period, f), [period, f]);

  function set<K extends keyof ReportFields>(key: K, value: ReportFields[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function save(nextStatus: "draft" | "final") {
    start(async () => {
      const res = await saveReport({ id, period, fields: f, status: nextStatus });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setStatus(nextStatus);
      setDirty(false);
      toast.success(nextStatus === "final" ? "Отчёт сохранён как готовый" : "Черновик сохранён");
      if (!id && res.id) router.replace(`/reports/${res.id}`);
      else router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Отчёт за {period.weekNumber} неделю</CardTitle>
          <CardDescription>
            Период: {formatRu(period.periodStart)}–{formatRu(period.periodEnd)} ·{" "}
            {status === "final" ? "готов" : "черновик"}
            {dirty ? " · есть несохранённые изменения" : ""}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>1. Статус по декларации</CardTitle>
          <CardDescription>Если не уверен — оставь «Требует подтверждения».</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {f.declaration.map((d, i) => (
            <div key={d.itemId} className="grid gap-2">
              <div className="text-sm font-medium">
                {i + 1}. {d.title}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <NativeSelect
                  aria-label="Статус"
                  value={d.status}
                  onChange={(e) =>
                    set(
                      "declaration",
                      f.declaration.map((x, j) => (j === i ? { ...x, status: e.target.value as ReportItemStatus } : x)),
                    )
                  }
                >
                  {STATUS_OPTIONS.map((o) => (
                    <NativeSelectOption key={o.value} value={o.value}>
                      {o.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Input
                  aria-label="Прогресс"
                  placeholder="Прогресс, напр. 4 из 15"
                  value={d.progressText}
                  onChange={(e) =>
                    set("declaration", f.declaration.map((x, j) => (j === i ? { ...x, progressText: e.target.value } : x)))
                  }
                />
              </div>
              <Input
                aria-label="Комментарий"
                placeholder="Комментарий (необязательно)"
                value={d.comment}
                onChange={(e) =>
                  set("declaration", f.declaration.map((x, j) => (j === i ? { ...x, comment: e.target.value } : x)))
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Работа за неделю</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <TextField id="focus" label="Фокус" value={f.focus} onChange={(v) => set("focus", v)} />
          <TextField id="done" label="Что сделал" rows={4} value={f.done} onChange={(v) => set("done", v)} />
          <TextField id="stuck" label="Где застрял / что не сработало" value={f.stuck} onChange={(v) => set("stuck", v)} />
          <TextField id="nextPlan" label="План на следующую неделю" rows={3} value={f.nextPlan} onChange={(v) => set("nextPlan", v)} />
          <TextField id="insight" label="Главный инсайт" value={f.insight} onChange={(v) => set("insight", v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Финансы за месяц</CardTitle>
          <CardDescription>Заполняется только в последнем отчёте месяца.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={f.includeFinance} onCheckedChange={(v) => set("includeFinance", v === true)} />
            Это последний отчёт месяца — заполнить финансы
          </label>
          {f.includeFinance ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["cycleMonth", "Месяц цикла"],
                  ["netProfit", "Чистая прибыль"],
                  ["revenue", "Выручка"],
                  ["avgCheck", "Средний чек"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="grid gap-1.5">
                  <Label htmlFor={`fin-${key}`}>{label}</Label>
                  <Input
                    id={`fin-${key}`}
                    value={f.finance[key]}
                    onChange={(e) => set("finance", { ...f.finance, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Дополнительный бизнес</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="eb-name">Название</Label>
            <Input id="eb-name" value={f.extraBusiness.name} onChange={(e) => set("extraBusiness", { ...f.extraBusiness, name: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="eb-profit">Чистая прибыль за месяц</Label>
            <Input id="eb-profit" value={f.extraBusiness.netProfit} onChange={(e) => set("extraBusiness", { ...f.extraBusiness, netProfit: e.target.value })} />
          </div>
          <TextField id="eb-note" label="Заметка / инвестиции в проект" value={f.extraBusiness.note} onChange={(v) => set("extraBusiness", { ...f.extraBusiness, note: v })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5. Состояние</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Оценка от 1 до 10">
            {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
              <Button
                key={n}
                type="button"
                size="sm"
                variant={f.stateScore === n ? "default" : "outline"}
                className="w-9"
                role="radio"
                aria-checked={f.stateScore === n}
                onClick={() => set("stateScore", f.stateScore === n ? null : n)}
              >
                {n}
              </Button>
            ))}
          </div>
          <TextField id="stateWhy" label="Почему" value={f.stateWhy} onChange={(v) => set("stateWhy", v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>6. Обратная связь, вызовы, идеи</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <TextField id="mentorQuestion" label="Вопрос наставнику" value={f.mentorQuestion} onChange={(v) => set("mentorQuestion", v)} />
          <TextField id="helpNeeded" label="С чем нужна помощь" value={f.helpNeeded} onChange={(v) => set("helpNeeded", v)} />
          <TextField id="idea" label="Идея" value={f.idea} onChange={(v) => set("idea", v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Текст отчёта</CardTitle>
          <CardDescription>Так он будет скопирован.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[28rem] overflow-auto rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{text}</pre>
        </CardContent>
      </Card>

      <div className="sticky bottom-16 z-30 flex flex-wrap gap-2 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur md:bottom-4">
        <CopyButton text={text} />
        <Button type="button" variant="outline" disabled={pending} onClick={() => save("draft")}>
          Сохранить черновик
        </Button>
        <Button type="button" disabled={pending} onClick={() => save("final")}>
          Отчёт готов
        </Button>
        {id && !dirty ? (
          <ConfirmAction
            title="Отметить отправленным?"
            description="Текст будет заморожен ровно в текущем виде — как вы его скопировали. Изменить отчёт потом будет нельзя."
            confirmLabel="Отправлен"
            onConfirm={() =>
              start(async () => {
                const r = await markReportSent(id);
                if (r.ok) {
                  toast.success("Отчёт отмечен отправленным");
                  router.refresh();
                } else toast.error(r.error);
              })
            }
            trigger={
              <Button type="button" variant="ghost" disabled={pending}>
                Отправлен наставнику
              </Button>
            }
          />
        ) : null}
      </div>
    </div>
  );
}
