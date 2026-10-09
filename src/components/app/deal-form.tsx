"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteDeal, saveDeal } from "@/app/actions";
import { ConfirmDelete } from "@/components/app/confirm-delete";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "./use-action";

export const DEAL_STATUS = {
  paid: "Оплачено (факт)",
  expected: "Ожидаем оплату",
  potential: "Предложение / потенциал",
  lost: "Отказ",
} as const;

export type DealValues = {
  id?: string;
  client?: string;
  title?: string;
  kind?: string;
  amount?: number;
  status?: string;
  personalProfit?: number | null;
  expectedBy?: string | null;
  paidOn?: string | null;
  note?: string | null;
};

export function DealDialog({ trigger, values = {} }: { trigger: React.ReactNode; values?: DealValues }) {
  const [open, setOpen] = useState(false);
  const { formAction, pending } = useFormAction(saveDeal, { success: "Сохранено", onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{values.id ? "Сделка" : "Новая сделка"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
          <div className="grid gap-1.5">
            <Label htmlFor="d-client">Клиент</Label>
            <Input id="d-client" name="client" required defaultValue={values.client ?? ""} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="d-title">Услуга</Label>
            <Input id="d-title" name="title" required defaultValue={values.title ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="d-amount">Сумма, ₽</Label>
              <Input id="d-amount" name="amount" inputMode="numeric" required defaultValue={values.amount ?? ""} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="d-kind">Тип</Label>
              <NativeSelect id="d-kind" name="kind" defaultValue={values.kind ?? "one_time"}>
                <NativeSelectOption value="one_time">Разовая</NativeSelectOption>
                <NativeSelectOption value="monthly">В месяц</NativeSelectOption>
              </NativeSelect>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="d-status">Статус</Label>
            <NativeSelect id="d-status" name="status" defaultValue={values.status ?? "potential"}>
              {Object.entries(DEAL_STATUS).map(([k, v]) => (
                <NativeSelectOption key={k} value={k}>
                  {v}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="d-profit">Личная прибыль, ₽</Label>
              <Input id="d-profit" name="personalProfit" inputMode="numeric" placeholder="—" defaultValue={values.personalProfit ?? ""} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="d-paid">Дата оплаты</Label>
              <Input id="d-paid" name="paidOn" type="date" defaultValue={values.paidOn ?? ""} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="d-expected">Когда ждать ответ / оплату</Label>
            <Input id="d-expected" name="expectedBy" placeholder="например: октябрь" defaultValue={values.expectedBy ?? ""} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="d-note">Заметка</Label>
            <Textarea id="d-note" name="note" rows={2} defaultValue={values.note ?? ""} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Сохранить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteDealButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <ConfirmDelete
      title="Удалить сделку?"
      onConfirm={() =>
        start(async () => {
          const r = await deleteDeal(id);
          if (r.ok) toast.success("Удалено");
          else toast.error(r.error);
        })
      }
      trigger={
        <Button size="sm" variant="ghost" className="text-destructive" disabled={pending}>
          Удалить
        </Button>
      }
    />
  );
}
