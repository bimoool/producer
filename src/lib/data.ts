import "server-only";
import { and, asc, desc, eq, gte, isNull, lt, lte, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { addDaysISO, todayISO } from "@/lib/domain/dates";

const { declarations, declarationItems, goals, projects, tasks, taskComments, activityLog, progressUpdates, weeklyReports } =
  schema;

export type Task = typeof tasks.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type DeclarationItem = typeof declarationItems.$inferSelect;
export type WeeklyReport = typeof weeklyReports.$inferSelect;

export async function getDeclaration() {
  const db = getDb();
  const [decl] = await db.select().from(declarations).orderBy(desc(declarations.declaredOn)).limit(1);
  if (!decl) return null;
  const items = await db
    .select()
    .from(declarationItems)
    .where(eq(declarationItems.declarationId, decl.id))
    .orderBy(asc(declarationItems.position));
  return { ...decl, items };
}

export async function getProgressHistory(itemId: string) {
  return getDb()
    .select()
    .from(progressUpdates)
    .where(eq(progressUpdates.declarationItemId, itemId))
    .orderBy(desc(progressUpdates.createdAt))
    .limit(20);
}

export async function listGoals() {
  return getDb().select().from(goals).orderBy(asc(goals.status), asc(goals.deadline), asc(goals.createdAt));
}

export async function listProjects() {
  return getDb().select().from(projects).orderBy(asc(projects.title));
}

const openTask = ne(tasks.status, "done");
const topLevel = isNull(tasks.parentTaskId);

export type TaskBuckets = { today: Task[]; week: Task[]; overdue: Task[]; blocked: Task[]; noDate: Task[] };

/** Группы задач для дашборда (по часовому поясу Asia/Yekaterinburg). */
export async function getTaskBuckets(today = todayISO()): Promise<TaskBuckets> {
  const db = getDb();
  const weekEnd = addDaysISO(today, 7);
  const order = [asc(tasks.dueDate), sql`case ${tasks.priority} when 'high' then 0 when 'normal' then 1 else 2 end`];
  const [todayT, week, overdue, blocked, noDate] = await Promise.all([
    db.select().from(tasks).where(and(openTask, eq(tasks.dueDate, today))).orderBy(...order),
    db.select().from(tasks).where(and(openTask, gte(tasks.dueDate, addDaysISO(today, 1)), lte(tasks.dueDate, weekEnd))).orderBy(...order),
    db.select().from(tasks).where(and(openTask, lt(tasks.dueDate, today))).orderBy(...order),
    db.select().from(tasks).where(eq(tasks.status, "blocked")).orderBy(...order),
    db.select().from(tasks).where(and(openTask, topLevel, isNull(tasks.dueDate))).orderBy(desc(tasks.createdAt)),
  ]);
  return { today: todayT, week, overdue, blocked, noDate };
}

export async function listTasks(filter: "open" | "done" | "all") {
  const db = getDb();
  const where = filter === "open" ? openTask : filter === "done" ? eq(tasks.status, "done") : undefined;
  return db
    .select()
    .from(tasks)
    .where(where)
    .orderBy(sql`${tasks.dueDate} asc nulls last`, desc(tasks.createdAt))
    .limit(200);
}

export async function getTask(id: string) {
  const db = getDb();
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) return null;
  const [subtasks, comments, history, goal, item, parent] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.parentTaskId, id)).orderBy(asc(tasks.createdAt)),
    db.select().from(taskComments).where(eq(taskComments.taskId, id)).orderBy(desc(taskComments.createdAt)),
    db
      .select()
      .from(activityLog)
      .where(and(eq(activityLog.entityType, "tasks"), eq(activityLog.entityId, id)))
      .orderBy(desc(activityLog.createdAt))
      .limit(30),
    task.goalId ? db.select().from(goals).where(eq(goals.id, task.goalId)).then((r) => r[0] ?? null) : null,
    task.declarationItemId
      ? db.select().from(declarationItems).where(eq(declarationItems.id, task.declarationItemId)).then((r) => r[0] ?? null)
      : null,
    task.parentTaskId ? db.select().from(tasks).where(eq(tasks.id, task.parentTaskId)).then((r) => r[0] ?? null) : null,
  ]);
  return { task, subtasks, comments, history, goal, item, parent };
}

export async function recentActivity(limit = 8) {
  return getDb().select().from(activityLog).orderBy(desc(activityLog.id)).limit(limit);
}

export async function tasksCompletedBetween(from: string, to: string) {
  return getDb()
    .select({ title: tasks.title })
    .from(tasks)
    .where(
      and(
        eq(tasks.status, "done"),
        sql`(${tasks.completedAt} at time zone 'Asia/Yekaterinburg')::date between ${from} and ${to}`,
      ),
    )
    .orderBy(asc(tasks.completedAt));
}

export async function openTasksDueBetween(from: string, to: string) {
  return getDb()
    .select({ title: tasks.title })
    .from(tasks)
    .where(and(openTask, gte(tasks.dueDate, from), lte(tasks.dueDate, to)))
    .orderBy(asc(tasks.dueDate));
}

export async function listReports() {
  return getDb().select().from(weeklyReports).orderBy(desc(weeklyReports.periodStart));
}

export async function getReport(id: string) {
  const [r] = await getDb().select().from(weeklyReports).where(eq(weeklyReports.id, id));
  return r ?? null;
}

export async function getReportByPeriod(periodStart: string) {
  const [r] = await getDb().select().from(weeklyReports).where(eq(weeklyReports.periodStart, periodStart));
  return r ?? null;
}

/** Варианты для выпадающих списков в формах задач. */
export async function getLinkOptions() {
  const [goalRows, decl, projectRows] = await Promise.all([listGoals(), getDeclaration(), listProjects()]);
  return {
    goals: goalRows.filter((g) => g.status === "active").map((g) => ({ id: g.id, title: g.title })),
    items: (decl?.items ?? []).map((i) => ({ id: i.id, title: i.shortTitle })),
    projects: projectRows.map((p) => ({ id: p.id, title: p.title })),
  };
}

export async function goalTitleMap() {
  const rows = await listGoals();
  return new Map(rows.map((g) => [g.id, g.title]));
}
