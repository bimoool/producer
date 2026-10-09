import { addDaysISO, diffDaysISO, formatRu, weekdayISO } from "./dates";
import { DECLARATION_STATUS, type DeclarationStatus, UNCONFIRMED } from "./labels";
import { computeProgress, formatProgress } from "./progress";
import { z } from "zod";

export const reportStatusSchema = z.enum(["done", "in_progress", "partial", "not_done", "unconfirmed"]);
export type ReportItemStatus = z.infer<typeof reportStatusSchema>;

const text = z.string().max(5000).default("");

export const reportFieldsSchema = z.object({
  declaration: z
    .array(
      z.object({
        itemId: z.string(),
        title: z.string(),
        status: reportStatusSchema.default("unconfirmed"),
        progressText: z.string().default(""),
        comment: text,
      }),
    )
    .default([]),
  focus: text,
  done: text,
  stuck: text,
  nextPlan: text,
  insight: text,
  includeFinance: z.boolean().default(false),
  finance: z
    .object({ cycleMonth: text, netProfit: text, revenue: text, avgCheck: text })
    .default({ cycleMonth: "", netProfit: "", revenue: "", avgCheck: "" }),
  extraBusiness: z
    .object({ name: text, netProfit: text, note: text })
    .default({ name: "", netProfit: "", note: "" }),
  stateScore: z.number().int().min(1).max(10).nullable().default(null),
  stateWhy: text,
  mentorQuestion: text,
  helpNeeded: text,
  idea: text,
});
export type ReportFields = z.infer<typeof reportFieldsSchema>;

export type ReportPeriod = { weekNumber: number; periodStart: string; periodEnd: string };

/**
 * Отчётная неделя заканчивается в пятницу включительно (день отчёта).
 * Неделя 1: от начала цикла до первой пятницы после него
 * (для цикла с 02.10.2026 — 02.10–09.10, как в отправленном отчёте).
 * Далее — суббота…пятница.
 */
export function reportPeriodFor(reportDay: string, cycleStart: string): ReportPeriod {
  const back = (weekdayISO(reportDay) - 5 + 7) % 7;
  const friday = addDaysISO(reportDay, -back);
  const toFirstFriday = (5 - weekdayISO(cycleStart) + 7) % 7 || 7;
  const firstFriday = addDaysISO(cycleStart, toFirstFriday);
  const weekNumber = Math.floor(diffDaysISO(friday, firstFriday) / 7) + 1;
  const periodStart = weekNumber === 1 ? cycleStart : addDaysISO(friday, -6);
  return { weekNumber, periodStart, periodEnd: friday };
}

/** Последний отчёт месяца: следующая пятница уже в другом месяце. */
export function isLastReportOfMonth(periodEnd: string): boolean {
  return addDaysISO(periodEnd, 7).slice(0, 7) !== periodEnd.slice(0, 7);
}

export type DeclarationItemInput = {
  id: string;
  originalText: string;
  status: string | null;
  currentValue: number | null;
  targetValue: number;
  unit: string;
};

export function itemStatusFromDb(status: string | null): ReportItemStatus {
  return status && status in DECLARATION_STATUS ? (status as DeclarationStatus) : "unconfirmed";
}

/** Подставляет известные данные. Ничего не выдумывает: неизвестное остаётся пустым. */
export function prefillReport(input: {
  items: DeclarationItemInput[];
  completedTaskTitles: string[];
  nextWeekTaskTitles: string[];
  periodEnd: string;
}): ReportFields {
  const base = reportFieldsSchema.parse({});
  return {
    ...base,
    declaration: input.items.map((i) => ({
      itemId: i.id,
      title: i.originalText,
      status: itemStatusFromDb(i.status),
      progressText:
        i.currentValue === null ? "" : formatProgress(computeProgress(i.currentValue, i.targetValue), i.unit),
      comment: "",
    })),
    done: input.completedTaskTitles.map((t) => `— ${t}`).join("\n"),
    nextPlan: input.nextWeekTaskTitles.map((t) => `— ${t}`).join("\n"),
    includeFinance: isLastReportOfMonth(input.periodEnd),
  };
}

function statusLabel(s: ReportItemStatus): string {
  return s === "unconfirmed" ? UNCONFIRMED : DECLARATION_STATUS[s];
}

function line(label: string, value: string): string {
  const v = value.trim();
  if (!v) return `${label}:`;
  return v.includes("\n") ? `${label}:\n${v}` : `${label}: ${v}`;
}

export function renderReport(period: ReportPeriod, f: ReportFields): string {
  const out: string[] = [];
  out.push(`ОТЧЁТ ЗА ${period.weekNumber} НЕДЕЛЮ`);
  out.push(`Период: ${formatRu(period.periodStart)}–${formatRu(period.periodEnd)}`);
  out.push("");
  out.push("1. Статус по декларации");
  out.push("");
  if (f.declaration.length === 0) out.push(UNCONFIRMED);
  f.declaration.forEach((d, idx) => {
    let s = `${idx + 1}) ${d.title} — ${statusLabel(d.status)}`;
    if (d.progressText.trim()) s += `; ${d.progressText.trim()}`;
    out.push(s);
    if (d.comment.trim()) out.push(`   ${d.comment.trim()}`);
  });
  out.push("");
  out.push("2. Работа за неделю");
  out.push("");
  out.push(line("Фокус", f.focus));
  out.push(line("Что сделал", f.done));
  out.push(line("Где застрял / что не сработало", f.stuck));
  out.push(line("План на следующую неделю", f.nextPlan));
  out.push(line("Главный инсайт", f.insight));
  out.push("");
  out.push("3. Финансы за месяц");
  out.push("");
  if (f.includeFinance) {
    out.push(line("Месяц цикла", f.finance.cycleMonth));
    out.push(line("Чистая прибыль", f.finance.netProfit));
    out.push(line("Выручка", f.finance.revenue));
    out.push(line("Средний чек", f.finance.avgCheck));
  } else {
    out.push("Заполняется в последнем отчёте месяца.");
  }
  out.push("");
  out.push("4. Дополнительный бизнес");
  out.push("");
  out.push(line("Название", f.extraBusiness.name));
  out.push(line("Чистая прибыль за месяц", f.extraBusiness.netProfit));
  out.push(line("Заметка / инвестиции в проект", f.extraBusiness.note));
  out.push("");
  out.push("5. Состояние");
  out.push("");
  const score = f.stateScore === null ? "" : `${f.stateScore}/10`;
  const why = f.stateWhy.trim();
  out.push(line("Оценка", [score, why].filter(Boolean).join(" — ")));
  out.push("");
  out.push("6. Обратная связь, вызовы, идеи");
  out.push("");
  out.push(line("Вопрос наставнику", f.mentorQuestion));
  out.push(line("С чем нужна помощь", f.helpNeeded));
  out.push(line("Идея", f.idea));
  return out.join("\n");
}
