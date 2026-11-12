/** Isolated pre-upgrade database fixture; never connects to production. */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "@/db/migrate";

const base = process.env.DATABASE_URL;
const d = base ? describe : describe.skip;
const DB = "goaltracker_weekly_report_test";
const DECL = "00000000-0000-4000-8000-000000000001";
const OLD = "b62821db-b04b-4905-9f3a-8c9ad9e5d792";
const full = path.resolve(__dirname, "../drizzle");

d("weekly report database identity and snapshots", () => {
  const admin = postgres(base!, { max: 1, onnotice: () => {} });
  const url = new URL(base!);
  url.pathname = `/${DB}`;
  let db: postgres.Sql;
  let oldRow: Record<string, unknown>;
  let oldFolder: string;
  let draftId: string;
  let moneyCount: number;

  beforeAll(async () => {
    await admin.unsafe(`drop database if exists ${DB} with (force)`);
    await admin.unsafe(`create database ${DB}`);
    oldFolder = mkdtempSync(path.join(tmpdir(), "weekly-upgrade-"));
    cpSync(full, oldFolder, { recursive: true });
    const journalPath = path.join(oldFolder, "meta/_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8"));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx <= 10);
    writeFileSync(journalPath, JSON.stringify(journal));
    await runMigrations(url.toString(), oldFolder);
    db = postgres(url.toString(), { max: 8, onnotice: () => {} });
    await db`insert into weekly_reports (id, week_number, period_start, period_end, status, fields, content, original_text, facts, sent_on)
      values (${OLD}, 5, '2026-10-31', '2026-11-06', 'sent', '{"stateScore":null}', 'historical generated text', 'historical sent text', '{"fixture":true}', '2026-11-06')`;
    [oldRow] = await db`select * from weekly_reports where id = ${OLD}`;
    const [money] = await db`select count(*)::int n from deals`;
    moneyCount = money.n;
    await runMigrations(url.toString(), full);
  });
  afterAll(async () => {
    await db?.end();
    await admin.unsafe(`drop database if exists ${DB} with (force)`);
    await admin.end();
    if (oldFolder) rmSync(oldFolder, { recursive: true, force: true });
  });

  it("upgrades legacy November 6 report without changing any original value", async () => {
    const [after] = await db`select * from weekly_reports where id = ${OLD}`;
    const { declaration_id, report_date, coverage_start, coverage_end, cutoff_date, ...original } = after;
    expect(original).toEqual(oldRow);
    expect([declaration_id, report_date, coverage_start, coverage_end, cutoff_date]).toEqual([null, null, null, null, null]);
    await runMigrations(url.toString(), full);
    const [again] = await db`select * from weekly_reports where id = ${OLD}`;
    expect(again).toEqual(after);
  });

  const createDraft = async () => {
    await db`insert into weekly_reports (declaration_id, report_date, coverage_start, coverage_end, cutoff_date, week_number, period_start, period_end, fields, content)
      values (${DECL}, '2026-11-13', '2026-11-09', '2026-11-13', '2026-11-12', 6, '2026-11-07', '2026-11-13', '{"stateScore":null}', 'draft') on conflict do nothing`;
    const [row] = await db`select id from weekly_reports where declaration_id = ${DECL} and report_date = '2026-11-13'`;
    return row.id as string;
  };

  it("concurrent create requests resolve to one declaration/date record", async () => {
    const ids = await Promise.all(Array.from({ length: 12 }, createDraft));
    expect(new Set(ids).size).toBe(1);
    draftId = ids[0];
    const [count] = await db`select count(*)::int n from weekly_reports where declaration_id = ${DECL} and report_date = '2026-11-13'`;
    expect(count.n).toBe(1);
    expect(await createDraft()).toBe(draftId);
  });

  it("date identity also covers legacy reports with NULL metadata", async () => {
    const rows = await db`insert into weekly_reports (declaration_id, report_date, coverage_start, coverage_end, cutoff_date, week_number, period_start, period_end, fields)
      values (${DECL}, '2026-11-06', '2026-11-02', '2026-11-06', '2026-11-06', 5, '2026-11-01', '2026-11-06', '{}') on conflict do nothing returning id`;
    expect(rows).toHaveLength(0);
  });

  it("permits same report date for a different declaration", async () => {
    const [decl] = await db`insert into declarations (title, declared_on, cycle_start) values ('test declaration', '2026-11-01', '2026-11-01') returning id`;
    const rows = await db`insert into weekly_reports (declaration_id, report_date, coverage_start, coverage_end, cutoff_date, week_number, period_start, period_end, fields)
      values (${decl.id}, '2026-11-13', '2026-11-09', '2026-11-13', '2026-11-12', 1, '2026-11-07', '2026-11-13', '{}') returning id`;
    expect(rows).toHaveLength(1);
  });

  it("allows editing draft and final without losing fields or creating finance entries", async () => {
    await db`update weekly_reports set fields = '{"stateScore":null,"done":"confirmed partial pilot, private link"}', content = 'edited', status = 'final' where id = ${draftId}`;
    await db`update weekly_reports set content = 'final edit' where id = ${draftId}`;
    const [final] = await db`select * from weekly_reports where id = ${draftId}`;
    expect(final.fields).toEqual({ stateScore: null, done: "confirmed partial pilot, private link" });
    expect(final.status).toBe("final");
    expect(final.sent_on).toBeNull();
    await db`update weekly_reports set status = 'draft' where id = ${draftId}`;
    const [money] = await db`select count(*)::int n from deals`;
    expect(money.n).toBe(moneyCount);
  });

  it("keeps report identity, coverage and cutoff fixed on reopen/save", async () => {
    for (const column of ["cutoff_date", "coverage_start", "coverage_end", "report_date", "period_end", "period_start"]) {
      await expect(db.unsafe(`update weekly_reports set ${column} = '2026-11-20' where id = $1`, [draftId])).rejects.toThrow(/REPORT_SNAPSHOT_FIXED/);
    }
    await expect(db`update weekly_reports set declaration_id = null where id = ${draftId}`).rejects.toThrow(/REPORT_SNAPSHOT_FIXED/);
    const [row] = await db`select cutoff_date::text from weekly_reports where id = ${draftId}`;
    expect(row.cutoff_date).toBe("2026-11-12");
  });

  it("rejects new reports with absent metadata or invalid reporting date", async () => {
    await expect(db`insert into weekly_reports (week_number, period_start, period_end, fields) values (7, '2026-11-14', '2026-11-20', '{}')`).rejects.toThrow(/REPORT_METADATA/);
    await expect(db`insert into weekly_reports (declaration_id, report_date, coverage_start, coverage_end, cutoff_date, week_number, period_start, period_end, fields)
      values (${DECL}, '2026-11-14', '2026-11-09', '2026-11-13', '2026-11-12', 7, '2026-11-14', '2026-11-20', '{}')`).rejects.toThrow(/REPORT_METADATA/);
  });

  it("sent historical records reject writes including new columns and deletion", async () => {
    for (const column of ["content", "original_text"]) {
      await expect(db.unsafe(`update weekly_reports set ${column} = 'changed' where id = $1`, [OLD])).rejects.toThrow(/REPORT_SENT/);
    }
    await expect(db`update weekly_reports set cutoff_date = '2026-11-06' where id = ${OLD}`).rejects.toThrow(/REPORT_SENT/);
    await expect(db`update weekly_reports set fields = '{}' where id = ${OLD}`).rejects.toThrow(/REPORT_SENT/);
    await expect(db`update weekly_reports set status = 'draft' where id = ${OLD}`).rejects.toThrow(/REPORT_SENT/);
    await expect(db`delete from weekly_reports where id = ${OLD}`).rejects.toThrow(/REPORT_SENT/);
    await expect(db`update weekly_reports set content = content where id = ${OLD}`).rejects.toThrow(/REPORT_SENT/);
    await expect(db`update weekly_reports set updated_at = now() where id = ${OLD}`).rejects.toThrow(/REPORT_SENT/);
    const [row] = await db`select original_text, period_start::text, period_end::text from weekly_reports where id = ${OLD}`;
    expect(row).toEqual({ original_text: "historical sent text", period_start: "2026-10-31", period_end: "2026-11-06" });
  });
});
