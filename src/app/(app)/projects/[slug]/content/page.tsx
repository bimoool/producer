import { SheetStatus } from "@/components/app/sheet-status";
import { Empty, Field, StatusBadge } from "@/components/app/sheet-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { workspacePage } from "@/lib/authz";
import { todayISO } from "@/lib/domain/dates";
import { can } from "@/lib/permissions";
import { fmtDate, fmtInt } from "@/lib/sheets/format";
import { countBy, filterPlan, type PlanFilter } from "@/lib/sheets/insights";
import { loadSheetState } from "@/lib/sheets/page-data";
import type { PlanItem } from "@/lib/sheets/vera-template";

const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

const RESULT_LABELS: [keyof PlanItem["results"], string][] = [
  ["igViews", "IG просмотры"],
  ["igFollows", "IG подписки"],
  ["leads", "Лиды"],
  ["revenue", "Выручка, ₽"],
  ["tgClicks", "TG переходы"],
  ["ytViews", "YT просмотры"],
  ["ytSubs", "YT подписки"],
  ["vkViews", "VK просмотры"],
  ["vkSubs", "VK подписки"],
];

function PlanCard({ p }: { p: PlanItem }) {
  const results = RESULT_LABELS.filter(([k]) => p.results[k] !== null);
  return (
    <Card className="gap-3">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm text-muted-foreground tabular-nums">{p.date ? fmtDate(p.date) : p.dateText || "без даты"}</div>
          <StatusBadge status={p.status} />
        </div>
        <CardTitle className="text-base leading-snug">{p.idea || "Без названия"}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Зачем — цель">{p.goal}</Field>
          <Field label="Для кого">{p.audience}</Field>
          <Field label="Гипотеза">{p.hypothesis}</Field>
          <Field label="CTA">{p.cta}</Field>
        </div>
        {p.contentType || p.tags ? (
          <div className="text-xs text-muted-foreground">{[p.contentType, p.tags].filter(Boolean).join(" · ")}</div>
        ) : null}
        {results.length ? (
          <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/60 p-2">
            {results.map(([k, label]) => (
              <div key={k}>
                <div className="text-[11px] text-muted-foreground">{label}</div>
                <div className="text-sm font-medium tabular-nums">{fmtInt(p.results[k])}</div>
              </div>
            ))}
          </div>
        ) : null}
        <Field label="Вывод / следующий тест">{p.conclusion}</Field>
      </CardContent>
    </Card>
  );
}

export default async function ContentPlanPage({ params, searchParams }: PageProps<"/projects/[slug]/content">) {
  const { slug } = await params;
  const { workspace, isOwner, role } = await workspacePage(slug, "workspace.view");
  const state = await loadSheetState(workspace);
  const sp = await searchParams;
  const plan = state.data?.plan ?? [];
  const today = todayISO();
  const months = [...new Set(plan.map((p) => p.date?.slice(0, 7)).filter((m): m is string => !!m))].sort();
  const statuses = countBy(plan, (p) => p.status);
  const goals = countBy(plan, (p) => p.goal, "Без цели");
  const whenRaw = str(sp.when);
  const f: PlanFilter = {
    status: str(sp.status) || undefined,
    goal: str(sp.goal) || undefined,
    when: whenRaw === "upcoming" || whenRaw === "past" ? whenRaw : "all",
    month: str(sp.month) && months.includes(str(sp.month)!) ? str(sp.month) : undefined,
  };
  const items = filterPlan(plan, f, today);
  const filtered = !!(f.status || f.goal || f.month || f.when !== "all");

  return (
    <div className="grid gap-4">
      <SheetStatus state={state} workspaceId={workspace.id} sheetUrl={workspace.sheetUrl} canManage={can({ isOwner, role }, "workspace.manage")} slug={slug} />
      {state.data ? (
        <>
          <form className="grid grid-cols-2 gap-2 sm:grid-cols-4" method="get">
            <NativeSelect name="status" defaultValue={f.status ?? ""} aria-label="Статус">
              <NativeSelectOption value="">Все статусы</NativeSelectOption>
              {statuses.map((s) => (
                <NativeSelectOption key={s.label} value={s.label}>
                  {s.label} ({s.count})
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect name="goal" defaultValue={f.goal ?? ""} aria-label="Цель">
              <NativeSelectOption value="">Все цели</NativeSelectOption>
              {goals.map((s) => (
                <NativeSelectOption key={s.label} value={s.label}>
                  {s.label} ({s.count})
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect name="when" defaultValue={f.when} aria-label="Период">
              <NativeSelectOption value="all">Все даты</NativeSelectOption>
              <NativeSelectOption value="upcoming">С сегодня</NativeSelectOption>
              <NativeSelectOption value="past">Прошедшие</NativeSelectOption>
            </NativeSelect>
            <NativeSelect name="month" defaultValue={f.month ?? ""} aria-label="Месяц">
              <NativeSelectOption value="">Любой месяц</NativeSelectOption>
              {months.map((m) => (
                <NativeSelectOption key={m} value={m}>
                  {monthLabel(m)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <div className="col-span-2 flex gap-2 sm:col-span-4">
              <Button type="submit" size="sm">
                Показать
              </Button>
              {filtered ? (
                <Button asChild size="sm" variant="ghost">
                  <a href={`/projects/${slug}/content`}>Сбросить</a>
                </Button>
              ) : null}
              <span className="ml-auto self-center text-sm text-muted-foreground">
                {items.length} из {plan.length}
              </span>
            </div>
          </form>
          {items.length === 0 ? <Empty>{plan.length ? "Ничего не найдено — измените фильтры." : "Во вкладке «08 Контент-план» пока нет записей."}</Empty> : null}
          <div className="grid gap-3">
            {items.map((p) => (
              <PlanCard key={p.row} p={p} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
