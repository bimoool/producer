"use client";

import { MoreHorizontalIcon } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteTask, rescheduleTask, setTaskDone, type ActionResult } from "@/app/actions";
import { ConfirmDelete } from "@/components/app/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRu } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";

export type TaskRowData = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  goalTitle?: string | null;
};

function useRun() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, ok?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else if (ok) toast.success(ok);
    });
  return { pending, run };
}

export function TaskRow({ task, today }: { task: TaskRowData; today: string }) {
  const { pending, run } = useRun();
  const done = task.status === "done";
  const overdue = !done && task.dueDate !== null && task.dueDate < today;
  return (
    <div data-slot="task-row" className={cn("flex items-center gap-3 rounded-lg px-1 py-2", pending && "opacity-50")}>
      <Checkbox
        className="size-5"
        aria-label={done ? "Вернуть в работу" : "Отметить выполненной"}
        checked={done}
        disabled={pending}
        onCheckedChange={(v) => run(() => setTaskDone(task.id, v === true), v === true ? "Готово 🎉" : undefined)}
      />
      <div className="min-w-0 flex-1">
        <Link href={`/tasks/${task.id}`} className={cn("block truncate text-sm", done && "text-muted-foreground line-through")}>
          {task.title}
        </Link>
        <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          {task.dueDate ? <span className={cn(overdue && "font-medium text-destructive")}>{formatRu(task.dueDate)}</span> : null}
          {task.goalTitle ? <span className="truncate">→ {task.goalTitle}</span> : null}
        </div>
      </div>
      {task.status === "blocked" ? <Badge variant="destructive">блок</Badge> : null}
      {task.priority === "high" && !done ? <Badge variant="outline">важно</Badge> : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Действия">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Перенести</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => run(() => rescheduleTask(task.id, "today"), "На сегодня")}>На сегодня</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => run(() => rescheduleTask(task.id, "tomorrow"), "На завтра")}>На завтра</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => run(() => rescheduleTask(task.id, "week"), "Через неделю")}>Через неделю</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => run(() => rescheduleTask(task.id, "none"), "Срок снят")}>Без срока</DropdownMenuItem>
          <DropdownMenuSeparator />
          <ConfirmDelete
            title="Удалить задачу?"
            description="Подзадачи тоже будут удалены. Запись останется в истории."
            onConfirm={() => run(() => deleteTask(task.id), "Удалено")}
            trigger={
              <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
                Удалить
              </DropdownMenuItem>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
