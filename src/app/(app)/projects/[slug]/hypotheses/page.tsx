import { SheetStatus } from "@/components/app/sheet-status";
import { Empty, ExtLink, Field, SectionTitle, StatusBadge } from "@/components/app/sheet-ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { workspacePage } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { fmtDate, fmtInt, fmtPct } from "@/lib/sheets/format";
import { countBy } from "@/lib/sheets/insights";
import { loadSheetState } from "@/lib/sheets/page-data";

export default async function HypothesesPage({ params, searchParams }: PageProps<"/projects/[slug]/hypotheses">) {
  const { slug } = await params;
  const { workspace, isOwner, role } = await workspacePage(slug, "workspace.view");
  const state = await loadSheetState(workspace);
  const sp = await searchParams;
  const d = state.data;
  const decisions = d ? countBy(d.hypotheses, (h) => h.decision, "Без решения") : [];
  const decision = typeof sp.decision === "string" ? sp.decision : "";
  const hyps = d ? (decision ? d.hypotheses.filter((h) => (h.decision || "Без решения") === decision) : d.hypotheses) : [];

  return (
    <div className="grid gap-5">
      <SheetStatus state={state} workspaceId={workspace.id} sheetUrl={workspace.sheetUrl} canManage={can({ isOwner, role }, "workspace.manage")} slug={slug} />
      {!d ? null : (
        <>
          <section className="grid gap-2">
            <SectionTitle>Цели ({d.goals.length})</SectionTitle>
            {d.goals.length === 0 ? <Empty>Во вкладке «07 Трекер целей» целей нет.</Empty> : null}
            <div className="grid gap-3">
              {d.goals.map((g, i) => (
                <Card key={i} className="gap-3">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium">{g.goal}</div>
                      {g.status ? <StatusBadge status={g.status} /> : null}
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    {g.progress !== null ? (
                      <div className="flex items-center gap-2">
                        <Progress value={Math.max(0, Math.min(100, g.progress * 100))} className="flex-1" />
                        <span className="w-12 text-right text-sm tabular-nums">{fmtPct(g.progress)}</span>
                      </div>
                    ) : null}
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <Field label="Старт">{fmtInt(g.start)}</Field>
                      <Field label="Факт">{fmtInt(g.fact)}</Field>
                      <Field label="План">{fmtInt(g.plan)}</Field>
                    </div>
                    <Field label="Дедлайн">{g.deadline ? fmtDate(g.deadline) : g.deadlineText}</Field>
                    <Field label="Следующее действие">{g.nextAction}</Field>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="grid gap-2">
            <SectionTitle>Гипотезы ({d.hypotheses.length})</SectionTitle>
            {decisions.length > 1 ? (
              <nav className="-mx-4 overflow-x-auto px-4">
                <ul className="flex w-max gap-1.5">
                  {[{ label: "", count: d.hypotheses.length }, ...decisions].map((s) => (
                    <li key={s.label || "all"}>
                      <a
                        href={s.label ? `?decision=${encodeURIComponent(s.label)}` : "?"}
                        className={`block rounded-full border px-3 py-1 text-sm whitespace-nowrap ${decision === s.label ? "bg-foreground text-background" : "text-muted-foreground"}`}
                      >
                        {s.label || "Все"} · {s.count}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
            {hyps.length === 0 ? <Empty>Во вкладке «04 Гипотезы» нет записей.</Empty> : null}
            <div className="grid gap-3">
              {hyps.map((h, i) => (
                <Card key={h.id || i} className="gap-3">
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {h.id ? <Badge variant="outline">{h.id}</Badge> : null}
                      {h.direction ? <span className="text-xs text-muted-foreground">{h.direction}</span> : null}
                      <span className="ml-auto">
                        <StatusBadge status={h.decision} />
                      </span>
                    </div>
                    <div className="text-sm font-medium leading-snug">{h.hypothesis}</div>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <Field label="Зачем">{h.why}</Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Тест">{[h.testFormat, h.volume].filter(Boolean).join(" · ")}</Field>
                      <Field label="Метрика">{[h.mainMetric, h.secondaryMetric && `доп.: ${h.secondaryMetric}`].filter(Boolean).join(" · ")}</Field>
                    </div>
                    <Field label="Порог успеха">{h.threshold}</Field>
                    <Field label="Результат">{h.result || "ещё нет"}</Field>
                    <Field label="Следующий шаг">{h.nextStep}</Field>
                    {h.evidence || h.confirms ? (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-muted-foreground">Опора: кейс / исследование</summary>
                        <div className="mt-2 grid gap-2">
                          <Field label="Кейс / исследование">{h.evidence}</Field>
                          <Field label="Что подтверждает">{h.confirms}</Field>
                          <Field label="Качество опоры">{h.quality}</Field>
                          <ExtLink href={h.sourceUrl}>Источник</ExtLink>
                        </div>
                      </details>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
