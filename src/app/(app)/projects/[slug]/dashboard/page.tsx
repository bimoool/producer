import Link from "next/link";
import { SheetStatus } from "@/components/app/sheet-status";
import { Empty, SectionTitle, Stat, StatusBadge } from "@/components/app/sheet-ui";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { workspacePage } from "@/lib/authz";
import { addDaysISO, todayISO } from "@/lib/domain/dates";
import { can } from "@/lib/permissions";
import { fmtChange, fmtDate, fmtInt, fmtPct } from "@/lib/sheets/format";
import { change, countBy, periodTotals, upcoming } from "@/lib/sheets/insights";
import { loadSheetState } from "@/lib/sheets/page-data";

export default async function ProjectOverview({ params }: PageProps<"/projects/[slug]/dashboard">) {
  const { slug } = await params;
  const { workspace, isOwner, role } = await workspacePage(slug, "workspace.view");
  const state = await loadSheetState(workspace);
  const d = state.data;
  const today = todayISO();
  // Окно — по последней дате в статистике (её выгружают раз в месяц), а не по сегодняшнему дню.
  const lastDay = d?.daily.at(-1)?.date ?? today;
  const cur = d ? periodTotals(d.daily, 30, lastDay) : null;
  const prev = d ? periodTotals(d.daily, 30, addDaysISO(lastDay, -30)) : null;
  const next = d ? upcoming(d.plan, today, 5) : [];
  const decisions = d ? countBy(d.hypotheses, (h) => h.decision, "Без решения") : [];
  const labStatuses = d ? countBy(d.lab, (s) => s.status) : [];

  return (
    <div className="grid gap-5">
      <SheetStatus state={state} workspaceId={workspace.id} sheetUrl={workspace.sheetUrl} canManage={can({ isOwner, role }, "workspace.manage")} slug={slug} />
      {!d ? null : (
        <>
          <section className="grid gap-2">
            <SectionTitle>
              Instagram за 30 дней · {fmtDate(cur!.from)}–{fmtDate(cur!.to)}
            </SectionTitle>
            {cur!.days === 0 ? (
              <Empty>Во вкладке «05 90 дней» нет данных за этот период.</Empty>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Просмотры" value={fmtInt(cur!.views)} hint={fmtChange(change(cur!.views, prev!.views))} />
                <Stat label="Охват" value={fmtInt(cur!.reach)} hint={fmtChange(change(cur!.reach, prev!.reach))} />
                <Stat label="Подписки" value={fmtInt(cur!.follows)} hint={fmtChange(change(cur!.follows, prev!.follows))} />
                <Stat label="Конверсия в подписку" value={fmtPct(cur!.followConversion)} hint="подписки / охват" />
              </div>
            )}
          </section>

          <section className="grid gap-2">
            <SectionTitle action={<Link className="text-sm text-muted-foreground hover:text-foreground" href={`/projects/${slug}/hypotheses`}>Все →</Link>}>
              Цели
            </SectionTitle>
            <Card>
              <CardContent className="grid gap-4">
                {d.goals.length === 0 ? <Empty>Во вкладке «07 Трекер целей» целей нет.</Empty> : null}
                {d.goals.slice(0, 5).map((g, i) => (
                  <div key={i} className="grid gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium">{g.goal}</div>
                      {g.status ? <StatusBadge status={g.status} /> : null}
                    </div>
                    {g.progress !== null ? (
                      <div className="flex items-center gap-2">
                        <Progress value={Math.max(0, Math.min(100, g.progress * 100))} className="flex-1" />
                        <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{fmtPct(g.progress)}</span>
                      </div>
                    ) : null}
                    <div className="text-xs text-muted-foreground">
                      {[g.fact !== null && g.plan !== null ? `${fmtInt(g.fact)} из ${fmtInt(g.plan)}` : null, g.deadline ? `до ${fmtDate(g.deadline)}` : g.deadlineText || null]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {g.nextAction ? <div className="text-xs">→ {g.nextAction}</div> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-2">
            <SectionTitle action={<Link className="text-sm text-muted-foreground hover:text-foreground" href={`/projects/${slug}/content?when=upcoming`}>План →</Link>}>
              Ближайшие публикации
            </SectionTitle>
            <Card>
              <CardContent className="grid gap-3">
                {next.length === 0 ? <Empty>В контент-плане нет запланированных публикаций с сегодняшней даты.</Empty> : null}
                {next.map((p) => (
                  <div key={p.row} className="flex items-start gap-3">
                    <div className="w-12 shrink-0 text-sm font-medium tabular-nums">{fmtDate(p.date).slice(0, 5)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">{p.idea}</div>
                      <div className="text-xs text-muted-foreground">{[p.goal, p.hypothesis].filter(Boolean).join(" · ")}</div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-2">
            <SectionTitle action={<Link className="text-sm text-muted-foreground hover:text-foreground" href={`/projects/${slug}/hypotheses`}>Гипотезы →</Link>}>
              Гипотезы и тесты
            </SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card>
                <CardContent className="grid gap-1.5">
                  <div className="text-sm font-medium">Гипотезы ({d.hypotheses.length})</div>
                  {decisions.length === 0 ? <Empty>Нет гипотез.</Empty> : null}
                  {decisions.map((s) => (
                    <div key={s.label} className="flex justify-between text-sm">
                      <span>{s.label}</span>
                      <span className="tabular-nums text-muted-foreground">{s.count}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="grid gap-1.5">
                  <div className="text-sm font-medium">Сценарии в лаборатории ({d.lab.length})</div>
                  {labStatuses.length === 0 ? <Empty>Нет сценариев.</Empty> : null}
                  {labStatuses.map((s) => (
                    <div key={s.label} className="flex justify-between text-sm">
                      <span>{s.label}</span>
                      <span className="tabular-nums text-muted-foreground">{s.count}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
