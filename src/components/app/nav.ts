import {
  FileTextIcon,
  FolderKanbanIcon,
  HomeIcon,
  ListTodoIcon,
  LockIcon,
  TargetIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: typeof HomeIcon };

/** Личный кабинет владельца (Goal Tracker). */
export const PERSONAL_NAV: NavItem[] = [
  { href: "/", label: "Главная", icon: HomeIcon },
  { href: "/declaration", label: "Декларация", icon: LockIcon },
  { href: "/goals", label: "Цели", icon: TargetIcon },
  { href: "/tasks", label: "Задачи", icon: ListTodoIcon },
  { href: "/finance", label: "Финансы", icon: WalletIcon },
  { href: "/reports", label: "Отчёты", icon: FileTextIcon },
];

export const PROJECTS_ITEM: NavItem = { href: "/projects", label: "Проекты", icon: FolderKanbanIcon };
export const ACCESS_ITEM: NavItem = { href: "/admin/access", label: "Доступы", icon: UsersIcon };

/** Нижняя панель телефона: 4 главных пункта + «Ещё». Не-владелец видит только проекты. */
export function mobilePrimary(isOwner: boolean): NavItem[] {
  if (!isOwner) return [PROJECTS_ITEM];
  return [PERSONAL_NAV[0], PERSONAL_NAV[3], PROJECTS_ITEM, PERSONAL_NAV[5]];
}

export function mobileMore(isOwner: boolean): NavItem[] {
  if (!isOwner) return [];
  return [PERSONAL_NAV[1], PERSONAL_NAV[2], PERSONAL_NAV[4], ACCESS_ITEM];
}

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
