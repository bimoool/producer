/**
 * Чтение Google Sheets через сервисный аккаунт (только чтение).
 * Ключ — в переменной окружения, в репозитории не хранится:
 *   GOOGLE_SERVICE_ACCOUNT_JSON — JSON ключа целиком или он же в base64.
 * Таблица должна быть открыта сервисному аккаунту с правом «Читатель».
 */
import { JWT } from "google-auth-library";
import type { Rows } from "./table";

export const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const API = "https://sheets.googleapis.com/v4/spreadsheets";

export type ServiceAccount = { client_email: string; private_key: string };

export function loadServiceAccount(raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON): ServiceAccount | null {
  const v = raw?.trim();
  if (!v) return null;
  try {
    const json = v.startsWith("{") ? v : Buffer.from(v, "base64").toString("utf8");
    const parsed = JSON.parse(json) as Partial<ServiceAccount>;
    if (typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") return null;
    if (!parsed.private_key.includes("PRIVATE KEY")) return null;
    return { client_email: parsed.client_email, private_key: parsed.private_key };
  } catch {
    return null;
  }
}

export class SheetsError extends Error {
  constructor(
    readonly kind: "not_configured" | "no_access" | "not_found" | "unavailable" | "bad_response",
    message: string,
  ) {
    super(message);
  }
}

export type SheetsDeps = {
  getToken: () => Promise<string>;
  fetch: typeof fetch;
};

export function defaultDeps(sa: ServiceAccount): SheetsDeps {
  const jwt = new JWT({ email: sa.client_email, key: sa.private_key, scopes: [SHEETS_SCOPE] });
  return {
    getToken: async () => {
      const { token } = await jwt.getAccessToken();
      if (!token) throw new SheetsError("unavailable", "Google не выдал токен доступа");
      return token;
    },
    fetch: globalThis.fetch,
  };
}

async function call(deps: SheetsDeps, path: string, email: string): Promise<unknown> {
  let token: string;
  try {
    token = await deps.getToken();
  } catch (e) {
    if (e instanceof SheetsError) throw e;
    // текст ошибки Google может содержать детали ключа — не пробрасываем
    throw new SheetsError("unavailable", "Не удалось авторизоваться в Google (проверьте ключ сервисного аккаунта)");
  }
  let res: Response;
  try {
    res = await deps.fetch(`${API}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    throw new SheetsError("unavailable", "Google Sheets временно недоступен");
  }
  if (res.status === 403) {
    throw new SheetsError("no_access", `Нет доступа к таблице. Откройте её для ${email} с правом «Читатель».`);
  }
  if (res.status === 404) throw new SheetsError("not_found", "Таблица не найдена — проверьте ссылку в настройках проекта");
  if (res.status === 429 || res.status >= 500) throw new SheetsError("unavailable", `Google Sheets временно недоступен (${res.status})`);
  if (!res.ok) throw new SheetsError("bad_response", `Google Sheets ответил ошибкой ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new SheetsError("bad_response", "Некорректный ответ Google Sheets");
  }
}

/** Названия вкладок → значения. Отсутствующие вкладки просто не попадают в ответ. */
export async function readTabs(
  spreadsheetId: string,
  titles: readonly string[],
  deps: SheetsDeps,
  email: string,
): Promise<{ values: Record<string, Rows>; title: string }> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(spreadsheetId)) throw new SheetsError("not_found", "Некорректный ID таблицы");
  const id = encodeURIComponent(spreadsheetId);
  const meta = (await call(deps, `${id}?fields=properties.title,sheets.properties.title`, email)) as {
    properties?: { title?: string };
    sheets?: { properties?: { title?: string } }[];
  };
  const existing = (meta.sheets ?? []).map((s) => s.properties?.title ?? "");
  const norm = (s: string) => s.trim().toLowerCase();
  const wanted = titles
    .map((t) => existing.find((e) => norm(e) === norm(t)))
    .filter((t): t is string => !!t);
  const values: Record<string, Rows> = {};
  if (wanted.length) {
    const qs = new URLSearchParams({ valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "SERIAL_NUMBER", majorDimension: "ROWS" });
    for (const t of wanted) qs.append("ranges", `'${t.replace(/'/g, "''")}'`);
    const data = (await call(deps, `${id}/values:batchGet?${qs}`, email)) as { valueRanges?: { values?: Rows }[] };
    const ranges = data.valueRanges ?? [];
    if (ranges.length !== wanted.length) throw new SheetsError("bad_response", "Google вернул не все вкладки");
    wanted.forEach((t, i) => {
      const requested = titles.find((x) => norm(x) === norm(t))!;
      values[requested] = ranges[i].values ?? [];
    });
  }
  return { values, title: meta.properties?.title ?? "" };
}
