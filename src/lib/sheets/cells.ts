/**
 * Разбор значений ячеек Google Sheets.
 * Значения приходят из API с valueRenderOption=UNFORMATTED_VALUE и
 * dateTimeRenderOption=SERIAL_NUMBER: числа — числами, проценты — долями (0.0833),
 * даты — серийными номерами, формулы — вычисленным результатом.
 * Но ячейку могли заполнить текстом («6 496», «8,33%», «04.10.2026») — разбираем и его.
 */
export type Cell = string | number | boolean | null | undefined;

const ERROR_RE = /^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!|ERROR!)/i;

/** Текст ячейки без лишних пробелов; пустое и ошибки формул → "". */
export function text(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "да" : "нет";
  const s = v.replace(/ /g, " ").trim();
  return ERROR_RE.test(s) ? "" : s;
}

/** Число из ячейки. «6 496», «1,97», «124 050 ₽», «−5» → число; пусто/ошибка/текст → null. */
export function num(v: Cell): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = text(v);
  if (!s) return null;
  let t = s.replace(/[\s  ]/g, "").replace(/[₽$€]|руб\.?|rub/gi, "").replace(/[−–]/g, "-");
  const pct = t.endsWith("%");
  if (pct) t = t.slice(0, -1);
  // «1,97» и «1 234,5» — запятая как десятичный разделитель; «1,234.5» — запятая тысяч
  if (t.includes(",") && t.includes(".")) t = t.replace(/,/g, "");
  else t = t.replace(",", ".");
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return pct ? n / 100 : n;
}

/** Доля (0..1) из ячейки: 0.0833 или «8,33%». Число > 1 без знака % трактуется как проценты. */
export function fraction(v: Cell): number | null {
  if (typeof v === "string" && text(v).endsWith("%")) return num(v);
  const n = num(v);
  if (n === null) return null;
  return Math.abs(n) > 1 ? n / 100 : n;
}

const MS_DAY = 86_400_000;
const SHEETS_EPOCH = Date.UTC(1899, 11, 30);

function iso(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** Дата (YYYY-MM-DD) из ячейки: серийный номер, «2026-10-04», «2026-07-08T00:00:00», «04.10.2026», «4.10». */
export function date(v: Cell, fallbackYear?: number): string | null {
  if (typeof v === "number") {
    // разумный диапазон серийных дат: 2000–2100
    if (v < 36526 || v > 73051) return null;
    return new Date(SHEETS_EPOCH + Math.floor(v) * MS_DAY).toISOString().slice(0, 10);
  }
  const s = text(v);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ][\d:.]+Z?)?$/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?:\s.*)?$/);
  if (m) {
    let y = m[3] ? +m[3] : fallbackYear;
    if (!y) return null;
    if (y < 100) y += 2000;
    return iso(y, +m[2], +m[1]);
  }
  return null;
}

/** Ссылка только http(s); иначе null (никаких javascript: и т. п.). */
export function url(v: Cell): string | null {
  const s = text(v);
  if (!s) return null;
  const m = s.match(/https?:\/\/\S+/);
  if (!m) return null;
  try {
    const u = new URL(m[0]);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Нормализация заголовка для сопоставления столбцов: регистр, пробелы, переносы. */
export function headerKey(v: Cell): string {
  return text(v).toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}
