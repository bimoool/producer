"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { addComment, deleteTaskAndGoHome } from "@/app/actions";
import { ConfirmDelete } from "@/components/app/confirm-delete";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "./use-action";

export function CommentForm({ taskId }: { taskId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const { formAction, pending } = useFormAction(addComment, { onSuccess: () => ref.current?.reset() });
  return (
    <form ref={ref} action={formAction} className="grid gap-2">
      <input type="hidden" name="taskId" value={taskId} />
      <Textarea name="body" rows={2} placeholder="Заметка, мысль, результат…" required />
      <Button type="submit" size="sm" variant="secondary" disabled={pending} className="justify-self-start">
        Добавить
      </Button>
    </form>
  );
}

export function TaskDangerZone({ id, parentId }: { id: string; parentId: string | null }) {
  const [pending, start] = useTransition();
  return (
    <ConfirmDelete
      title="Удалить задачу?"
      description="Подзадачи тоже будут удалены. Запись об удалении останется в истории."
      onConfirm={() =>
        start(async () => {
          const r = await deleteTaskAndGoHome(id, parentId);
          if (r && !r.ok) toast.error(r.error);
        })
      }
      trigger={
        <Button variant="ghost" className="justify-self-start text-destructive" disabled={pending}>
          Удалить задачу
        </Button>
      }
    />
  );
}
