/**
 * Модель прав Producer OS.
 * Роль в проекте → набор разрешений. Владелец (users.is_owner) имеет все разрешения.
 * Расширение: новое разрешение (например "content.approve" для согласования)
 * добавляется сюда и выдаётся нужной роли — без изменения проверок в коде.
 */
export const WORKSPACE_ROLES = ["editor", "viewer"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const PERMISSIONS = [
  "workspace.view", // видеть проект и его данные
  "workspace.edit", // работать с данными проекта
  "workspace.manage", // настройки проекта, участники, таблица Google Sheets
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<WorkspaceRole, readonly Permission[]> = {
  editor: ["workspace.view", "workspace.edit"],
  viewer: ["workspace.view"],
};

export const ROLE_LABELS: Record<WorkspaceRole | "owner", string> = {
  owner: "Владелец",
  editor: "Редактор",
  viewer: "Просмотр / клиент",
};

export function isWorkspaceRole(v: unknown): v is WorkspaceRole {
  return typeof v === "string" && (WORKSPACE_ROLES as readonly string[]).includes(v);
}

export function can(subject: { isOwner: boolean; role: WorkspaceRole | null }, permission: Permission): boolean {
  if (subject.isOwner) return true;
  if (!subject.role) return false;
  return ROLE_PERMISSIONS[subject.role].includes(permission);
}
