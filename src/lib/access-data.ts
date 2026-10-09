import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { assertOwner, assertWorkspace } from "@/lib/authz";
import type { WorkspaceRole } from "@/lib/permissions";

const { users, workspaces, workspaceMembers } = schema;

export type MemberRow = {
  memberId: string;
  userId: string;
  displayName: string;
  telegramId: number;
  role: WorkspaceRole;
  revokedAt: Date | null;
  userBlocked: boolean;
};

/** Все пользователи и их доступы — только владельцу (проверка внутри). */
export async function listUsersWithAccess() {
  await assertOwner();
  const db = getDb();
  const [userRows, memberRows, wsRows] = await Promise.all([
    db.select().from(users).orderBy(asc(users.createdAt)),
    db
      .select({
        memberId: workspaceMembers.id,
        userId: workspaceMembers.userId,
        workspaceId: workspaceMembers.workspaceId,
        role: workspaceMembers.role,
        revokedAt: workspaceMembers.revokedAt,
      })
      .from(workspaceMembers),
    db.select().from(workspaces).where(isNull(workspaces.archivedAt)).orderBy(asc(workspaces.createdAt), asc(workspaces.title)),
  ]);
  const wsTitle = new Map(wsRows.map((w) => [w.id, w.title]));
  return {
    workspaces: wsRows.map((w) => ({ id: w.id, title: w.title })),
    users: userRows.map((u) => ({
      ...u,
      access: memberRows
        .filter((m) => m.userId === u.id && wsTitle.has(m.workspaceId))
        .map((m) => ({ ...m, role: m.role as WorkspaceRole, workspaceTitle: wsTitle.get(m.workspaceId)! })),
    })),
  };
}

/** Участники проекта — только с правом управления этим проектом (проверка внутри). */
export async function listWorkspaceMembers(workspaceId: string): Promise<MemberRow[]> {
  const access = await assertWorkspace(workspaceId, "workspace.manage");
  const rows = await getDb()
    .select({
      memberId: workspaceMembers.id,
      userId: users.id,
      displayName: users.displayName,
      telegramId: users.telegramId,
      role: workspaceMembers.role,
      revokedAt: workspaceMembers.revokedAt,
      disabledAt: users.disabledAt,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(and(eq(workspaceMembers.workspaceId, access.workspace.id)))
    .orderBy(asc(workspaceMembers.createdAt));
  return rows.map(({ disabledAt, ...r }) => ({ ...r, role: r.role as WorkspaceRole, userBlocked: disabledAt !== null }));
}

/** Пользователи, которых можно добавить в проект (не владельцы) — только владельцу. */
export async function listAssignableUsers() {
  await assertOwner();
  return getDb()
    .select({ id: users.id, displayName: users.displayName, telegramId: users.telegramId })
    .from(users)
    .where(and(eq(users.isOwner, false), isNull(users.disabledAt)))
    .orderBy(asc(users.displayName));
}
