/**
 * Проверка бота без Telegram: исходящие вызовы API перехватываются,
 * входящие апдейты подаются через handleUpdate. Требует DATABASE_URL.
 */
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { createBot } from "@/bot/bot";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;
const OWNER = 111;
const STRANGER = 999;

function setup() {
  const bot = createBot("0:test", new Set([OWNER]), {
    id: 1, is_bot: true, first_name: "t", username: "t_bot",
    can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false,
    can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false,
  } as never);
  const calls: { method: string; payload: Record<string, unknown> }[] = [];
  bot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> });
    return { ok: true, result: method === "sendMessage" ? { message_id: calls.length, date: 0, chat: { id: 1, type: "private" } } : true } as never;
  });
  let uid = 1;
  const msg = (from: number, text: string) =>
    bot.handleUpdate({
      update_id: uid++,
      message: {
        message_id: uid, date: 0, text,
        chat: { id: from, type: "private", first_name: "u" },
        from: { id: from, is_bot: false, first_name: "u" },
        ...(text.startsWith("/") ? { entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0].length }] } : {}),
      },
    } as never);
  const press = (from: number, data: string) =>
    bot.handleUpdate({
      update_id: uid++,
      callback_query: {
        id: String(uid), chat_instance: "x", data,
        from: { id: from, is_bot: false, first_name: "u" },
        message: { message_id: 1, date: 0, chat: { id: from, type: "private", first_name: "u" }, text: "" },
      },
    } as never);
  const texts = () => calls.filter((c) => c.method === "sendMessage" || c.method === "editMessageText").map((c) => String(c.payload.text));
  return { msg, press, calls, texts };
}

d("telegram bot", () => {
  const sql = postgres(url!, { max: 1 });
  afterAll(async () => {
    await sql`delete from tasks where title = 'Написать клиенту по YouTube тест-бот'`;
    await sql.end();
  });

  it("чужой пользователь не получает данные", async () => {
    const { msg, texts } = setup();
    await msg(STRANGER, "/goals");
    await msg(STRANGER, "Завтра что-то");
    expect(texts()).toEqual(["Нет доступа.", "Нет доступа."]);
  });

  it("/goals показывает декларацию без выдуманного прогресса", async () => {
    const { msg, texts } = setup();
    await msg(OWNER, "/goals");
    expect(texts()[0]).toContain("Декларация:");
    expect(texts()[0]).toMatch(/Пилот YouTube: (Прогресс не подтверждён|\d)/);
  });

  it("/report отдаёт отчёт по форме", async () => {
    const { msg, texts } = setup();
    await msg(OWNER, "/report");
    expect(texts().join("\n")).toContain("1. Статус по декларации");
  });

  it("свободный текст → предложение → сохраняется только после подтверждения", async () => {
    const { msg, press, calls, texts } = setup();
    await msg(OWNER, "Завтра написать клиенту по YouTube тест-бот");
    const proposal = calls.find((c) => c.method === "sendMessage")!;
    expect(String(proposal.payload.text)).toContain("Создать задачу?");
    const before = await sql`select count(*)::int n from tasks where title = 'Написать клиенту по YouTube тест-бот'`;
    expect(before[0].n).toBe(0);
    const kb = proposal.payload.reply_markup as { inline_keyboard: { callback_data: string }[][] };
    const addData = kb.inline_keyboard[0][0].callback_data;
    await press(STRANGER, addData);
    const afterStranger = await sql`select count(*)::int n from tasks where title = 'Написать клиенту по YouTube тест-бот'`;
    expect(afterStranger[0].n).toBe(0);
    await press(OWNER, addData);
    const after = await sql`select due_date::text from tasks where title = 'Написать клиенту по YouTube тест-бот'`;
    expect(after.length).toBe(1);
    expect(texts().at(-1)).toContain("Задача создана");
    // повторное нажатие не создаёт дубль
    await press(OWNER, addData);
    const again = await sql`select count(*)::int n from tasks where title = 'Написать клиенту по YouTube тест-бот'`;
    expect(again[0].n).toBe(1);
  });

  it("отмена ничего не сохраняет", async () => {
    const { msg, press, calls } = setup();
    await msg(OWNER, "/add Позвонить тест-отмена");
    const kb = calls.find((c) => c.method === "sendMessage")!.payload.reply_markup as { inline_keyboard: { callback_data: string }[][] };
    await press(OWNER, kb.inline_keyboard[1][0].callback_data);
    const rows = await sql`select count(*)::int n from tasks where title like 'Позвонить тест-отмена%'`;
    expect(rows[0].n).toBe(0);
  });
});
