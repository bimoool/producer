/**
 * Server Actions вызываются напрямую (как это может сделать любой вошедший
 * пользователь, минуя интерфейс и proxy). Проверяем, что каждое действие
 * само проверяет права и ничего не меняет при отказе. Требует DATABASE_URL.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeFixture } from "./helpers/auth-fixture";

let currentToken: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "__Host-gt_session" && currentToken ? { name, value: currentToken } : undefined) }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

const UUID = "00000000-0000-4000-8000-000000000001";
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

d("права в Server Actions", () => {
  let f: Awaited<ReturnType<typeof makeFixture>>;
  let personal: Record<string, (...a: never[]) => Promise<unknown>>;
  let ws: typeof import("@/app/actions/workspaces");

  beforeAll(async () => {
    f = await makeFixture(url!);
    personal = (await import("@/app/actions")) as never;
    ws = await import("@/app/actions/workspaces");
  });
  afterAll(async () => f?.cleanup());
  beforeEach(() => {
    currentToken = undefined;
  });

  /** Снимок данных, которые не должны меняться при отказе. */
  const snapshot = async () =>
    (
      await f.sql`select
        (select count(*) from tasks)::int tasks, (select count(*) from goals)::int goals,
        (select count(*) from deals)::int deals, (select count(*) from weekly_reports)::int reports,
        (select count(*) from progress_updates)::int progress, (select count(*) from task_comments)::int comments,
        (select coalesce(sum(current_value),0) from declaration_items)::float decl,
        (select count(*) from users)::int users, (select count(*) from workspace_members where revoked_at is null)::int members,
        (select count(*) from workspaces)::int workspaces,
        (select string_agg(coalesce(sheet_url,''), ',' order by slug) from workspaces) sheets,
        (select string_agg(role || coalesce(revoked_at::text,''), ',' order by id) from workspace_members) roles,
        (select count(*) from users where disabled_at is not null)::int blocked`
    )[0];

  // Аргументы для каждого личного действия: корректные по форме, чтобы отказ был именно из-за прав.
  const personalCalls: Record<string, unknown[]> = {
    updateDeclarationProgress: [null, form({ itemId: UUID, value: "5" })],
    updateDeclarationStatus: [null, form({ itemId: UUID, status: "done" })],
    saveGoal: [null, form({ title: "взлом" })],
    deleteGoal: [UUID],
    saveTask: [null, form({ title: "взлом" })],
    setTaskDone: [UUID, true],
    rescheduleTask: [UUID, "tomorrow"],
    deleteTask: [UUID],
    deleteTaskAndGoHome: [UUID, null],
    addComment: [null, form({ taskId: UUID, body: "взлом" })],
    saveReport: [{ period: { weekNumber: 9, periodStart: "2026-12-04", periodEnd: "2026-12-11" }, fields: {}, status: "draft" }],
    markReportSent: [UUID],
    importReportText: [null, form({ reportId: UUID, originalText: "взлом" })],
    saveDeal: [null, form({ client: "x", title: "y", kind: "one_time", amount: "1", status: "paid" })],
    deleteDeal: [UUID],
  };

  it("перечень личных действий полон (новое действие без теста не пройдёт)", () => {
    expect(Object.keys(personal).sort()).toEqual(Object.keys(personalCalls).sort());
  });

  for (const who of ["vera", "editor", "anonymous", "blocked"] as const) {
    it(`личные действия: ${who} получает «Нет доступа», данные не меняются`, async () => {
      currentToken = who === "anonymous" ? undefined : f.tokens[who];
      const before = await snapshot();
      for (const [name, args] of Object.entries(personalCalls)) {
        const r = (await (personal[name] as (...a: unknown[]) => Promise<unknown>)(...args)) as { ok: boolean; error?: string };
        expect(r, name).toEqual({ ok: false, error: "Нет доступа" });
      }
      expect(await snapshot()).toEqual(before);
    });
  }

  it("действия доступа и проектов: не-владелец получает отказ", async () => {
    for (const who of ["vera", "editor"] as const) {
      currentToken = f.tokens[who];
      const before = await snapshot();
      const results = [
        await ws.addUser(null, form({ telegramId: "777000111", displayName: "x", workspaceId: f.ws.vera, role: "editor" })),
        await ws.grantAccess(null, form({ userId: f.user[who], workspaceId: f.ws["my-content"], role: "editor" })),
        await ws.changeRole(UUID, "editor"),
        await ws.revokeAccess(UUID),
        await ws.setUserBlocked(f.user.stranger, true),
        await ws.createWorkspace(null, form({ title: "x", slug: "t-hack", kind: "client" })),
        await ws.saveWorkspaceSheet(null, form({ workspaceId: f.ws.vera, sheetUrl: "https://docs.google.com/spreadsheets/d/AAAAAAAAAAAAAAAAAAAAAAAAAAA/edit" })),
        await ws.saveWorkspaceSheet(null, form({ workspaceId: f.ws["my-content"], sheetUrl: "" })),
      ];
      for (const r of results) expect(r).toEqual({ ok: false, error: "Нет доступа" });
      expect(await snapshot()).toEqual(before);
    }
  });

  it("владелец: управление доступами и ссылкой на таблицу работает", async () => {
    currentToken = f.tokens.owner;
    const sheet = "https://docs.google.com/spreadsheets/d/1oUdD1qzRX8mP_6f9pRd-M-hxKmoxOHwNxdLKwfvwgpM/edit?gid=0#gid=0";
    expect(await ws.saveWorkspaceSheet(null, form({ workspaceId: f.ws.vera, sheetUrl: sheet }))).toEqual({ ok: true });
    const [w] = await f.sql`select sheet_url, sheet_id from workspaces where slug = 'vera'`;
    expect(w).toEqual({
      sheet_url: "https://docs.google.com/spreadsheets/d/1oUdD1qzRX8mP_6f9pRd-M-hxKmoxOHwNxdLKwfvwgpM/edit",
      sheet_id: "1oUdD1qzRX8mP_6f9pRd-M-hxKmoxOHwNxdLKwfvwgpM",
    });
    expect(await ws.saveWorkspaceSheet(null, form({ workspaceId: f.ws.vera, sheetUrl: "https://evil.example/spreadsheets/d/xxx" }))).toMatchObject({ ok: false });
    expect(await ws.saveWorkspaceSheet(null, form({ workspaceId: f.ws.vera, sheetUrl: "" }))).toEqual({ ok: true });

    // выдать доступ к «Мой контент», сменить роль, отозвать
    expect(await ws.grantAccess(null, form({ userId: f.user.stranger, workspaceId: f.ws["my-content"], role: "viewer" }))).toEqual({ ok: true });
    const [m] = await f.sql`select id, role from workspace_members where user_id = ${f.user.stranger}`;
    expect(m.role).toBe("viewer");
    expect(await ws.changeRole(m.id, "editor")).toEqual({ ok: true });
    expect(await ws.changeRole(m.id, "admin")).toMatchObject({ ok: false });
    expect(await ws.revokeAccess(m.id)).toEqual({ ok: true });
    // повторная выдача восстанавливает доступ, а не дублирует строку
    expect(await ws.grantAccess(null, form({ userId: f.user.stranger, workspaceId: f.ws["my-content"], role: "viewer" }))).toEqual({ ok: true });
    const rows = await f.sql`select revoked_at from workspace_members where user_id = ${f.user.stranger}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].revoked_at).toBeNull();

    // владельцу нельзя «выдать доступ»; дубль Telegram ID — понятная ошибка
    const [owner] = await f.sql`select id from users where is_owner`;
    expect(await ws.grantAccess(null, form({ userId: owner.id, workspaceId: f.ws.vera, role: "viewer" }))).toMatchObject({ ok: false });
    expect(await ws.addUser(null, form({ telegramId: String(f.ids.vera), displayName: "дубль" }))).toEqual({
      ok: false,
      error: "Пользователь с таким Telegram ID уже есть",
    });
    expect(await ws.addUser(null, form({ telegramId: "abc", displayName: "x" }))).toMatchObject({ ok: false });
    // нельзя заблокировать себя-единственного владельца
    expect(await ws.setUserBlocked(owner.id, true)).toEqual({ ok: false, error: "Нельзя отключить единственного владельца" });
  });

  it("«Обновить данные»: только для тех, кто видит проект", async () => {
    currentToken = f.tokens.vera;
    expect(await ws.refreshSheet(f.ws["my-content"])).toEqual({ ok: false, error: "Нет доступа" });
    // свой проект — доступ есть (дальше — ответ интеграции, а не отказ в правах)
    const own = await ws.refreshSheet(f.ws.vera);
    expect(own).not.toEqual({ ok: false, error: "Нет доступа" });
    currentToken = undefined;
    expect(await ws.refreshSheet(f.ws.vera)).toEqual({ ok: false, error: "Нет доступа" });
  });

  it("редактор не может управлять даже своим проектом", async () => {
    currentToken = f.tokens.editor;
    expect(await ws.saveWorkspaceSheet(null, form({ workspaceId: f.ws.vera, sheetUrl: "" }))).toEqual({ ok: false, error: "Нет доступа" });
  });
});
