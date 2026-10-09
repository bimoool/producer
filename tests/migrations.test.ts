/**
 * Повторный деплой: миграции на чистой БД, затем снова — без дублей и
 * без перезаписи пользовательских данных. Создаёт временную БД.
 */
import path from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "@/db/migrate";

const base = process.env.DATABASE_URL;
const d = base ? describe : describe.skip;
const DB = "goaltracker_migration_test";
const folder = path.resolve(__dirname, "../drizzle");

d("миграции и повторный деплой", () => {
  const admin = postgres(base!, { max: 1, onnotice: () => {} });
  const url = (() => {
    const u = new URL(base!);
    u.pathname = `/${DB}`;
    return u.toString();
  })();
  let sql: postgres.Sql;

  beforeAll(async () => {
    await admin.unsafe(`drop database if exists ${DB} with (force)`);
    await admin.unsafe(`create database ${DB}`);
    await runMigrations(url, folder);
    sql = postgres(url, { max: 1, onnotice: () => {} });
  });

  afterAll(async () => {
    await sql?.end();
    await admin.unsafe(`drop database if exists ${DB} with (force)`);
    await admin.end();
  });

  const counts = async () => {
    const [r] = await sql`select
      (select count(*)::int from declarations) decl,
      (select count(*)::int from declaration_items) items,
      (select count(*)::int from tasks) tasks,
      (select count(*)::int from deals) deals,
      (select count(*)::int from weekly_reports) reports,
      (select count(*)::int from progress_updates) progress,
      (select count(*)::int from goals) goals,
      (select count(*)::int from projects) projects`;
    return r;
  };

  it("начальные данные соответствуют подтверждённым 09.10.2026", async () => {
    const items = await sql`select position, status, current_value, deadline::text, original_text from declaration_items order by position`;
    expect(items.map((i) => [i.position, i.status, i.current_value, i.deadline])).toEqual([
      [1, "not_done", 0, "2026-11-15"],
      [2, "partial", 2, "2026-11-15"],
      [3, "in_progress", 0, "2026-11-15"],
    ]);
    expect(items[0].original_text).toBe("Провести 15 кастдевов по проекту «Спортивный блог Веры».");
    const [decl] = await sql`select declared_on::text, ends_on::text from declarations`;
    expect(decl).toEqual({ declared_on: "2026-09-30", ends_on: "2026-11-15" });
    const [money] = await sql`select
      sum(amount) filter (where status = 'paid')::int paid,
      sum(personal_profit) filter (where status = 'paid')::int profit,
      sum(amount) filter (where status = 'potential' and kind = 'one_time')::int pot_once,
      sum(amount) filter (where status = 'potential' and kind = 'monthly')::int pot_month
      from deals`;
    expect(money).toEqual({ paid: 124050, profit: 50000, pot_once: 620000, pot_month: 50000 });
    const [rep] = await sql`select week_number, period_start::text, period_end::text, status, original_text, content from weekly_reports`;
    expect(rep).toMatchObject({ week_number: 1, period_start: "2026-10-02", period_end: "2026-10-09", status: "sent", original_text: null, content: null });
  });

  it("повторный деплой не создаёт дублей и не трогает прогресс пользователя", async () => {
    const before = await counts();
    // пользователь обновил прогресс и задачу после первого деплоя
    const [item] = await sql`select id, current_value from declaration_items where position = 1`;
    await sql`insert into progress_updates (declaration_item_id, previous_value, value) values (${item.id}, ${item.current_value}, 3)`;
    await sql`update declaration_items set current_value = 3, status = 'in_progress' where id = ${item.id}`;
    await sql`update tasks set status = 'done', completed_at = now() where title = 'Пройти курс «Выбор ниши»'`;

    await runMigrations(url, folder);
    await runMigrations(url, folder);

    const after = await counts();
    expect(after).toEqual({ ...before, progress: before.progress + 1 });
    const [again] = await sql`select current_value, status from declaration_items where position = 1`;
    expect(again).toEqual({ current_value: 3, status: "in_progress" });
    const [t] = await sql`select status from tasks where title = 'Пройти курс «Выбор ниши»'`;
    expect(t.status).toBe("done");
  });

  it("отправленный отчёт не меняется при обновлении данных", async () => {
    const [rep] = await sql`select id, facts from weekly_reports where week_number = 1`;
    await expect(sql`update weekly_reports set facts = '{}'::jsonb where id = ${rep.id}`).rejects.toThrow(/REPORT_SENT/);
    await expect(sql`update weekly_reports set status = 'draft' where id = ${rep.id}`).rejects.toThrow(/REPORT_SENT/);
    await expect(sql`update weekly_reports set period_end = '2026-10-08' where id = ${rep.id}`).rejects.toThrow(/REPORT_SENT/);
    await expect(sql`delete from weekly_reports where id = ${rep.id}`).rejects.toThrow(/REPORT_SENT/);
    // изменения декларации и сделок не затрагивают отчёт
    await sql`update declaration_items set current_value = 3 where position = 2`;
    await sql`update deals set status = 'paid' where client = 'Дима (предпринимательская десятка)'`;
    const [same] = await sql`select facts from weekly_reports where id = ${rep.id}`;
    expect(same.facts).toEqual(rep.facts);
  });

  it("оригинальный текст вставляется один раз и сохраняется дословно", async () => {
    const [rep] = await sql`select id from weekly_reports where week_number = 1`;
    const original = "ОТЧЁТ ЗА 1 НЕДЕЛЮ\n  точный   текст, с опечаткой «Мишы»\n\n— как отправлено";
    await sql`update weekly_reports set original_text = ${original} where id = ${rep.id}`;
    const [r] = await sql`select original_text from weekly_reports where id = ${rep.id}`;
    expect(r.original_text).toBe(original);
    await expect(sql`update weekly_reports set original_text = 'другое' where id = ${rep.id}`).rejects.toThrow(/REPORT_SENT/);
  });

  it("дата окончания декларации зафиксирована", async () => {
    await expect(sql`update declarations set ends_on = '2026-12-31'`).rejects.toThrow(/DECLARATION_LOCKED/);
  });
});
