/** Real Server Actions + PostgreSQL, isolated from the application database. */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { runMigrations } from "@/db/migrate";
import { reportFieldsSchema, reportPeriodFor } from "@/lib/domain/report";

const context = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("@/db", async (original) => ({
  ...(await original<typeof import("@/db")>()),
  getDb: () => context.db,
}));
vi.mock("@/lib/authz", () => ({
  AccessDenied: class AccessDenied extends Error {},
  assertOwner: vi.fn().mockResolvedValue({ isOwner: true }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const base = process.env.DATABASE_URL;
const d = base ? describe : describe.skip;
const DB = "goaltracker_report_actions_test";

d("сохранение отчётов через Server Actions", () => {
  let admin: postgres.Sql;
  let sql: postgres.Sql;
  let actions: typeof import("@/app/actions");
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  const period = reportPeriodFor("2026-11-12", "2026-10-02");
  const fields = reportFieldsSchema.parse({
    focus: "Подготовить пилот", stateScore: null,
    declaration: [{ itemId: "pilot", title: "Публично опубликовать выпуск", status: "partial", progressText: "Пилот по закрытой ссылке", comment: "Не опубликован публично" }],
    finance: { actualReceipts: "", expectedPayments: "50 000 — ожидается", netProfit: "", revenue: "", cycleMonth: "", avgCheck: "" },
  });
  let reportId: string;
  let originalDeals: unknown;

  beforeAll(async () => {
    admin = postgres(base!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`drop database if exists ${DB} with (force)`);
    await admin.unsafe(`create database ${DB}`);
    const url = new URL(base!);
    url.pathname = `/${DB}`;
    await runMigrations(url.toString());
    sql = postgres(url.toString(), { max: 10, onnotice: () => {} });
    context.db = drizzle(sql, { schema });
    actions = await import("@/app/actions");
    originalDeals = await sql`select to_jsonb(d) as row from deals d order by id`;
    fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("External delivery forbidden in report save"));
  });
  afterAll(async () => {
    fetchSpy?.mockRestore();
    await sql?.end();
    if (admin) {
      await admin.unsafe(`drop database if exists ${DB} with (force)`);
      await admin.end();
    }
  });

  it("создаёт черновик с явными датами, неизвестными деньгами и частичным пилотом", async () => {
    const result = await actions.saveReport({ period, fields, status: "draft" });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.id) throw new Error("No report ID");
    reportId = result.id;
    const [r] = await sql`select * from weekly_reports where id = ${reportId}`;
    expect(r.status).toBe("draft");
    expect(r.report_date).toBe("2026-11-13");
    expect(r.coverage_start).toBe("2026-11-09");
    expect(r.coverage_end).toBe("2026-11-13");
    expect(r.cutoff_date).toBe("2026-11-12");
    expect(r.fields).toEqual(fields);
    expect(r.fields.stateScore).toBeNull();
    expect(r.fields.finance.actualReceipts).toBe("");
    expect(r.fields.finance.netProfit).toBe("");
    expect(r.fields.declaration[0].status).toBe("partial");
    expect(r.original_text).toBeNull();
    expect(r.sent_on).toBeNull();
  });

  it("повторное создание возвращает ID без перезаписи введённых полей и среза", async () => {
    const before = (await sql`select to_jsonb(r) row from weekly_reports r where id = ${reportId}`)[0].row;
    expect(await actions.saveReport({ period, fields: { ...fields, focus: "Не перезаписывать" }, status: "final" })).toEqual({ ok: true, id: reportId });
    expect((await sql`select to_jsonb(r) row from weekly_reports r where id = ${reportId}`)[0].row).toEqual(before);
    expect((await sql`select count(*)::int n from weekly_reports where report_date = '2026-11-13'`)[0].n).toBe(1);
  });

  it("редактирует draft ↔ final, используя сохранённые даты вопреки изменённым датам клиента", async () => {
    const update = { ...fields, focus: "Все введённые поля сохраняются", stateWhy: "Без оценки", includeFinance: false };
    const result = await actions.saveReport({ id: reportId, period: { ...period, cutoffDate: "2099-01-01", periodStart: "2099-01-01" }, fields: update, status: "final" });
    expect(result).toEqual({ ok: true, id: reportId });
    let [r] = await sql`select * from weekly_reports where id = ${reportId}`;
    expect(r.fields).toEqual(update);
    expect(r.status).toBe("final");
    expect(r.cutoff_date).toBe("2026-11-12");
    expect(r.period_start).toBe("2026-11-07");
    expect(await actions.saveReport({ id: reportId, period, fields: update, status: "draft" })).toEqual({ ok: true, id: reportId });
    [r] = await sql`select * from weekly_reports where id = ${reportId}`;
    expect(r.status).toBe("draft");
    expect(r.fields).toEqual(update);
    expect(r.content).toContain("Все введённые поля сохраняются");
  });

  it("параллельные создания возвращают единственный ID и не теряют запись победителя", async () => {
    const selected = reportPeriodFor("2026-11-12", "2026-10-02", "2026-11-20");
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => actions.saveReport({ period: selected, fields: { ...fields, focus: `request-${i}` }, status: "draft" })));
    expect(results.every((r) => r.ok)).toBe(true);
    const ids = results.map((r) => r.ok ? r.id : undefined);
    expect(new Set(ids).size).toBe(1);
    const rows = await sql`select * from weekly_reports where report_date = '2026-11-20'`;
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(ids[0]);
    expect(rows[0].fields.focus).toMatch(/^request-[0-7]$/);
    expect(rows[0].cutoff_date).toBe("2026-11-12");
  });

  it("sent замораживает текст; повторное создание открывает его, редактирование отклонено", async () => {
    expect(await actions.markReportSent(reportId)).toEqual({ ok: true, id: reportId });
    const before = (await sql`select to_jsonb(r) row from weekly_reports r where id = ${reportId}`)[0].row;
    expect(before.status).toBe("sent");
    expect(before.original_text).toBe(before.content);
    expect((await actions.saveReport({ id: reportId, period, fields: { ...fields, focus: "нельзя" }, status: "draft" })).ok).toBe(false);
    expect(await actions.saveReport({ period, fields: { ...fields, focus: "нельзя" }, status: "draft" })).toEqual({ ok: true, id: reportId });
    expect(await actions.markReportSent(reportId)).toEqual({ ok: true, id: reportId });
    expect((await sql`select to_jsonb(r) row from weekly_reports r where id = ${reportId}`)[0].row).toEqual(before);
  });

  it("новое сохранение отвергает подменённый период и будущий срез", async () => {
    const chosen = reportPeriodFor("2026-11-12", "2026-10-02", "2026-11-27");
    expect((await actions.saveReport({ period: { ...chosen, coverageStart: "2026-11-01" }, fields, status: "draft" })).ok).toBe(false);
    expect((await actions.saveReport({ period: { ...chosen, cutoffDate: "2099-01-01" }, fields, status: "draft" })).ok).toBe(false);
    expect((await sql`select count(*)::int n from weekly_reports where report_date = '2026-11-27'`)[0].n).toBe(0);
  });

  it("ни draft, ни final, ни отметка sent не вызывают внешних отправок и не создают деньги", async () => {
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await sql`select to_jsonb(d) as row from deals d order by id`).toEqual(originalDeals);
  });
});
