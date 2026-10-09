/** Ссылка на Google-таблицу проекта → ID таблицы. Принимает только docs.google.com/spreadsheets. */
export function parseSheetLink(raw: string): { url: string; id: string } | null {
  const v = raw.trim();
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.hostname !== "docs.google.com") return null;
  const m = u.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]{20,100})(\/|$)/);
  if (!m) return null;
  return { url: `https://docs.google.com/spreadsheets/d/${m[1]}/edit`, id: m[1] };
}
