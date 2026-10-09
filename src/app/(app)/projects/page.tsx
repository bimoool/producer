import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRightIcon, PlusIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { CreateWorkspaceDialog } from "@/components/app/workspace-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getViewer, listWorkspacesFor } from "@/lib/authz";
import { ROLE_LABELS } from "@/lib/permissions";

export default async function ProjectsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const list = await listWorkspacesFor(viewer);
  // Участник с единственным проектом сразу попадает в него.
  if (!viewer.isOwner && list.length === 1) redirect(`/projects/${list[0].workspace.slug}/dashboard`);
  return (
    <>
      <PageHeader
        title="Проекты"
        description={viewer.isOwner ? "Все проекты Producer OS" : "Проекты, к которым у вас есть доступ"}
        action={
          viewer.isOwner ? (
            <CreateWorkspaceDialog
              trigger={
                <Button>
                  <PlusIcon /> Проект
                </Button>
              }
            />
          ) : null
        }
      />
      {list.length === 0 ? <p className="text-sm text-muted-foreground">Проектов пока нет.</p> : null}
      <div className="grid gap-3">
        {list.map(({ workspace, role }) => (
          <Link key={workspace.id} href={`/projects/${workspace.slug}/dashboard`}>
            <Card className="transition-colors hover:bg-accent/50">
              <CardContent className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-medium">{workspace.title}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{workspace.kind === "client" ? "Клиентский" : "Личный"}</Badge>
                    <Badge variant="outline">{viewer.isOwner ? ROLE_LABELS.owner : ROLE_LABELS[role!]}</Badge>
                    {workspace.sheetId ? <Badge variant="outline">таблица подключена</Badge> : null}
                  </div>
                </div>
                <ChevronRightIcon className="size-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
