import Link from "next/link";
import { ArrowRightIcon, PlusIcon } from "lucide-react";
import { GoalDialog } from "@/components/app/goal-form";
import { HistoryList } from "@/components/app/history";
import { TaskDialog } from "@/components/app/task-form";
import { TaskRow } from "@/components/app/task-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getDeclaration,
  getLinkOptions,
  getReportByPeriod,
  getTaskBuckets,
  goalTitleMap,
  listGoals,
  recentActivity,
  type Task,
} from "@/lib/data";
import { formatRu, todayISO, weekdayISO } from "@/lib/domain/dates";
import { computeProgress, formatProgress } from "@/lib/domain/progress";
import { reportPeriodFor } from "@/lib/domain/report";

const MAX = 5;

export default async function Dashboard() {
  const today = todayISO();
  const [decl, buckets, goals, activity, opts, goalTitles] = await Promise.all([
    getDeclaration(),
    getTaskBuckets(today),
    listGoals(),
    recentActivity(6),
    getLinkOptions(),
    goalTitleMap(),
  ]);
  const period = reportPeriodFor(today, decl?.cycleStart ?? "2026-10-02");
  const report = period.weekNumber >= 1 ? await getReportByPeriod(period.periodStart) : null;
  const isFriday = weekdayISO(today) === 5;

  // Три главных действия: просроченное → сегодня → важное без срока
  const focus: Task[] = [];
  for (const t of [...buckets.overdue, ...buckets.today, ...buckets.noDate.filter((t) => t.priority === "high"), ...buckets.week]) {
    if (focus.length >= 3) break;
    if (!focus.some((f) => f.id === t.id)) focus.push(t);
  }
  const row = (t: Task) => <TaskRow key={t.id} today={today} task={{ ...t, goalTitle: t.goalId ? goalTitles.get(t.goalId) : null }} />;
  const tabs = [
    { key: "today", label: "Сегодня", items: buckets.today },
    { key: "week", label: "Неделя", items: buckets.week },
    { key: "overdue", label: "Просрочено", items: buckets.overdue },
    { key: "blocked", label: "Блок", items: buckets.blocked },
  ] as const;
  const activeGoals = goals.filter((g) => g.status === "active");

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Сегодня</h1>
          <p className="text-sm text-muted-foreground">{formatRu(today)}</p>
        </div>
        <TaskDialog
          title="Новая задача"
          {...opts}
          values={{ dueDate: today }}
          trigger={
            <Button>
              <PlusIcon /> Задача
            </Button>
          }
        />
      </div>

      {period.weekNumber >= 1 && (!report || report.status === "draft") ? (
        <Card className={isFriday ? "border-primary" : undefined}>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>{isFriday ? "Пятница — время отчёта" : "Отчёт за неделю"}</CardTitle>
              <CardDescription>
                Неделя {period.weekNumber}: {formatRu(period.periodStart)}–{formatRu(period.periodEnd)}
                {report ? " · черновик сохранён" : ""}
              </CardDescription>
            </div>
            <Button asChild>
              <Link href={report ? `/reports/${report.id}` : "/reports/new"}>{report ? "Продолжить" : "Заполнить"}</Link>
            </Button>
          </CardHeader>
        </Card>
      ) : null}

      <section className="grid gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Главное сейчас</h2>
        <Card>
          <CardContent className="divide-y">
            {focus.length ? focus.map(row) : <p className="py-2 text-sm text-muted-foreground">Срочного нет. Выбери задачу из списка или добавь новую.</p>}
          </CardContent>
        </Card>
      </section>

      {decl ? (
        <section className="grid gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Что я обещал · {decl.title}</h2>
            <Link href="/declaration" className="text-sm text-muted-foreground hover:text-foreground">
              Обновить <ArrowRightIcon className="inline size-3.5" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {decl.items.map((i) => {
              const p = computeProgress(i.currentValue, i.targetValue);
              return (
                <Link key={i.id} href="/declaration">
                  <Card className="h-full transition-colors hover:bg-accent/50">
                    <CardHeader>
                      <CardDescription>{i.shortTitle}</CardDescription>
                      {p.confirmed ? (
                        <CardTitle className="text-3xl tabular-nums">
                          {p.current}
                          <span className="text-base font-normal text-muted-foreground"> / {p.target}</span>
                        </CardTitle>
                      ) : (
                        <CardTitle className="text-base font-medium text-muted-foreground">
                          Цель: {i.targetValue} {i.unit}
                        </CardTitle>
                      )}
                    </CardHeader>
                    <CardContent>
                      {p.confirmed ? (
                        <>
                          <Progress value={p.percent} />
                          <div className="mt-1 text-xs text-muted-foreground">{p.percent}%</div>
                        </>
                      ) : (
                        <div className="text-xs text-muted-foreground">{formatProgress(p)}</div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Задачи</h2>
        <Tabs defaultValue={buckets.overdue.length && !buckets.today.length ? "overdue" : "today"}>
          <TabsList className="w-full">
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
                {t.items.length ? <span className="ml-1 text-muted-foreground tabular-nums">{t.items.length}</span> : null}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t) => (
            <TabsContent key={t.key} value={t.key}>
              <Card>
                <CardContent className="divide-y">
                  {t.items.length ? t.items.slice(0, MAX).map(row) : <p className="py-2 text-sm text-muted-foreground">Пусто.</p>}
                  {t.items.length > MAX ? (
                    <Link href="/tasks" className="block pt-2 text-sm text-muted-foreground hover:text-foreground">
                      Ещё {t.items.length - MAX} →
                    </Link>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
        {buckets.noDate.length ? (
          <Link href="/tasks" className="text-sm text-muted-foreground hover:text-foreground">
            Без срока: {buckets.noDate.length} →
          </Link>
        ) : null}
      </section>

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Цели вне декларации</h2>
          <GoalDialog
            projects={opts.projects}
            trigger={
              <Button size="sm" variant="ghost">
                <PlusIcon /> Цель
              </Button>
            }
          />
        </div>
        <Card>
          <CardContent className="grid gap-3">
            {activeGoals.length === 0 ? <p className="text-sm text-muted-foreground">Активных целей нет.</p> : null}
            {activeGoals.slice(0, 3).map((g) => (
              <div key={g.id} className="grid gap-1">
                <div className="text-sm font-medium">{g.title}</div>
                <div className="text-xs text-muted-foreground">
                  {g.targetValue ? formatProgress(computeProgress(g.currentValue, g.targetValue), g.unit ?? "") : g.description ?? "Метрики не заданы"}
                </div>
              </div>
            ))}
            {activeGoals.length > 3 ? (
              <Link href="/goals" className="text-sm text-muted-foreground hover:text-foreground">
                Все цели →
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Последние изменения</h2>
        <Card>
          <CardContent>
            <HistoryList entries={activity} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
