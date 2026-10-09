import { ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        {hint ? <CardDescription className="text-xs">{hint}</CardDescription> : null}
      </CardHeader>
    </Card>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">{children}</h2>
      {action}
    </div>
  );
}

/** Поле карточки: подпись + текст. Пустое не выводится. */
export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className={cn("grid gap-0.5", className)}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm whitespace-pre-wrap">{children}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  if (!status) return <Badge variant="outline">без статуса</Badge>;
  const done = /опубликован|вышел|подтвержд|успех|готово/i.test(status);
  const fail = /опроверг|провал|отмен|стоп/i.test(status);
  return <Badge variant={done ? "default" : fail ? "destructive" : "secondary"}>{status}</Badge>;
}

export function ExtLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline">
      {children} <ExternalLinkIcon className="size-3.5" />
    </a>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
