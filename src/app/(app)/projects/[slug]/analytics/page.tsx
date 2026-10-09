import { SheetStatus } from "@/components/app/sheet-status";
import { Empty, ExtLink, Field, SectionTitle, Stat, StatusBadge } from "@/components/app/sheet-ui";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { workspacePage } from "@/lib/authz";
import { todayISO } from "@/lib/domain/dates";
import { can } from "@/lib/permissions";
import { fmtDate, fmtDec, fmtInt, fmtPct } from "@/lib/sheets/format";
import { periodTotals, REEL_METRICS, topReels, type ReelMetric } from "@/lib/sheets/insights";
import { loadSheetState } from "@/lib/sheets/page-data";
import type { Highlight } from "@/lib/sheets/vera-template";

function HighlightCard({ h }: { h: Highlight }) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm text-muted-foreground">{fmtDate(h.date)}</div>
          <StatusBadge status={h.status} />
        </div>
        <div className="line-clamp-3 text-sm font-medium">{h.description || "Без описания"}</div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/60 p-2 text-sm">
          {(
            [
              ["Просмотры", fmtInt(h.views)],
              ["Охват", fmtInt(h.reach)],
              ["Подписки", fmtInt(h.follows)],
              ["На 1k охвата", fmtDec(h.follows1k)],
              ["Сохранения", fmtInt(h.saves)],
              ["Репосты", fmtInt(h.shares)],
            ] as const
          ).map(([l, v]) => (
            <div key={l}>
              <div className="text-[11px] text-muted-foreground">{l}</div>
              <div className="font-medium tabular-nums">{v}</div>
            </div>
          ))}
        </div>
        <Field label="Почему важен">{h.why}</Field>
        <Field label="Что повторять">{h.repeat}</Field>
        <Field label="Что НЕ копировать">{h.dontCopy}</Field>
        <Field label="Следующий тест">{h.nextTest}</Field>
        {h.femaleFit || h.womenShare !== null ? (
          <div className="text-xs text-muted-foreground">
            {[h.femaleFit && `Female-fit: ${h.femaleFit}`, h.womenShare !== null && `женщин: ${fmtPct(h.womenShare)}`].filter(Boolean).join(" · ")}
          </div>
        ) : null}
        <ExtLink href={h.url}>Открыть Reel</ExtLink>
      </CardContent>
    </Card>
  );
}

export default async function AnalyticsPage({ params, searchParams }: PageProps<"/projects/[slug]/analytics">) {
  const { slug } = await params;
  const { workspace, isOwner, role } = await workspacePage(slug, "workspace.view");
  const state = await loadSheetState(workspace);
  const sp = await searchParams;
  const d = state.data;
  const metric: ReelMetric = typeof sp.metric === "string" && sp.metric in REEL_METRICS ? (sp.metric as ReelMetric) : "follows";
  const showAll = sp.all === "1";
  const lastDay = d?.daily.at(-1)?.date ?? todayISO();
  const t30 = d ? periodTotals(d.daily, 30, lastDay) : null;
  const t90 = d ? periodTotals(d.daily, 90, lastDay) : null;
  const reels = d ? topReels(d.reels, metric, showAll ? d.reels.length : 15) : [];

  return (
    <div className="grid gap-5">
      <SheetStatus state={state} workspaceId={workspace.id} sheetUrl={workspace.sheetUrl} canManage={can({ isOwner, role }, "workspace.manage")} slug={slug} />
      {!d ? null : (
        <>
          {[t30!, t90!].map((t) => (
            <section key={t.days + t.from} className="grid gap-2">
              <SectionTitle>
                {t === t30 ? "30 дней" : "90 дней"} · {fmtDate(t.from)}–{fmtDate(t.to)}
              </SectionTitle>
              {t.days === 0 ? (
                <Empty>Нет дневной статистики за период.</Empty>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Stat label="Просмотры" value={fmtInt(t.views)} />
                  <Stat label="Охват" value={fmtInt(t.reach)} />
                  <Stat label="Подписки" value={fmtInt(t.follows)} />
                  <Stat label="Конверсия в подписку" value={fmtPct(t.followConversion)} hint="подписки / охват" />
                  <Stat label="Визиты в профиль" value={fmtInt(t.profileVisits)} />
                  <Stat label="Клики по ссылке" value={fmtInt(t.linkClicks)} />
                </div>
              )}
            </section>
          ))}

          <section className="grid gap-2" id="reels">
            <SectionTitle>Reels ({d.reels.length})</SectionTitle>
            <form method="get" action="#reels" className="flex gap-2">
              <NativeSelect name="metric" defaultValue={metric} aria-label="Сортировать по">
                {Object.entries(REEL_METRICS).map(([k, v]) => (
                  <NativeSelectOption key={k} value={k}>
                    Лучшие по: {v}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Button type="submit" size="sm" variant="outline">
                Показать
              </Button>
            </form>
            <Card>
              <CardContent className="divide-y">
                {reels.length === 0 ? <Empty>Во вкладке «01 Все Reels» нет данных.</Empty> : null}
                {reels.map((r, i) => (
                  <div key={(r.url ?? "") + i} className="grid gap-1 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 text-sm">
                        <span className="text-muted-foreground tabular-nums">{fmtDate(r.date)}</span>
                        {r.format ? <span className="text-muted-foreground"> · {r.format}</span> : null}
                        {r.description ? <div className="line-clamp-2">{r.description}</div> : null}
                      </div>
                      <ExtLink href={r.url}>Reel</ExtLink>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
                      <span className={metric === "views" ? "font-medium text-foreground" : ""}>👁 {fmtInt(r.views)}</span>
                      <span className={metric === "reach" ? "font-medium text-foreground" : ""}>охват {fmtInt(r.reach)}</span>
                      <span className={metric === "follows" ? "font-medium text-foreground" : ""}>подписки {fmtInt(r.follows)}</span>
                      <span className={metric === "follows1k" ? "font-medium text-foreground" : ""}>на 1k {fmtDec(r.follows1k)}</span>
                      <span className={metric === "saves" ? "font-medium text-foreground" : ""}>сохр. {fmtInt(r.saves)}</span>
                      <span className={metric === "shares" ? "font-medium text-foreground" : ""}>репосты {fmtInt(r.shares)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            {!showAll && d.reels.length > reels.length ? (
              <a href={`?metric=${metric}&all=1#reels`} className="text-sm text-muted-foreground hover:text-foreground">
                Показать все {d.reels.length} →
              </a>
            ) : null}
          </section>

          <section className="grid gap-2">
            <SectionTitle>Драйверы роста ({d.drivers.length})</SectionTitle>
            {d.drivers.length === 0 ? <Empty>Во вкладке «02 Драйверы роста» нет записей.</Empty> : null}
            <div className="grid gap-3">
              {d.drivers.map((h, i) => (
                <HighlightCard key={(h.url ?? "") + i} h={h} />
              ))}
            </div>
          </section>

          <section className="grid gap-2">
            <SectionTitle>Женская аудитория ({d.female.length})</SectionTitle>
            {d.female.length === 0 ? <Empty>Во вкладке «03 Женская аудитория» нет записей.</Empty> : null}
            <div className="grid gap-3">
              {d.female.map((h, i) => (
                <HighlightCard key={(h.url ?? "") + i} h={h} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
