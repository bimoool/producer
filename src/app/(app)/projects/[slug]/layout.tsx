import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { ProjectTabs } from "@/components/app/project-tabs";
import { workspacePage } from "@/lib/authz";
import { can } from "@/lib/permissions";

export default async function ProjectLayout({ children, params }: LayoutProps<"/projects/[slug]">) {
  const { slug } = await params;
  // Чужой проект → 404. Каждая вложенная страница проверяет права повторно.
  const { workspace, isOwner, role } = await workspacePage(slug);
  const manage = can({ isOwner, role }, "workspace.manage");
  return (
    <div className="grid gap-4">
      <div>
        <Link href="/projects" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeftIcon className="size-4" /> Проекты
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{workspace.title}</h1>
      </div>
      <ProjectTabs slug={workspace.slug} manage={manage} />
      {children}
    </div>
  );
}
