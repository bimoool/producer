import Link from "next/link";
import { AddUserForm, GrantAccessForm, MemberControls } from "@/components/app/workspace-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listAssignableUsers, listWorkspaceMembers } from "@/lib/access-data";
import { workspacePage } from "@/lib/authz";

export default async function ProjectMembers({ params }: PageProps<"/projects/[slug]/members">) {
  const { slug } = await params;
  const { workspace } = await workspacePage(slug, "workspace.manage");
  const [members, assignable] = await Promise.all([listWorkspaceMembers(workspace.id), listAssignableUsers()]);
  const active = new Set(members.filter((m) => !m.revokedAt).map((m) => m.userId));
  const candidates = assignable.filter((u) => !active.has(u.id));
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Участники</CardTitle>
          <CardDescription>Владелец видит все проекты. Здесь — кому ещё открыт «{workspace.title}».</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {members.length === 0 ? <p className="text-sm text-muted-foreground">Пока только вы.</p> : null}
          {members.map((m) => (
            <div key={m.memberId} className="grid gap-1.5 border-b pb-3 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{m.displayName}</span>
                <span className="text-muted-foreground tabular-nums">{m.telegramId}</span>
                {m.userBlocked ? <Badge variant="destructive">заблокирован</Badge> : null}
              </div>
              <MemberControls memberId={m.memberId} role={m.role} revoked={m.revokedAt !== null} label={m.displayName} />
            </div>
          ))}
        </CardContent>
      </Card>
      {candidates.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Дать доступ существующему пользователю</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {candidates.map((u) => (
              <div key={u.id} className="grid gap-1.5">
                <div className="text-sm">
                  {u.displayName} <span className="text-muted-foreground">{u.telegramId}</span>
                </div>
                <GrantAccessForm userId={u.id} workspaces={[{ id: workspace.id, title: workspace.title }]} />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Новый участник</CardTitle>
          <CardDescription>
            Все пользователи — в разделе <Link href="/admin/access" className="underline">«Участники и доступы»</Link>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddUserForm workspaces={[]} fixedWorkspaceId={workspace.id} />
        </CardContent>
      </Card>
    </div>
  );
}
