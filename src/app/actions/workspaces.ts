"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { AccessDenied, assertOwner, assertWorkspace } from "@/lib/authz";
import { WORKSPACE_ROLES } from "@/lib/permissions";
import { parseSheetLink } from "@/lib/sheets-link";
import { syncWorkspaceSheet } from "@/lib/sheets/sync";

const { users, workspaces, workspaceMembers } = schema;

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function fd(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === "string") out[k] = v;
  });
  return out;
}

function fail(e: unknown): ActionResult {
  if (e instanceof AccessDenied) return { ok: false, error: "Нет доступа" };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues.map((i) => i.message).join("; ") };
  // Drizzle оборачивает ошибку Postgres: причина и имя ограничения — в cause.
  const cause = (e as { cause?: { message?: string; constraint_name?: string } })?.cause;
  const msg = [e instanceof Error ? e.message : String(e), cause?.message, cause?.constraint_name].join(" ");
  if (/LAST_OWNER/.test(msg)) return { ok: false, error: "Нельзя отключить единственного владельца" };
  if (/users_telegram_id_unique/.test(msg)) return { ok: false, error: "Пользователь с таким Telegram ID уже есть" };
  if (/workspaces_slug_unique/.test(msg)) return { ok: false, error: "Такой адрес проекта уже занят" };
  return { ok: false, error: "Не удалось сохранить" };
}

const refresh = () => revalidatePath("/", "layout");
const uuid = z.uuid();
const role = z.enum(WORKSPACE_ROLES, { error: "Выберите роль" });
const telegramId = z
  .string()
  .trim()
  .regex(/^\d{1,15}$/, "Telegram ID — число (узнать у @userinfobot)")
  .transform(Number)
  .pipe(z.number().int().positive());
const displayName = z.string().trim().min(1, "Укажите имя").max(100);

// ---------- Проект ----------

const sheetSchema = z.object({ workspaceId: uuid, sheetUrl: z.string().max(500) });

/** Ссылка на Google-таблицу проекта (только хранение; импорт — в следующих спринтах). */
export async function saveWorkspaceSheet(_: unknown, form: FormData): Promise<ActionResult> {
  try {
    const input = sheetSchema.parse(fd(form));
    await assertWorkspace(input.workspaceId, "workspace.manage");
    let sheetUrl: string | null = null;
    let sheetId: string | null = null;
    if (input.sheetUrl.trim()) {
      const parsed = parseSheetLink(input.sheetUrl);
      if (!parsed) return { ok: false, error: "Нужна ссылка вида https://docs.google.com/spreadsheets/d/…" };
      sheetUrl = parsed.url;
      sheetId = parsed.id;
    }
    await getDb().update(workspaces).set({ sheetUrl, sheetId }).where(eq(workspaces.id, input.workspaceId));
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const createSchema = z.object({
  title: z.string().trim().min(1, "Укажите название").max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,40}$/, "Адрес: латиница, цифры и дефис, от 2 символов"),
  kind: z.enum(["client", "personal"]),
});

export async function createWorkspace(_: unknown, form: FormData): Promise<ActionResult> {
  try {
    await assertOwner();
    const input = createSchema.parse(fd(form));
    const [row] = await getDb().insert(workspaces).values(input).returning({ id: workspaces.id });
    refresh();
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Участники и доступы (только владелец) ----------

const addUserSchema = z.object({
  telegramId,
  displayName,
  workspaceId: z
    .string()
    .optional()
    .transform((v) => (v && v !== "none" ? v : null))
    .pipe(uuid.nullable()),
  role: role.optional(),
});

/** Новый пользователь по Telegram ID; сразу можно выдать доступ к проекту. */
export async function addUser(_: unknown, form: FormData): Promise<ActionResult> {
  try {
    await assertOwner();
    const input = addUserSchema.parse(fd(form));
    if (input.workspaceId && !input.role) return { ok: false, error: "Выберите роль" };
    const db = getDb();
    const id = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({ telegramId: input.telegramId, displayName: input.displayName })
        .returning({ id: users.id });
      if (input.workspaceId && input.role) {
        await tx.insert(workspaceMembers).values({ workspaceId: input.workspaceId, userId: u.id, role: input.role });
      }
      return u.id;
    });
    refresh();
    return { ok: true, id };
  } catch (e) {
    return fail(e);
  }
}

const grantSchema = z.object({ userId: uuid, workspaceId: uuid, role });

/** Выдать доступ или сменить роль. Отозванный ранее доступ восстанавливается. */
export async function grantAccess(_: unknown, form: FormData): Promise<ActionResult> {
  try {
    await assertOwner();
    const input = grantSchema.parse(fd(form));
    const db = getDb();
    const [u] = await db.select().from(users).where(eq(users.id, input.userId));
    if (!u) return { ok: false, error: "Пользователь не найден" };
    if (u.isOwner) return { ok: false, error: "У владельца и так полный доступ" };
    await db
      .insert(workspaceMembers)
      .values(input)
      .onConflictDoUpdate({
        target: [workspaceMembers.workspaceId, workspaceMembers.userId],
        set: { role: input.role, revokedAt: null },
      });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function changeRole(memberId: string, newRole: string): Promise<ActionResult> {
  try {
    await assertOwner();
    const r = role.parse(newRole);
    await getDb().update(workspaceMembers).set({ role: r }).where(eq(workspaceMembers.id, uuid.parse(memberId)));
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Отзыв доступа: действует на следующем же запросе пользователя. */
export async function revokeAccess(memberId: string): Promise<ActionResult> {
  try {
    await assertOwner();
    await getDb()
      .update(workspaceMembers)
      .set({ revokedAt: new Date() })
      .where(and(eq(workspaceMembers.id, uuid.parse(memberId))));
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Блокировка пользователя: все его сессии перестают действовать сразу. */
export async function setUserBlocked(userId: string, blocked: boolean): Promise<ActionResult> {
  try {
    await assertOwner();
    await getDb()
      .update(users)
      .set({ disabledAt: blocked ? new Date() : null })
      .where(eq(users.id, uuid.parse(userId)));
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Google-таблица проекта ----------

/** «Обновить данные»: только чтение из Google. Доступно всем, кто видит проект; не чаще раза в 30 с. */
export async function refreshSheet(workspaceId: string): Promise<ActionResult> {
  try {
    const { workspace } = await assertWorkspace(uuid.parse(workspaceId), "workspace.view");
    const r = await syncWorkspaceSheet({ id: workspace.id, sheetId: workspace.sheetId });
    refresh();
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  } catch (e) {
    return fail(e);
  }
}
