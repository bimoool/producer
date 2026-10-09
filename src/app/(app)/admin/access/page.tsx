import { PageHeader } from "@/components/app/page-header";
import { AddUserForm, BlockUserButton, GrantAccessForm, MemberControls } from "@/components/app/workspace-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listUsersWithAccess } from "@/lib/access-data";
import { ownerPage } from "@/lib/authz";
import { ROLE_LABELS } from "@/lib/permissions";

export default async function AccessPage() {
  await ownerPage();
  const { users, workspaces } = await listUsersWithAccess();
  return (
    <>
      <PageHeader title="Участники и доступы" description="Кто может войти и какие проекты видит. Вход — через Telegram." />
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Добавить участника</CardTitle>
          </CardHeader>
          <CardContent>
            <AddUserForm workspaces={workspaces} />
          </CardContent>
        </Card>
        {users.map((u) => {
          const activeIds = new Set(u.access.filter((a) => !a.revokedAt).map((a) => a.workspaceId));
          const available = workspaces.filter((w) => !activeIds.has(w.id));
          return (
            <Card key={u.id} className={u.disabledAt ? "opacity-70" : undefined}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{u.displayName}</CardTitle>
                  <span className="text-sm text-muted-foreground tabular-nums">{u.telegramId}</span>
                  {u.isOwner ? <Badge>{ROLE_LABELS.owner}</Badge> : null}
                  {u.disabledAt ? <Badge variant="destructive">заблокирован</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                {u.isOwner ? (
                  <p className="text-sm text-muted-foreground">Полный доступ ко всем проектам и личному кабинету.</p>
                ) : (
                  <>
                    {u.access.length === 0 ? <p className="text-sm text-muted-foreground">Нет доступа ни к одному проекту — войти не сможет.</p> : null}
                    {u.access.map((a) => (
                      <div key={a.memberId} className="grid gap-1">
                        <div className="text-sm font-medium">{a.workspaceTitle}</div>
                        <MemberControls memberId={a.memberId} role={a.role} revoked={a.revokedAt !== null} label={`${u.displayName}, ${a.workspaceTitle}`} />
                      </div>
                    ))}
                    {available.length ? <GrantAccessForm userId={u.id} workspaces={available} /> : null}
                    <div>
                      <BlockUserButton userId={u.id} blocked={u.disabledAt !== null} name={u.displayName} />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
