import postgres from "postgres";
import { createSession } from "@/lib/session";

/** Тестовые пользователи с уникальными Telegram ID (чтобы не пересекаться с реальными). */
export async function makeFixture(url: string) {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);
  const ids = { vera: base + 1, editor: base + 2, stranger: base + 3, blocked: base + 4 };
  const [owner] = await sql`select id, telegram_id from users where is_owner limit 1`;
  const ws = Object.fromEntries((await sql`select slug, id from workspaces`).map((r) => [r.slug, r.id as string]));
  const mk = async (tg: number, name: string) =>
    (await sql`insert into users (telegram_id, display_name) values (${tg}, ${name}) returning id`)[0].id as string;
  const user = {
    vera: await mk(ids.vera, "Вера-тест"),
    editor: await mk(ids.editor, "Редактор-тест"),
    stranger: await mk(ids.stranger, "Чужой-тест"),
    blocked: await mk(ids.blocked, "Заблокирован-тест"),
  };
  await sql`insert into workspace_members (workspace_id, user_id, role) values
    (${ws.vera}, ${user.vera}, 'viewer'),
    (${ws.vera}, ${user.editor}, 'editor'),
    (${ws.vera}, ${user.blocked}, 'editor')`;
  await sql`update users set disabled_at = now() where id = ${user.blocked}`;
  const token = async (tg: number) => (await createSession(tg, `test-${tg}-${Math.random()}`))!;
  const tokens = {
    owner: await token(Number(owner.telegram_id)),
    vera: await token(ids.vera),
    editor: await token(ids.editor),
    stranger: await token(ids.stranger),
    blocked: await token(ids.blocked),
  };
  async function cleanup() {
    const all = Object.values(user);
    await sql`delete from sessions where login_hash like 'test-%'`;
    await sql`delete from workspace_members where user_id = any(${all})`;
    await sql`delete from users where id = any(${all})`;
    await sql`delete from workspaces where slug like 't-%'`;
    await sql.end();
  }
  return { sql, ids, user, ws, tokens, ownerTelegramId: Number(owner.telegram_id), cleanup };
}
