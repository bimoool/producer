"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { ACCESS_ITEM, PERSONAL_NAV, PROJECTS_ITEM, isActive, mobileMore, mobilePrimary, type NavItem } from "./nav";

function Group({ label, items, pathname }: { label?: string; items: NavItem[]; pathname: string }) {
  return (
    <SidebarGroup>
      {label ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={isActive(pathname, item.href)} tooltip={item.label}>
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="px-2 py-1 text-base font-semibold group-data-[collapsible=icon]:hidden">Producer OS</div>
      </SidebarHeader>
      <SidebarContent>
        {isOwner ? <Group label="Личное" items={PERSONAL_NAV} pathname={pathname} /> : null}
        <Group label="Producer OS" items={isOwner ? [PROJECTS_ITEM, ACCESS_ITEM] : [PROJECTS_ITEM]} pathname={pathname} />
      </SidebarContent>
    </Sidebar>
  );
}

const linkCls = (active: boolean) =>
  cn("flex flex-col items-center gap-0.5 py-2 text-[11px] leading-tight", active ? "text-foreground" : "text-muted-foreground");

/** Нижняя навигация для телефона. */
export function MobileNav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const primary = mobilePrimary(isOwner);
  const more = mobileMore(isOwner);
  const cols = primary.length + (more.length ? 1 : 0);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {primary.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={linkCls(isActive(pathname, item.href))}>
              <item.icon className="size-5" />
              <span className="max-w-full truncate px-0.5">{item.label}</span>
            </Link>
          </li>
        ))}
        {more.length ? (
          <li>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger className={cn(linkCls(more.some((m) => isActive(pathname, m.href))), "w-full")}>
                <MenuIcon className="size-5" />
                Ещё
              </SheetTrigger>
              <SheetContent side="bottom" className="pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                <SheetHeader>
                  <SheetTitle>Разделы</SheetTitle>
                </SheetHeader>
                <ul className="grid gap-1 px-4">
                  {more.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-3 text-base",
                          isActive(pathname, item.href) ? "bg-accent" : "hover:bg-accent/60",
                        )}
                      >
                        <item.icon className="size-5" />
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </SheetContent>
            </Sheet>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
