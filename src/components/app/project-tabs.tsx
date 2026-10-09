"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Вкладки проекта; на iPhone прокручиваются по горизонтали. */
export function ProjectTabs({ slug, manage }: { slug: string; manage: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/projects/${slug}/dashboard`, label: "Обзор" },
    { href: `/projects/${slug}/content`, label: "Контент-план" },
    { href: `/projects/${slug}/lab`, label: "Лаборатория" },
    { href: `/projects/${slug}/analytics`, label: "Аналитика" },
    { href: `/projects/${slug}/hypotheses`, label: "Гипотезы и цели" },
    ...(manage
      ? [
          { href: `/projects/${slug}/members`, label: "Участники" },
          { href: `/projects/${slug}/settings`, label: "Настройки" },
        ]
      : []),
  ];
  return (
    <nav className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex w-max gap-1 rounded-lg bg-muted p-1">
        {tabs.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={cn(
                  "block rounded-md px-3 py-1.5 text-sm whitespace-nowrap",
                  active ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
