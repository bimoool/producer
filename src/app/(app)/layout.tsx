import { redirect } from "next/navigation";
import { AppSidebar, MobileNav } from "@/components/app/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getViewer } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Навигация зависит от роли. Права на данные проверяет каждая страница и действие.
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return (
    <SidebarProvider>
      <AppSidebar isOwner={viewer.isOwner} />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4 max-md:hidden">
          <SidebarTrigger />
          <span className="ml-auto text-sm text-muted-foreground">{viewer.displayName}</span>
        </header>
        <main className="mx-auto w-full max-w-3xl px-4 pt-4 pb-28 md:pb-10">
          {children}
          <form action="/auth/logout" method="post" className="mt-10 text-center">
            <button type="submit" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              Выйти{viewer.isOwner ? "" : ` (${viewer.displayName})`}
            </button>
          </form>
        </main>
      </SidebarInset>
      <MobileNav isOwner={viewer.isOwner} />
    </SidebarProvider>
  );
}
