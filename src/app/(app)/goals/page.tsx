import { ownerPage } from "@/lib/authz";
import { PlusIcon } from "lucide-react";
import { DeleteGoalButton, GoalDialog } from "@/components/app/goal-form";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { listGoals, listProjects } from "@/lib/data";
import { formatRu } from "@/lib/domain/dates";
import { GOAL_STATUS, type GoalStatus } from "@/lib/domain/labels";
import { computeProgress, formatProgress } from "@/lib/domain/progress";

export default async function GoalsPage() {
  // Личный кабинет — только владелец (проверка на сервере, не только в proxy).
  await ownerPage();
  const [goals, projects] = await Promise.all([listGoals(), listProjects()]);
  const projectTitles = new Map(projects.map((p) => [p.id, p.title]));
  const projectOpts = projects.map((p) => ({ id: p.id, title: p.title }));
  return (
    <>
      <PageHeader
        title="Цели"
        description="Дополнительные цели — вне декларации. Их можно менять и удалять."
        action={
          <GoalDialog
            projects={projectOpts}
            trigger={
              <Button>
                <PlusIcon /> Цель
              </Button>
            }
          />
        }
      />
      <div className="grid gap-3">
        {goals.length === 0 ? <p className="text-sm text-muted-foreground">Целей пока нет.</p> : null}
        {goals.map((g) => {
          const p = computeProgress(g.currentValue, g.targetValue);
          return (
            <Card key={g.id} className={g.status !== "active" ? "opacity-70" : undefined}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{g.title}</CardTitle>
                  <Badge variant="secondary">{GOAL_STATUS[g.status as GoalStatus]}</Badge>
                </div>
                <CardDescription>
                  {[g.projectId ? projectTitles.get(g.projectId) : null, g.deadline ? `до ${formatRu(g.deadline)}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {g.description ? <p className="text-sm text-muted-foreground">{g.description}</p> : null}
                {g.targetValue ? (
                  <div className="grid gap-1">
                    <div className="text-sm">{formatProgress(p, g.unit ?? "")}</div>
                    {p.confirmed ? <Progress value={p.percent} /> : null}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <GoalDialog projects={projectOpts} values={g} trigger={<Button size="sm" variant="outline">Изменить</Button>} />
                  <DeleteGoalButton id={g.id} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
