import { ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { workspacePage } from "@/lib/authz";

export default async function ProjectContent({ params }: PageProps<"/projects/[slug]/content">) {
  const { slug } = await params;
  const { workspace } = await workspacePage(slug, "workspace.view");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Контент-план</CardTitle>
        <CardDescription>Контент-план проекта пока ведётся в Google-таблице.</CardDescription>
      </CardHeader>
      <CardContent>
        {workspace.sheetUrl ? (
          <Button asChild variant="outline">
            <a href={workspace.sheetUrl} target="_blank" rel="noopener noreferrer">
              Открыть таблицу <ExternalLinkIcon />
            </a>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Таблица проекта ещё не указана.</p>
        )}
      </CardContent>
    </Card>
  );
}
