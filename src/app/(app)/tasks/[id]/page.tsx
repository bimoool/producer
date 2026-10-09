import { ownerPage } from "@/lib/authz";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon, PlusIcon } from "lucide-react";
import { HistoryList } from "@/components/app/history";
import { TaskDialog } from "@/components/app/task-form";
import { TaskRow } from "@/components/app/task-row";
import { CommentForm, TaskDangerZone } from "@/components/app/task-extras";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLinkOptions, getTask } from "@/lib/data";
import { formatRu, todayISO } from "@/lib/domain/dates";
import { formatInTimeZone } from "@/lib/domain/format";
import { TASK_PRIORITY, TASK_STATUS, type TaskPriority, type TaskStatus } from "@/lib/domain/labels";
import { computeProgress, formatProgress } from "@/lib/domain/progress";

export default async function TaskPage({ params }: PageProps<"/tasks/[id]">) {
  // Личный кабинет — только владелец (проверка на сервере, не только в proxy).
  await ownerPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, opts] = await Promise.all([getTask(id), getLinkOptions()]);
  if (!data) notFound();
  const { task, subtasks, comments, history, goal, item, parent } = data;
  const today = todayISO();
  const hasWhy = goal || item;

  return (
    <div className="grid gap-4">
      <Link
        href={parent ? `/tasks/${parent.id}` : "/tasks"}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" /> {parent ? parent.title : "Задачи"}
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant={task.status === "done" ? "default" : "secondary"}>{TASK_STATUS[task.status as TaskStatus]}</Badge>
            <Badge variant="outline">{TASK_PRIORITY[task.priority as TaskPriority]}</Badge>
            {task.dueDate ? <Badge variant="outline">Срок: {formatRu(task.dueDate)}</Badge> : null}
          </div>
        </div>
        <TaskDialog
          title="Редактировать задачу"
          {...opts}
          values={task}
          trigger={<Button variant="outline">Изменить</Button>}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Зачем я это делаю?</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {item ? (
            <div>
              <div className="text-muted-foreground">Обязательство декларации</div>
              <div className="font-medium">{item.originalText}</div>
              <div className="text-muted-foreground">
                {formatProgress(computeProgress(item.currentValue, item.targetValue), item.unit)}
              </div>
            </div>
          ) : null}
          {goal ? (
            <div>
              <div className="text-muted-foreground">Цель</div>
              <div className="font-medium">{goal.title}</div>
              {goal.description ? <div className="text-muted-foreground">{goal.description}</div> : null}
            </div>
          ) : null}
          {!hasWhy ? (
            <p className="text-muted-foreground">
              Простая задача без связи с целью — это нормально. Связать можно через «Изменить».
            </p>
          ) : null}
          {task.description ? <p className="whitespace-pre-wrap">{task.description}</p> : null}
          {task.result ? (
            <div>
              <div className="text-muted-foreground">Результат</div>
              <p className="whitespace-pre-wrap">{task.result}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Подзадачи</CardTitle>
          <TaskDialog
            title="Новая подзадача"
            {...opts}
            values={{ parentTaskId: task.id, goalId: task.goalId, declarationItemId: task.declarationItemId, projectId: task.projectId }}
            trigger={
              <Button size="sm" variant="outline">
                <PlusIcon /> Подзадача
              </Button>
            }
          />
        </CardHeader>
        <CardContent className="divide-y">
          {subtasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Разбей задачу на маленькие шаги.</p>
          ) : (
            subtasks.map((s) => <TaskRow key={s.id} task={s} today={today} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Комментарии</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <CommentForm taskId={task.id} />
          {comments.map((c) => (
            <div key={c.id} className="text-sm">
              <div className="text-xs text-muted-foreground">{formatInTimeZone(c.createdAt)}</div>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>История</CardTitle>
        </CardHeader>
        <CardContent>
          <HistoryList entries={history} />
        </CardContent>
      </Card>

      <TaskDangerZone id={task.id} parentId={task.parentTaskId} />
    </div>
  );
}
