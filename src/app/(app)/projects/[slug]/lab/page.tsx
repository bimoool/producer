import { ChevronDownIcon } from "lucide-react";
import { SheetStatus } from "@/components/app/sheet-status";
import { Empty, ExtLink, Field, StatusBadge } from "@/components/app/sheet-ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { workspacePage } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { fmtDate, fmtDec, fmtInt, fmtPct } from "@/lib/sheets/format";
import { countBy } from "@/lib/sheets/insights";
import { loadSheetState } from "@/lib/sheets/page-data";
import type { LabScenario } from "@/lib/sheets/vera-template";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-t pt-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function hasFact(s: LabScenario) {
  const f = s.fact;
  return [f.views, f.reach, f.follows, f.saves, f.shares, f.leads, f.revenue].some((v) => v !== null) || !!f.retention;
}

function Scenario({ s }: { s: LabScenario }) {
  const f = s.fact;
  return (
    <Card className="gap-0 py-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              {s.test ? <Badge variant="outline">{s.test}</Badge> : null}
              {s.branch ? <span className="text-xs text-muted-foreground">{s.branch}</span> : null}
            </div>
            <div className="text-sm font-medium leading-snug">{s.hookA || s.hypothesis || "Сценарий без хука"}</div>
            {s.goal ? <div className="mt-0.5 text-xs text-muted-foreground">Цель: {s.goal}</div> : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <StatusBadge status={s.status} />
            <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </div>
        </summary>
        <CardContent className="grid gap-3 px-4 pb-4">
          <Block title="Зачем: гипотеза">
            <Field label="Гипотеза">{s.hypothesis}</Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Цель">{s.goal}</Field>
              <Field label="Аудитория">{s.audience}</Field>
            </div>
            <Field label="Реальная опора">{s.basis}</Field>
            <Field label="Урок / конфликт">{s.lesson}</Field>
          </Block>
          <Block title="Что снимаем: хук">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Hook A">{s.hookA}</Field>
              <Field label="Hook B">{s.hookB}</Field>
            </div>
          </Block>
          {s.beats.length || s.payoff ? (
            <Block title="Драматургия">
              <ol className="grid gap-2">
                {s.beats.map((b) => (
                  <li key={b.label} className="flex gap-3 text-sm">
                    <span className="w-12 shrink-0 font-medium tabular-nums text-muted-foreground">{b.label}</span>
                    <span className="whitespace-pre-wrap">{b.text}</span>
                  </li>
                ))}
                {s.payoff ? (
                  <li className="flex gap-3 text-sm">
                    <span className="w-12 shrink-0 font-medium text-muted-foreground">Payoff</span>
                    <span className="whitespace-pre-wrap">{s.payoff}</span>
                  </li>
                ) : null}
              </ol>
            </Block>
          ) : null}
          <Block title="CTA и метрика успеха">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="CTA">{[s.cta, s.ctaType && `(${s.ctaType})`].filter(Boolean).join(" ")}</Field>
              <Field label="Метрика успеха">{[s.mainMetric, s.threshold && `порог: ${s.threshold}`].filter(Boolean).join(" · ")}</Field>
            </div>
          </Block>
          {hasFact(s) ? (
            <Block title={`Что получилось${f.date ? ` · ${fmtDate(f.date)}` : ""}`}>
              <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/60 p-2 text-sm">
                {(
                  [
                    ["Просмотры", fmtInt(f.views)],
                    ["Охват", fmtInt(f.reach)],
                    ["Подписки", fmtInt(f.follows)],
                    ["Сохранения", fmtInt(f.saves)],
                    ["Репосты", fmtInt(f.shares)],
                    ["Подписки / 1k", fmtDec(f.follows1k)],
                    ["Женщины", fmtPct(f.womenShare)],
                    ["Лиды", fmtInt(f.leads)],
                    ["Удержание", f.retention || "—"],
                  ] as const
                ).map(([l, v]) => (
                  <div key={l}>
                    <div className="text-[11px] text-muted-foreground">{l}</div>
                    <div className="font-medium tabular-nums">{v}</div>
                  </div>
                ))}
              </div>
            </Block>
          ) : null}
          {s.result || s.decision || s.nextTest ? (
            <Block title="Решение и следующий тест">
              <Field label="Результат">{s.result}</Field>
              <Field label="Решение">{s.decision}</Field>
              <Field label="Следующий тест">{s.nextTest}</Field>
            </Block>
          ) : null}
          {s.humanizer || s.note ? (
            <Block title="Примечания">
              <Field label="Humanizer">{s.humanizer}</Field>
              <Field label="Ссылка / примечание">{s.link ? null : s.note}</Field>
              <ExtLink href={s.link}>Открыть ссылку</ExtLink>
            </Block>
          ) : null}
        </CardContent>
      </details>
    </Card>
  );
}

export default async function LabPage({ params, searchParams }: PageProps<"/projects/[slug]/lab">) {
  const { slug } = await params;
  const { workspace, isOwner, role } = await workspacePage(slug, "workspace.view");
  const state = await loadSheetState(workspace);
  const sp = await searchParams;
  const lab = state.data?.lab ?? [];
  const statuses = countBy(lab, (s) => s.status);
  const status = typeof sp.status === "string" ? sp.status : "";
  const items = status ? lab.filter((s) => (s.status || "Без статуса") === status) : lab;
  return (
    <div className="grid gap-4">
      <SheetStatus state={state} workspaceId={workspace.id} sheetUrl={workspace.sheetUrl} canManage={can({ isOwner, role }, "workspace.manage")} slug={slug} />
      {state.data ? (
        <>
          {statuses.length > 1 ? (
            <nav className="-mx-4 overflow-x-auto px-4">
              <ul className="flex w-max gap-1.5">
                {[{ label: "", count: lab.length }, ...statuses].map((s) => (
                  <li key={s.label || "all"}>
                    <a
                      href={s.label ? `?status=${encodeURIComponent(s.label)}` : "?"}
                      className={`block rounded-full border px-3 py-1 text-sm whitespace-nowrap ${status === s.label ? "bg-foreground text-background" : "text-muted-foreground"}`}
                    >
                      {s.label || "Все"} · {s.count}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          {items.length === 0 ? <Empty>Во вкладке «10 Лаборатория Reels» пока нет сценариев.</Empty> : null}
          <div className="grid gap-3">
            {items.map((s) => (
              <Scenario key={s.row} s={s} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
