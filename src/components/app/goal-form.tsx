"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteGoal, saveGoal } from "@/app/actions";
import { ConfirmDelete } from "@/components/app/confirm-delete";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { GOAL_STATUS } from "@/lib/domain/labels";
import type { Option } from "./task-form";
import { useFormAction } from "./use-action";

export type GoalValues = {
  id?: string;
  title?: string;
  description?: string | null;
  category?: string | null;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
  deadline?: string | null;
  status?: string;
  projectId?: string | null;
};

export function GoalDialog({ trigger, values = {}, projects }: { trigger: React.ReactNode; values?: GoalValues; projects: Option[] }) {
  const [open, setOpen] = useState(false);
  const { formAction, pending } = useFormAction(saveGoal, {
    success: values.id ? "Цель сохранена" : "Цель добавлена",
    onSuccess: () => setOpen(false),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{values.id ? "Редактировать цель" : "Новая цель"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
          <div className="grid gap-1.5">
            <Label htmlFor="g-title">Цель</Label>
            <Input id="g-title" name="title" required defaultValue={values.title ?? ""} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="g-desc">Описание</Label>
            <Textarea id="g-desc" name="description" rows={2} defaultValue={values.description ?? ""} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="g-cur">Сейчас</Label>
              <Input id="g-cur" name="currentValue" inputMode="decimal" placeholder="—" defaultValue={values.currentValue ?? ""} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="g-target">Цель</Label>
              <Input id="g-target" name="targetValue" inputMode="decimal" placeholder="—" defaultValue={values.targetValue ?? ""} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="g-unit">Ед.</Label>
              <Input id="g-unit" name="unit" defaultValue={values.unit ?? ""} />
            </div>
          </div>
          <p className="-mt-1 text-xs text-muted-foreground">Оставь пустым, если прогресс неизвестен — это не то же самое, что ноль.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="g-deadline">Срок</Label>
              <Input id="g-deadline" name="deadline" type="date" defaultValue={values.deadline ?? ""} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="g-status">Статус</Label>
              <NativeSelect id="g-status" name="status" defaultValue={values.status ?? "active"}>
                {Object.entries(GOAL_STATUS).map(([k, v]) => (
                  <NativeSelectOption key={k} value={k}>
                    {v}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="g-cat">Категория</Label>
              <Input id="g-cat" name="category" defaultValue={values.category ?? ""} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="g-project">Проект</Label>
              <NativeSelect id="g-project" name="projectId" defaultValue={values.projectId ?? "none"}>
                <NativeSelectOption value="none">—</NativeSelectOption>
                {projects.map((p) => (
                  <NativeSelectOption key={p.id} value={p.id}>
                    {p.title}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
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

export function DeleteGoalButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <ConfirmDelete
      title="Удалить цель?"
      description="Связанные задачи останутся, но потеряют связь с целью."
      onConfirm={() =>
        start(async () => {
          const r = await deleteGoal(id);
          if (r.ok) toast.success("Цель удалена");
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
