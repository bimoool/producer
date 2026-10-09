import { FileTextIcon, HomeIcon, ListTodoIcon, LockIcon, TargetIcon } from "lucide-react";

export const NAV = [
  { href: "/", label: "Главная", icon: HomeIcon },
  { href: "/declaration", label: "Декларация", icon: LockIcon },
  { href: "/goals", label: "Цели", icon: TargetIcon },
  { href: "/tasks", label: "Задачи", icon: ListTodoIcon },
  { href: "/reports", label: "Отчёты", icon: FileTextIcon },
] as const;

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
