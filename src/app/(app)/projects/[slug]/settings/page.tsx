import { SheetForm } from "@/components/app/workspace-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { workspacePage } from "@/lib/authz";

export default async function ProjectSettings({ params }: PageProps<"/projects/[slug]/settings">) {
  const { slug } = await params;
  const { workspace } = await workspacePage(slug, "workspace.manage");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Google-таблица проекта</CardTitle>
        <CardDescription>Своя копия шаблона: контент-план и аналитика.</CardDescription>
      </CardHeader>
      <CardContent>
        <SheetForm workspaceId={workspace.id} sheetUrl={workspace.sheetUrl} />
      </CardContent>
    </Card>
  );
}
