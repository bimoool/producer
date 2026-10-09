/**
 * Интеграционные тесты защитных триггеров БД.
 * Требуют DATABASE_URL с применёнными миграциями; иначе пропускаются.
 * Каждый тест работает в транзакции и откатывается.
 */
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

const url = process.env.DATABASE_URL;
const sql = url ? postgres(url, { max: 1, onnotice: () => {} }) : null;
const d = sql ? describe : describe.skip;

class Rollback extends Error {}

async function inTx(fn: (tx: postgres.TransactionSql) => Promise<void>) {
  await sql!
    .begin(async (tx) => {
      await fn(tx);
      throw new Rollback();
    })
    .catch((e) => {
      if (!(e instanceof Rollback)) throw e;
    });
}

d("защита декларации", () => {
  afterAll(async () => {
    await sql?.end();
  });

  it("исходный текст обязательства нельзя изменить", async () => {
    await expect(
      inTx(async (tx) => {
        await tx`update declaration_items set original_text = 'взлом' where position = 1`;
      }),
    ).rejects.toThrow(/DECLARATION_LOCKED/);
  });

  it("целевое значение и критерий нельзя изменить", async () => {
    await expect(inTx(async (tx) => void (await tx`update declaration_items set target_value = 1 where position = 1`))).rejects.toThrow(/DECLARATION_LOCKED/);
    await expect(inTx(async (tx) => void (await tx`update declaration_items set completion_criteria = 'x' where position = 2`))).rejects.toThrow(/DECLARATION_LOCKED/);
  });

  it("снять фиксацию нельзя", async () => {
    await expect(inTx(async (tx) => void (await tx`update declaration_items set locked_at = null`))).rejects.toThrow(/DECLARATION_LOCKED/);
    await expect(inTx(async (tx) => void (await tx`update declarations set locked_at = null`))).rejects.toThrow(/DECLARATION_LOCKED/);
  });

  it("обязательство нельзя удалить", async () => {
    await expect(inTx(async (tx) => void (await tx`delete from declaration_items where position = 3`))).rejects.toThrow(/DECLARATION_LOCKED/);
  });

  it("статус и прогресс менять можно", async () => {
    await inTx(async (tx) => {
      const rows = await tx`update declaration_items set status = 'in_progress', current_value = 2 where position = 1 returning current_value`;
      expect(rows[0].current_value).toBe(2);
    });
  });

  it("история прогресса только дополняется", async () => {
    await expect(
      inTx(async (tx) => {
        const [item] = await tx`select id from declaration_items where position = 1`;
        await tx`insert into progress_updates (declaration_item_id, value) values (${item.id}, 1)`;
        await tx`update progress_updates set value = 5`;
      }),
    ).rejects.toThrow(/APPEND_ONLY/);
  });

  it("изменения задач попадают в историю", async () => {
    await inTx(async (tx) => {
      const [t] = await tx`insert into tasks (title) values ('проверка') returning id`;
      await tx`update tasks set status = 'done' where id = ${t.id}`;
      const ev = await tx`select action, changes from task_events where task_id = ${t.id} order by id`;
      expect(ev.map((e) => e.action)).toEqual(["create", "update"]);
      expect(ev[1].changes.status).toEqual({ from: "todo", to: "done" });
    });
  });

  it("подзадача удаляется вместе с родителем, связь с целью — необязательна", async () => {
    await inTx(async (tx) => {
      const [p] = await tx`insert into tasks (title) values ('родитель') returning id`;
      await tx`insert into tasks (title, parent_task_id) values ('ребёнок', ${p.id})`;
      await tx`delete from tasks where id = ${p.id}`;
      const left = await tx`select count(*)::int as n from tasks where parent_task_id = ${p.id}`;
      expect(left[0].n).toBe(0);
    });
  });
});
