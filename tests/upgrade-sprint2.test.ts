/**
 * Обновление production: база в состоянии Sprint 1 (миграции 0000–0008) с данными
 * → миграции Sprint 2. Данные не теряются, ссылка на таблицу, заданная владельцем, не перезаписывается.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "@/db/migrate";

const base = process.env.DATABASE_URL;
const d = base ? describe : describe.skip;
const DB = "goaltracker_upgrade_test";
const full = path.resolve(__dirname, "../drizzle");

/** Папка миграций, обрезанная до тега Sprint 1. */
function sprint1Folder(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "mig-"));
  cpSync(full, dir, { recursive: true });
  const journalPath = path.join(dir, "meta/_journal.json");
  const j = JSON.parse(readFileSync(journalPath, "utf8"));
  const last = j.entries.findIndex((e: { tag: string }) => e.tag === "0008_producer_os_seed_and_log");
  j.entries = j.entries.slice(0, last + 1);
  writeFileSync(journalPath, JSON.stringify(j));
  return dir;
}

d("обновление Sprint 1 → Sprint 2", () => {
  const admin = postgres(base!, { max: 1, onnotice: () => {} });
  const url = (() => {
    const u = new URL(base!);
    u.pathname = `/${DB}`;
    return u.toString();
  })();
  let sql: postgres.Sql;
  let s1: string;

  beforeAll(async () => {
    await admin.unsafe(`drop database if exists ${DB} with (force)`);
    await admin.unsafe(`create database ${DB}`);
    s1 = sprint1Folder();
    await runMigrations(url, s1);
    sql = postgres(url, { max: 1, onnotice: () => {} });
  });
  afterAll(async () => {
    await sql?.end();
    await admin.unsafe(`drop database if exists ${DB} with (force)`);
    await admin.end();
    if (s1) rmSync(s1, { recursive: true, force: true });
  });

  it("на Sprint 1 таблицы снимков ещё нет", async () => {
    const [r] = await sql`select to_regclass('public.workspace_sheet_snapshots') t`;
    expect(r.t).toBeNull();
  });

  it("данные Sprint 1 сохраняются, новые миграции применяются один раз", async () => {
    // production-подобные данные
    const [vera] = await sql`select id from workspaces where slug = 'vera'`;
    const [u] = await sql`insert into users (telegram_id, display_name) values (777000555, 'Вера') returning id`;
    await sql`insert into workspace_members (workspace_id, user_id, role) values (${vera.id}, ${u.id}, 'viewer')`;
    await sql`insert into tasks (title) values ('задача, созданная на production')`;
    await sql`insert into sessions (token_hash, telegram_id, login_hash, expires_at) values ('h-upgrade', 65107390, 'l-upgrade', now() + interval '1 day')`;
    const before = await sql`select
      (select count(*) from users)::int users, (select count(*) from workspace_members)::int members,
      (select count(*) from tasks)::int tasks, (select count(*) from sessions)::int sessions,
      (select count(*) from deals)::int deals, (select count(*) from weekly_reports)::int reports,
      (select count(*) from activity_log)::int log_rows`;

    await runMigrations(url, full);
    await runMigrations(url, full);

    const after = await sql`select
      (select count(*) from users)::int users, (select count(*) from workspace_members)::int members,
      (select count(*) from tasks)::int tasks, (select count(*) from sessions)::int sessions,
      (select count(*) from deals)::int deals, (select count(*) from weekly_reports)::int reports`;
    const { log_rows, ...rest } = before[0];
    expect(after[0]).toEqual(rest);
    // ссылка на таблицу Веры проставлена (была пустой) → это строки журнала, а не потеря данных
    const [log] = await sql`select count(*)::int n from activity_log`;
    expect(log.n).toBeGreaterThanOrEqual(log_rows);
    const [w] = await sql`select sheet_id from workspaces where slug = 'vera'`;
    expect(w.sheet_id).toBe("1oUdD1qzRX8mP_6f9pRd-M-hxKmoxOHwNxdLKwfvwgpM");
    const [t] = await sql`select to_regclass('public.workspace_sheet_snapshots') t`;
    expect(t.t).toBe("workspace_sheet_snapshots");
  });

  it("ссылку, заданную владельцем в Sprint 1, миграция не перезаписывает", async () => {
    await admin.unsafe(`drop database if exists ${DB}_b with (force)`);
    await admin.unsafe(`create database ${DB}_b`);
    const u2 = new URL(url);
    u2.pathname = `/${DB}_b`;
    try {
      await runMigrations(u2.toString(), s1);
      const s2 = postgres(u2.toString(), { max: 1, onnotice: () => {} });
      await s2`update workspaces set sheet_id = ${"X".repeat(30)}, sheet_url = 'https://docs.google.com/spreadsheets/d/XXXX/edit' where slug = 'vera'`;
      await runMigrations(u2.toString(), full);
      const [w] = await s2`select sheet_id from workspaces where slug = 'vera'`;
      expect(w.sheet_id).toBe("X".repeat(30));
      await s2.end();
    } finally {
      await admin.unsafe(`drop database if exists ${DB}_b with (force)`);
    }
  });
});
