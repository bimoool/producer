/**
 * Загрузка из Google Sheets: эмуляция API (без сети), запись снимка в БД,
 * сохранение прежних данных при ошибке, защита от частых запросов.
 */
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadServiceAccount, readTabs, type SheetsDeps } from "@/lib/sheets/google";
import { getSnapshotState, syncWorkspaceSheet } from "@/lib/sheets/sync";

const SHEET = "1oUdD1qzRX8mP_6f9pRd-M-hxKmoxOHwNxdLKwfvwgpM";

const TAB_VALUES: Record<string, unknown[][]> = {
  "08 Контент-план": [
    ["КОНТЕНТ-ПЛАН"],
    ["Дата", "Reel / идея", "Главная цель", "CTA", "Аудитория", "Гипотеза", "Тип контента", "Теги", "Статус"],
    [46310, "Ошибки в КБЖУ", "Подписки", "Подпишись", "Женщины", "H03", "Обучающий", "", "Запланирован"],
  ],
  "05 90 дней": [
    ["Дата", "Views", "Reach", "Follows", "Profile visits", "Link clicks"],
    [46299, 1000, 800, 10, 50, 1],
  ],
};

type Call = { url: string; auth: string | null };
function fakeGoogle(opts: { status?: number; tabs?: string[]; fail?: "network" } = {}) {
  const calls: Call[] = [];
  const tabs = opts.tabs ?? Object.keys(TAB_VALUES);
  const deps: SheetsDeps = {
    getToken: async () => "test-token",
    fetch: (async (input: string | URL, init?: RequestInit) => {
      const u = String(input);
      calls.push({ url: u, auth: new Headers(init?.headers).get("authorization") });
      if (opts.fail === "network") throw new TypeError("fetch failed");
      if (opts.status) return new Response("{}", { status: opts.status });
      if (u.includes("values:batchGet")) {
        const ranges = new URL(u).searchParams.getAll("ranges").map((r) => r.slice(1, -1));
        return Response.json({ valueRanges: ranges.map((r) => ({ range: r, values: TAB_VALUES[r] ?? [] })) });
      }
      return Response.json({ properties: { title: "Аналитика Веры" }, sheets: [...tabs, "Справочники"].map((title) => ({ properties: { title } })) });
    }) as typeof fetch,
  };
  return { deps, calls };
}

describe("readTabs (эмуляция Google Sheets API)", () => {
  it("только чтение: GET метаданных и batchGet нужных вкладок, неформатированные значения", async () => {
    const g = fakeGoogle();
    const r = await readTabs(SHEET, ["08 Контент-план", "05 90 дней", "10 Лаборатория Reels"], g.deps, "sa@test");
    expect(r.title).toBe("Аналитика Веры");
    expect(Object.keys(r.values).sort()).toEqual(["05 90 дней", "08 Контент-план"]);
    expect(g.calls).toHaveLength(2);
    expect(g.calls.every((c) => c.auth === "Bearer test-token")).toBe(true);
    const batch = new URL(g.calls[1].url);
    expect(batch.pathname).toBe(`/v4/spreadsheets/${SHEET}/values:batchGet`);
    expect(batch.searchParams.get("valueRenderOption")).toBe("UNFORMATTED_VALUE");
    expect(batch.searchParams.get("dateTimeRenderOption")).toBe("SERIAL_NUMBER");
    expect(batch.searchParams.getAll("ranges")).toEqual(["'08 Контент-план'", "'05 90 дней'"]);
  });
  it("понятные ошибки", async () => {
    await expect(readTabs(SHEET, ["x"], fakeGoogle({ status: 403 }).deps, "sa@test")).rejects.toThrow(/Нет доступа к таблице.*sa@test.*Читатель/);
    await expect(readTabs(SHEET, ["x"], fakeGoogle({ status: 404 }).deps, "sa@test")).rejects.toThrow(/не найдена/);
    await expect(readTabs(SHEET, ["x"], fakeGoogle({ status: 503 }).deps, "sa@test")).rejects.toThrow(/временно недоступен/);
    await expect(readTabs(SHEET, ["x"], fakeGoogle({ fail: "network" }).deps, "sa@test")).rejects.toThrow(/временно недоступен/);
    await expect(readTabs("../../etc", ["x"], fakeGoogle().deps, "sa@test")).rejects.toThrow(/Некорректный ID/);
  });
});

describe("loadServiceAccount", () => {
  const key = { client_email: "sa@proj.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n" };
  it("JSON или base64; мусор — null", () => {
    expect(loadServiceAccount(JSON.stringify(key))?.client_email).toBe(key.client_email);
    expect(loadServiceAccount(Buffer.from(JSON.stringify(key)).toString("base64"))?.client_email).toBe(key.client_email);
    expect(loadServiceAccount("")).toBeNull();
    expect(loadServiceAccount("not json")).toBeNull();
    expect(loadServiceAccount(JSON.stringify({ client_email: "x" }))).toBeNull();
  });
});

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("syncWorkspaceSheet (снимок в БД)", () => {
  const sql = postgres(url!, { max: 1, onnotice: () => {} });
  let ws: { id: string; sheetId: string };
  beforeAll(async () => {
    const [row] = await sql`insert into workspaces (slug, title, sheet_id) values ('t-sheets', 'Тест таблиц', ${SHEET}) returning id`;
    ws = { id: row.id, sheetId: SHEET };
  });
  afterAll(async () => {
    await sql`delete from workspaces where slug = 't-sheets'`;
    await sql.end();
  });

  it("первая синхронизация сохраняет разобранные данные", async () => {
    const r = await syncWorkspaceSheet(ws, fakeGoogle().deps);
    expect(r.ok).toBe(true);
    const s = await getSnapshotState(ws);
    expect(s.data?.plan[0]).toMatchObject({ idea: "Ошибки в КБЖУ", date: "2026-10-15" });
    expect(s.data?.daily[0]).toMatchObject({ date: "2026-10-04", views: 1000 });
    expect(s.data?.warnings).toContain("Нет вкладки «10 Лаборатория Reels»");
    expect(s.syncedAt).not.toBeNull();
    expect(s.lastError).toBeNull();
  });

  it("слишком частое обновление — отказ без обращения к Google", async () => {
    const g = fakeGoogle();
    const r = await syncWorkspaceSheet(ws, g.deps, Date.now());
    expect(r).toMatchObject({ ok: false, throttled: true });
    expect(g.calls).toHaveLength(0);
  });

  it("Google недоступен — ошибка видна, прежние данные сохраняются", async () => {
    const before = await getSnapshotState(ws);
    await sql`update workspace_sheet_snapshots set last_attempt_at = now() - interval '1 hour' where workspace_id = ${ws.id}`;
    const r = await syncWorkspaceSheet(ws, fakeGoogle({ status: 503 }).deps);
    expect(r).toMatchObject({ ok: false });
    const after = await getSnapshotState(ws);
    expect(after.lastError).toMatch(/временно недоступен/);
    expect(after.data).toEqual(before.data);
    expect(after.syncedAt).toEqual(before.syncedAt);
  });

  it("нет доступа — подсказка, какому аккаунту открыть таблицу", async () => {
    await sql`update workspace_sheet_snapshots set last_attempt_at = now() - interval '1 hour' where workspace_id = ${ws.id}`;
    const r = await syncWorkspaceSheet(ws, fakeGoogle({ status: 403 }).deps);
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/Читатель/) });
  });

  it("сменили таблицу — старый снимок не показывается как данные новой", async () => {
    const other = { id: ws.id, sheetId: "Z".repeat(30) };
    const s = await getSnapshotState(other);
    expect(s.data).toBeNull();
    expect(s.stale).toBe(true);
  });

  it("параллельные обновления объединяются в один запрос", async () => {
    await sql`update workspace_sheet_snapshots set last_attempt_at = now() - interval '1 hour' where workspace_id = ${ws.id}`;
    const g = fakeGoogle();
    const [a, b] = await Promise.all([syncWorkspaceSheet(ws, g.deps), syncWorkspaceSheet(ws, g.deps)]);
    expect(a).toEqual(b);
    expect(g.calls).toHaveLength(2); // метаданные + batchGet, один раз
  });

  it("без ссылки на таблицу — понятная ошибка", async () => {
    expect(await syncWorkspaceSheet({ id: ws.id, sheetId: null })).toMatchObject({ ok: false, error: expect.stringMatching(/не указана/) });
  });
});
