import { formatInTimeZone } from "@/lib/domain/format";

const FIELD_LABELS: Record<string, string> = {
  title: "название",
  status: "статус",
  priority: "приоритет",
  due_date: "срок",
  goal_id: "цель",
  declaration_item_id: "обязательство",
  project_id: "проект",
  parent_task_id: "родительская задача",
  description: "описание",
  result: "результат",
  completed_at: "завершена",
  current_value: "прогресс",
  target_value: "целевое значение",
  deadline: "срок",
  body: "комментарий",
  value: "значение",
  fields: "поля",
  content: "текст",
  amount: "сумма",
  personal_profit: "личная прибыль",
  original_text: "оригинал отчёта",
  client: "клиент",
};

const ENTITY_LABELS: Record<string, string> = {
  tasks: "Задача",
  goals: "Цель",
  projects: "Проект",
  declaration_items: "Обязательство",
  progress_updates: "Прогресс",
  task_comments: "Комментарий",
  weekly_reports: "Отчёт",
  deals: "Сделка",
};

export type LogEntry = {
  id: number;
  entityType: string;
  action: string;
  changes: unknown;
  createdAt: Date;
};

export function describeEntry(e: LogEntry): string {
  const entity = ENTITY_LABELS[e.entityType] ?? e.entityType;
  const ch = (e.changes ?? {}) as Record<string, unknown>;
  const name =
    typeof ch.client === "string" && typeof ch.title === "string"
      ? ` «${ch.client}: ${ch.title}»`
      : typeof ch.title === "string"
        ? ` «${ch.title}»`
        : typeof ch.short_title === "string"
          ? ` «${ch.short_title}»`
          : "";
  if (e.action === "create") {
    if (e.entityType === "progress_updates") return `Прогресс обновлён: ${String(ch.value)}`;
    if (e.entityType === "task_comments") return "Добавлен комментарий";
    return `${entity} создан(а)${name}`;
  }
  if (e.action === "delete") return `${entity} удалён(а)${name}`;
  const fields = Object.keys(ch)
    .filter((k) => k !== "updated_at")
    .map((k) => FIELD_LABELS[k] ?? k);
  if (e.entityType === "tasks" && (ch.status as { to?: string } | undefined)?.to === "done") return "Задача выполнена";
  return `${entity}: изменено — ${fields.join(", ")}`;
}

export function HistoryList({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Изменений пока нет.</p>;
  return (
    <ul className="grid gap-2 text-sm">
      {entries.map((e) => (
        <li key={e.id} className="flex gap-3">
          <span className="shrink-0 text-muted-foreground tabular-nums">{formatInTimeZone(e.createdAt)}</span>
          <span>{describeEntry(e)}</span>
        </li>
      ))}
    </ul>
  );
}
