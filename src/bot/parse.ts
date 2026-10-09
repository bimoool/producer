import { addDaysISO, weekdayISO } from "@/lib/domain/dates";

export type TaskDraft = { title: string; dueDate: string | null };

const WEEKDAYS: Record<string, number> = {
  "в понедельник": 1, "понедельник": 1,
  "во вторник": 2, "вторник": 2,
  "в среду": 3, "среду": 3, "среда": 3,
  "в четверг": 4, "четверг": 4,
  "в пятницу": 5, "пятницу": 5, "пятница": 5,
  "в субботу": 6, "субботу": 6, "суббота": 6,
  "в воскресенье": 0, "воскресенье": 0,
};

function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Разбирает свободный текст: «Завтра написать клиенту по YouTube» →
 * { title: "Написать клиенту по YouTube", dueDate: завтра }.
 * Дата распознаётся только в начале или в конце фразы; иначе срок не ставится.
 */
export function parseTaskText(raw: string, today: string): TaskDraft {
  let text = raw.trim().replace(/\s+/g, " ");
  let dueDate: string | null = null;

  const rules: { re: RegExp; date: (m: RegExpMatchArray) => string | null }[] = [
    { re: /^(сегодня)[,:]?\s+|\s+(сегодня)$/i, date: () => today },
    { re: /^(послезавтра)[,:]?\s+|\s+(послезавтра)$/i, date: () => addDaysISO(today, 2) },
    { re: /^(завтра)[,:]?\s+|\s+(завтра)$/i, date: () => addDaysISO(today, 1) },
    {
      re: /^(?:до\s+)?(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?[,:]?\s+|\s+(?:до\s+)?(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/i,
      date: (m) => {
        const d = Number(m[1] ?? m[4]);
        const mo = Number(m[2] ?? m[5]);
        let y = Number(m[3] ?? m[6] ?? today.slice(0, 4));
        if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
        let iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        if (!m[3] && !m[6] && iso < today) {
          y += 1;
          iso = `${y}-${iso.slice(5)}`;
        }
        const check = new Date(iso + "T00:00:00Z");
        return check.getUTCDate() === d ? iso : null;
      },
    },
    {
      re: new RegExp(`^(${Object.keys(WEEKDAYS).join("|")})[,:]?\\s+|\\s+(${Object.keys(WEEKDAYS).join("|")})$`, "i"),
      date: (m) => {
        const target = WEEKDAYS[(m[1] ?? m[2]).toLowerCase()];
        const diff = (target - weekdayISO(today) + 7) % 7 || 7;
        return addDaysISO(today, diff);
      },
    },
  ];

  for (const r of rules) {
    const m = text.match(r.re);
    if (!m) continue;
    const date = r.date(m);
    if (!date) continue;
    dueDate = date;
    text = text.replace(r.re, " ").trim();
    break;
  }
  return { title: capitalize(text), dueDate };
}

export function parseAllowlist(raw: string | undefined): Set<number> {
  return new Set(
    (raw ?? "")
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s))
      .map(Number),
  );
}
