"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveTask } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { TASK_PRIORITY, TASK_STATUS } from "@/lib/domain/labels";
import { useFormAction } from "./use-action";

export type Option = { id: string; title: string };
export type TaskFormValues = {
  id?: string;
  title?: string;
  description?: string | null;
  goalId?: string | null;
  declarationItemId?: string | null;
  projectId?: string | null;
  parentTaskId?: string | null;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  result?: string | null;
};

export function TaskFormFields({
  values,
  goals,
  items,
  projects,
}: {
  values: TaskFormValues;
  goals: Option[];
  items: Option[];
  projects: Option[];
}) {
  return (
    <div className="grid gap-3">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      {values.parentTaskId ? <input type="hidden" name="parentTaskId" value={values.parentTaskId} /> : null}
      <div className="grid gap-1.5">
        <Label htmlFor="t-title">Что сделать</Label>
        <Input id="t-title" name="title" required defaultValue={values.title ?? ""} autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="t-due">Срок</Label>
          <Input id="t-due" name="dueDate" type="date" defaultValue={values.dueDate ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="t-priority">Приоритет</Label>
          <NativeSelect id="t-priority" name="priority" defaultValue={values.priority ?? "normal"}>
            {Object.entries(TASK_PRIORITY).map(([k, v]) => (
              <NativeSelectOption key={k} value={k}>
                {v}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="t-goal">Зачем: цель (необязательно)</Label>
        <NativeSelect id="t-goal" name="goalId" defaultValue={values.goalId ?? "none"}>
          <NativeSelectOption value="none">— без цели —</NativeSelectOption>
          {goals.map((g) => (
            <NativeSelectOption key={g.id} value={g.id}>
              {g.title}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="t-item">Обязательство декларации (необязательно)</Label>
        <NativeSelect id="t-item" name="declarationItemId" defaultValue={values.declarationItemId ?? "none"}>
          <NativeSelectOption value="none">— не связано —</NativeSelectOption>
          {items.map((g) => (
            <NativeSelectOption key={g.id} value={g.id}>
              {g.title}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {projects.length ? (
        <div className="grid gap-1.5">
          <Label htmlFor="t-project">Проект</Label>
          <NativeSelect id="t-project" name="projectId" defaultValue={values.projectId ?? "none"}>
            <NativeSelectOption value="none">— без проекта —</NativeSelectOption>
            {projects.map((g) => (
              <NativeSelectOption key={g.id} value={g.id}>
                {g.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ) : null}
      {values.id ? (
        <div className="grid gap-1.5">
          <Label htmlFor="t-status">Статус</Label>
          <NativeSelect id="t-status" name="status" defaultValue={values.status ?? "todo"}>
            {Object.entries(TASK_STATUS).map(([k, v]) => (
              <NativeSelectOption key={k} value={k}>
                {v}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor="t-desc">Описание</Label>
        <Textarea id="t-desc" name="description" rows={2} defaultValue={values.description ?? ""} />
      </div>
      {values.id ? (
        <div className="grid gap-1.5">
          <Label htmlFor="t-result">Результат</Label>
          <Textarea id="t-result" name="result" rows={2} defaultValue={values.result ?? ""} placeholder="Что получилось?" />
        </div>
      ) : null}
    </div>
  );
}

export function TaskDialog({
  trigger,
  values = {},
  goals,
  items,
  projects,
  title,
  openAfterCreate = false,
}: {
  trigger: React.ReactNode;
  values?: TaskFormValues;
  goals: Option[];
  items: Option[];
  projects: Option[];
  title: string;
  openAfterCreate?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { formAction, pending } = useFormAction(saveTask, {
    success: values.id ? "Сохранено" : "Задача создана",
    onSuccess: (r) => {
      setOpen(false);
      if (openAfterCreate && r.ok && r.id && !values.id) router.push(`/tasks/${r.id}`);
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <TaskFormFields values={values} goals={goals} items={items} projects={projects} />
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
