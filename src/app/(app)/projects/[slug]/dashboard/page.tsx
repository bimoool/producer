import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { workspacePage } from "@/lib/authz";

export default async function ProjectDashboard({ params }: PageProps<"/projects/[slug]/dashboard">) {
  const { slug } = await params;
  const { workspace } = await workspacePage(slug, "workspace.view");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Дашборд</CardTitle>
        <CardDescription>
          Здесь появятся ключевые показатели проекта из его Google-таблицы. Какие KPI показывать, выбирается при
          подключении таблицы.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-1 text-sm text-muted-foreground">
        <div>Данные обновлены: —</div>
        <div>Таблица проекта: {workspace.sheetId ? "указана" : "не указана"}</div>
      </CardContent>
    </Card>
  );
}
