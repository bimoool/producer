import { ownerPage } from "@/lib/authz";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { TaskDialog } from "@/components/app/task-form";
import { TaskRow } from "@/components/app/task-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getLinkOptions, goalTitleMap, listTasks } from "@/lib/data";
import { todayISO } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";

const FILTERS = { open: "Открытые", done: "Готовые", all: "Все" } as const;

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  // Личный кабинет — только владелец (проверка на сервере, не только в proxy).
  await ownerPage();
  const sp = await searchParams;
  const filter = (typeof sp.f === "string" && sp.f in FILTERS ? sp.f : "open") as keyof typeof FILTERS;
  const [rows, opts, goalTitles] = await Promise.all([listTasks(filter), getLinkOptions(), goalTitleMap()]);
  const today = todayISO();
  // подзадачи показываем внутри родителя, в списке — только верхний уровень
  const top = rows.filter((t) => !t.parentTaskId);
  return (
    <>
      <PageHeader
        title="Задачи"
        action={
          <TaskDialog
            title="Новая задача"
            {...opts}
            trigger={
              <Button>
                <PlusIcon /> Задача
              </Button>
            }
          />
        }
      />
      <div className="mb-3 flex gap-1">
        {Object.entries(FILTERS).map(([k, v]) => (
          <Button key={k} asChild size="sm" variant={k === filter ? "default" : "ghost"}>
            <Link href={k === "open" ? "/tasks" : `/tasks?f=${k}`}>{v}</Link>
          </Button>
        ))}
      </div>
      <Card>
        <CardContent className={cn("divide-y", top.length === 0 && "py-6 text-center text-sm text-muted-foreground")}>
          {top.length === 0
            ? "Здесь пусто."
            : top.map((t) => (
                <TaskRow
                  key={t.id}
                  today={today}
                  task={{ ...t, goalTitle: t.goalId ? goalTitles.get(t.goalId) : null }}
                />
              ))}
        </CardContent>
      </Card>
    </>
  );
}
