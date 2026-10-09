"use client";

import { LockIcon } from "lucide-react";
import { updateDeclarationProgress, updateDeclarationStatus } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { formatInTimeZone } from "@/lib/domain/format";
import { DECLARATION_STATUS } from "@/lib/domain/labels";
import { computeProgress } from "@/lib/domain/progress";
import { useFormAction } from "./use-action";

export type ItemData = {
  id: string;
  position: number;
  originalText: string;
  completionCriteria: string;
  targetValue: number;
  unit: string;
  status: string | null;
  currentValue: number | null;
  history: { id: string; value: number; previousValue: number | null; note: string | null; createdAt: Date }[];
};

export function DeclarationItemCard({ item }: { item: ItemData }) {
  const p = computeProgress(item.currentValue, item.targetValue);
  const progress = useFormAction(updateDeclarationProgress, { success: "Прогресс сохранён" });
  const status = useFormAction(updateDeclarationStatus, { success: "Статус сохранён" });
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <LockIcon className="size-3.5" /> Обязательство {item.position} · текст зафиксирован
        </CardDescription>
        <CardTitle className="text-base leading-snug">{item.originalText}</CardTitle>
        <CardDescription>Критерий: {item.completionCriteria}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div>
          {p.confirmed ? (
            <>
              <div className="text-3xl font-semibold tabular-nums">
                {p.current} <span className="text-lg text-muted-foreground">/ {p.target} {item.unit}</span>
              </div>
              <Progress value={p.percent} className="mt-2" />
              <div className="mt-1 text-sm text-muted-foreground">{p.percent}%</div>
            </>
          ) : (
            <div className="text-lg font-medium text-muted-foreground">Прогресс не подтверждён</div>
          )}
        </div>

        <form action={progress.formAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="itemId" value={item.id} />
          <Input
            name="value"
            inputMode="decimal"
            required
            aria-label={`Сколько сделано (${item.unit})`}
            placeholder={`Сделано, ${item.unit}`}
            className="w-36"
          />
          <Input name="note" placeholder="Комментарий" className="min-w-0 flex-1" />
          <Button type="submit" disabled={progress.pending}>
            Подтвердить
          </Button>
        </form>

        <form key={item.status ?? "none"} action={status.formAction} className="flex items-center gap-2">
          <input type="hidden" name="itemId" value={item.id} />
          <NativeSelect name="status" defaultValue={item.status ?? "none"} aria-label="Статус">
            <NativeSelectOption value="none">Требует подтверждения</NativeSelectOption>
            {Object.entries(DECLARATION_STATUS).map(([k, v]) => (
              <NativeSelectOption key={k} value={k}>
                {v[0].toUpperCase() + v.slice(1)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button type="submit" variant="outline" disabled={status.pending}>
            Сохранить статус
          </Button>
        </form>

        {item.history.length ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">История прогресса ({item.history.length})</summary>
            <ul className="mt-2 grid gap-1">
              {item.history.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span className="text-muted-foreground tabular-nums">{formatInTimeZone(h.createdAt)}</span>
                  <span>
                    {h.previousValue ?? "не подтверждено"} → {h.value}
                    {h.note ? ` · ${h.note}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
