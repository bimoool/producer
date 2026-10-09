import { AppSidebar, MobileNav } from "@/components/app/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4 max-md:hidden">
          <SidebarTrigger />
        </header>
        <main className="mx-auto w-full max-w-3xl px-4 pt-4 pb-24 md:pb-10">{children}</main>
      </SidebarInset>
      <MobileNav />
    </SidebarProvider>
  );
}
