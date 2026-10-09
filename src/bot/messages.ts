import { formatRu } from "@/lib/domain/dates";
import { computeProgress, formatProgress } from "@/lib/domain/progress";

type T = { title: string; dueDate: string | null; status: string; priority: string };

export function taskList(title: string, tasks: T[], empty: string, max = 10): string {
  if (tasks.length === 0) return `${title}\n\n${empty}`;
  const lines = tasks.slice(0, max).map((t) => {
    const mark = t.status === "blocked" ? "⛔" : t.priority === "high" ? "❗" : "•";
    return `${mark} ${t.title}${t.dueDate ? ` — ${formatRu(t.dueDate)}` : ""}`;
  });
  if (tasks.length > max) lines.push(`…и ещё ${tasks.length - max}`);
  return `${title}\n\n${lines.join("\n")}`;
}

export function goalsMessage(
  items: { shortTitle: string; currentValue: number | null; targetValue: number; unit: string }[],
  goals: { title: string; currentValue: number | null; targetValue: number | null; unit: string | null }[],
): string {
  const out = ["Декларация:"];
  for (const i of items) out.push(`• ${i.shortTitle}: ${formatProgress(computeProgress(i.currentValue, i.targetValue), i.unit)}`);
  out.push("", "Цели вне декларации:");
  if (goals.length === 0) out.push("—");
  for (const g of goals) {
    out.push(`• ${g.title}${g.targetValue ? `: ${formatProgress(computeProgress(g.currentValue, g.targetValue), g.unit ?? "")}` : ""}`);
  }
  return out.join("\n");
}

/** Telegram ограничивает сообщение 4096 символами. */
export function splitMessage(text: string, limit = 4000): string[] {
  const parts: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf("\n", limit);
    if (cut < limit / 2) cut = limit;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, "");
  }
  parts.push(rest);
  return parts;
}
