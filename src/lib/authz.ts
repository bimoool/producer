import { createHash } from "node:crypto";
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { parseAllowlist } from "@/bot/parse";
import { getDb, schema } from "@/db";
import { can, type Permission, type WorkspaceRole } from "@/lib/permissions";
import { SESSION_COOKIE } from "@/lib/session";

const { sessions, users, workspaces, workspaceMembers } = schema;

export type Viewer = { userId: string; telegramId: number; displayName: string; isOwner: boolean };
export type Workspace = typeof workspaces.$inferSelect;
export type WorkspaceAccess = { workspace: Workspace; role: WorkspaceRole | null; isOwner: boolean };

/** Ошибка доступа для Server Actions: превращается в «Нет доступа», без деталей. */
export class AccessDenied extends Error {
  constructor() {
    super("ACCESS_DENIED");
  }
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Telegram ID владельца для первичной настройки: OWNER_TELEGRAM_ID или первый ID бота. */
export function ownerTelegramId(): number | null {
  const explicit = Number(process.env.OWNER_TELEGRAM_ID);
  if (Number.isSafeInteger(explicit) && explicit > 0) return explicit;
  const [first] = parseAllowlist(process.env.TELEGRAM_ALLOWED_USER_IDS);
  return first ?? null;
}

/** Активный пользователь может войти, если он владелец или у него есть действующий доступ к проекту. */
async function hasAnyAccess(userId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ one: sql<number>`1` })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(eq(workspaceMembers.userId, userId), isNull(workspaceMembers.revokedAt), isNull(workspaces.archivedAt)))
    .limit(1);
  return !!row;
}

/**
 * Сессия → пользователь. Проверяется при КАЖДОМ запросе: блокировка пользователя
 * или отзыв последнего доступа действуют сразу, без выхода из аккаунта.
 */
export async function resolveViewer(token: string | undefined): Promise<Viewer | null> {
  if (!token || token.length > 100) return null;
  const [row] = await getDb()
    .select({
      userId: users.id,
      telegramId: users.telegramId,
      displayName: users.displayName,
      isOwner: users.isOwner,
    })
    .from(sessions)
    .innerJoin(users, eq(users.telegramId, sessions.telegramId))
    .where(
      and(eq(sessions.tokenHash, sha256(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()), isNull(users.disabledAt)),
    )
    .limit(1);
  if (!row) return null;
  if (!row.isOwner && !(await hasAnyAccess(row.userId))) return null;
  return row;
}

/** Решение о входе после проверенной подписи Telegram. Владелец создаётся при первом входе. */
export async function loginDecision(telegramId: number): Promise<"owner" | "member" | "forbidden"> {
  const db = getDb();
  if (telegramId === ownerTelegramId()) {
    await db.insert(users).values({ telegramId, displayName: "Владелец", isOwner: true }).onConflictDoNothing();
  }
  const [u] = await db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1);
  if (!u || u.disabledAt) return "forbidden";
  if (u.isOwner) return "owner";
  return (await hasAnyAccess(u.id)) ? "member" : "forbidden";
}

/** Права пользователя в проекте. Чужой или архивный проект → null (как будто его нет). */
export async function authorizeWorkspace(
  viewer: Viewer,
  where: { slug: string } | { id: string },
  permission: Permission,
): Promise<WorkspaceAccess | null> {
  const db = getDb();
  const cond = "slug" in where ? eq(workspaces.slug, where.slug) : eq(workspaces.id, where.id);
  const [workspace] = await db.select().from(workspaces).where(and(cond, isNull(workspaces.archivedAt))).limit(1);
  if (!workspace) return null;
  let role: WorkspaceRole | null = null;
  if (!viewer.isOwner) {
    const [m] = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, viewer.userId), isNull(workspaceMembers.revokedAt)),
      )
      .limit(1);
    if (!m) return null;
    role = m.role as WorkspaceRole;
  }
  return can({ isOwner: viewer.isOwner, role }, permission) ? { workspace, role, isOwner: viewer.isOwner } : null;
}

/** Проекты, видимые пользователю. */
export async function listWorkspacesFor(viewer: Viewer): Promise<{ workspace: Workspace; role: WorkspaceRole | null }[]> {
  const db = getDb();
  if (viewer.isOwner) {
    const rows = await db.select().from(workspaces).where(isNull(workspaces.archivedAt)).orderBy(asc(workspaces.createdAt), asc(workspaces.title));
    return rows.map((workspace) => ({ workspace, role: null }));
  }
  const rows = await db
    .select({ workspace: workspaces, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(eq(workspaceMembers.userId, viewer.userId), isNull(workspaceMembers.revokedAt), isNull(workspaces.archivedAt)))
    .orderBy(asc(workspaces.createdAt), asc(workspaces.title));
  return rows.map((r) => ({ workspace: r.workspace, role: r.role as WorkspaceRole }));
}

// ---------- Обёртки для текущего запроса ----------

/** Пользователь текущего запроса (один запрос к БД на рендер). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const store = await cookies();
  return resolveViewer(store.get(SESSION_COOKIE)?.value);
});

/** Для страниц: без входа — на /login; не владелец — 404. */
export async function ownerPage(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/login");
  if (!v.isOwner) notFound();
  return v;
}

/** Для страниц проекта: без доступа — 404 (не раскрываем, что проект существует). */
export async function workspacePage(slug: string, permission: Permission = "workspace.view") {
  const v = await getViewer();
  if (!v) redirect("/login");
  const access = await authorizeWorkspace(v, { slug }, permission);
  if (!access) notFound();
  return { viewer: v, ...access };
}

/** Для Server Actions и серверных запросов: только владелец. */
export async function assertOwner(): Promise<Viewer> {
  const v = await getViewer();
  if (!v?.isOwner) throw new AccessDenied();
  return v;
}

/** Для Server Actions проекта. */
export async function assertWorkspace(id: string, permission: Permission) {
  const v = await getViewer();
  if (!v) throw new AccessDenied();
  const access = await authorizeWorkspace(v, { id }, permission);
  if (!access) throw new AccessDenied();
  return { viewer: v, ...access };
}
