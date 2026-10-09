"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { addDaysISO, todayISO } from "@/lib/domain/dates";
import { renderReport, reportFieldsSchema, type ReportFields, type ReportPeriod } from "@/lib/domain/report";

const { declarationItems, goals, progressUpdates, tasks, taskComments, weeklyReports } = schema;

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const uuid = z.uuid();
const optUuid = z
  .string()
  .optional()
  .transform((v) => (v && v !== "none" ? v : null))
  .pipe(z.uuid().nullable());
const optText = z
  .string()
  .max(5000)
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : null));
const optDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.iso.date().nullable());
const optNumber = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === "" ? null : Number(v.replace(",", "."))))
  .pipe(z.number().finite().nullable());

function fd(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === "string") out[k] = v;
  });
  return out;
}

function fail(e: unknown): ActionResult {
  if (e instanceof z.ZodError) return { ok: false, error: e.issues.map((i) => i.message).join("; ") };
  const msg = e instanceof Error ? e.message : String(e);
  const locked = /DECLARATION_LOCKED|APPEND_ONLY/.exec(msg);
  return { ok: false, error: locked ? msg.slice(msg.indexOf(":") + 1).trim() : "Не удалось сохранить" };
}

function refresh() {
  revalidatePath("/", "layout");
}

// ---------- Декларация ----------

const progressSchema = z.object({
  itemId: uuid,
  value: z
    .string()
    .transform((v) => Number(v.replace(",", ".")))
    .pipe(z.number().finite().min(0)),
  note: optText,
});

/** Обновление прогресса пункта декларации + запись в историю. Текст обязательства не трогается. */
export async function updateDeclarationProgress(_: unknown, form: FormData): Promise<ActionResult> {
  try {
    const input = progressSchema.parse(fd(form));
    await getDb().transaction(async (tx) => {
      const [item] = await tx.select().from(declarationItems).where(eq(declarationItems.id, input.itemId)).for("update");
      if (!item) throw new Error("not found");
      await tx.insert(progressUpdates).values({
        declarationItemId: item.id,
        previousValue: item.currentValue,
        value: input.value,
        note: input.note,
      });
      await tx.update(declarationItems).set({ currentValue: input.value }).where(eq(declarationItems.id, item.id));
    });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const itemStatusSchema = z.object({
  itemId: uuid,
  status: z.enum(["none", "done", "in_progress", "partial", "not_done"]),
});

export async function updateDeclarationStatus(_: unknown, form: FormData): Promise<ActionResult> {
  try {
    const input = itemStatusSchema.parse(fd(form));
    await getDb()
      .update(declarationItems)
      .set({ status: input.status === "none" ? null : input.status })
      .where(eq(declarationItems.id, input.itemId));
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Цели ----------

const goalSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Введите название цели").max(300),
  description: optText,
  category: optText,
  targetValue: optNumber,
  currentValue: optNumber,
  unit: optText,
  deadline: optDate,
  status: z.enum(["active", "done", "paused", "dropped"]).default("active"),
  projectId: optUuid,
});

export async function saveGoal(_: unknown, form: FormData): Promise<ActionResult> {
  try {
    const { id, ...input } = goalSchema.parse(fd(form));
    const db = getDb();
    if (id) {
      await db.update(goals).set(input).where(eq(goals.id, uuid.parse(id)));
    } else {
      await db.insert(goals).values(input);
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  try {
    await getDb().delete(goals).where(eq(goals.id, uuid.parse(id)));
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Задачи ----------

const taskSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Введите название задачи").max(500),
  description: optText,
  goalId: optUuid,
  declarationItemId: optUuid,
  projectId: optUuid,
  parentTaskId: optUuid,
  status: z.enum(["todo", "in_progress", "blocked", "done"]).default("todo"),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  dueDate: optDate,
  result: optText,
});

export async function saveTask(_: unknown, form: FormData): Promise<ActionResult> {
  try {
    const { id, ...input } = taskSchema.parse(fd(form));
    const db = getDb();
    if (id) {
      const taskId = uuid.parse(id);
      if (input.parentTaskId === taskId) throw new z.ZodError([{ code: "custom", message: "Задача не может быть подзадачей самой себя", path: ["parentTaskId"], input: id }]);
      const [prev] = await db.select().from(tasks).where(eq(tasks.id, taskId));
      if (!prev) return { ok: false, error: "Задача не найдена" };
      await db
        .update(tasks)
        .set({
          ...input,
          completedAt: input.status === "done" ? (prev.completedAt ?? new Date()) : null,
        })
        .where(eq(tasks.id, taskId));
      refresh();
      return { ok: true, id: taskId };
    }
    const [row] = await db
      .insert(tasks)
      .values({ ...input, completedAt: input.status === "done" ? new Date() : null })
      .returning({ id: tasks.id });
    refresh();
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}

export async function setTaskDone(id: string, done: boolean): Promise<ActionResult> {
  try {
    await getDb()
      .update(tasks)
      .set(done ? { status: "done", completedAt: new Date() } : { status: "todo", completedAt: null })
      .where(eq(tasks.id, uuid.parse(id)));
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Перенос срока: "today" | "tomorrow" | "week" | "none". */
export async function rescheduleTask(id: string, to: "today" | "tomorrow" | "week" | "none"): Promise<ActionResult> {
  try {
    const today = todayISO();
    const dueDate = to === "none" ? null : addDaysISO(today, to === "today" ? 0 : to === "tomorrow" ? 1 : 7);
    await getDb().update(tasks).set({ dueDate }).where(eq(tasks.id, uuid.parse(id)));
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    await getDb().delete(tasks).where(eq(tasks.id, uuid.parse(id)));
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTaskAndGoHome(id: string, parentId: string | null) {
  const res = await deleteTask(id);
  if (res.ok) redirect(parentId ? `/tasks/${parentId}` : "/tasks");
  return res;
}

const commentSchema = z.object({ taskId: uuid, body: z.string().trim().min(1, "Пустой комментарий").max(5000) });

export async function addComment(_: unknown, form: FormData): Promise<ActionResult> {
  try {
    const input = commentSchema.parse(fd(form));
    await getDb().insert(taskComments).values(input);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Отчёты ----------

const periodSchema = z.object({
  weekNumber: z.number().int().min(1).max(1000),
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
});

export async function saveReport(input: {
  id?: string;
  period: ReportPeriod;
  fields: ReportFields;
  status: "draft" | "final";
}): Promise<ActionResult> {
  try {
    const period = periodSchema.parse(input.period);
    const fields = reportFieldsSchema.parse(input.fields);
    const status = z.enum(["draft", "final"]).parse(input.status);
    const content = renderReport(period, fields);
    const db = getDb();
    if (input.id) {
      const id = uuid.parse(input.id);
      await db.update(weeklyReports).set({ fields, content, status }).where(eq(weeklyReports.id, id));
      refresh();
      return { ok: true, id };
    }
    const [dup] = await db
      .select({ id: weeklyReports.id })
      .from(weeklyReports)
      .where(eq(weeklyReports.periodStart, period.periodStart));
    if (dup) return { ok: false, error: "Отчёт за этот период уже есть — откройте его в истории" };
    const [row] = await db
      .insert(weeklyReports)
      .values({ ...period, fields, content, status })
      .returning({ id: weeklyReports.id });
    refresh();
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}
