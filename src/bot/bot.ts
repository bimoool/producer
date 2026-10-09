import { randomUUID } from "node:crypto";
import { Bot, InlineKeyboard, type Context } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import { getDb, schema } from "@/db";
import { getDeclaration, getTaskBuckets, listGoals } from "@/lib/data";
import { formatRu, todayISO } from "@/lib/domain/dates";
import { buildCurrentReport } from "@/lib/report-service";
import { goalsMessage, splitMessage, taskList } from "./messages";
import { parseTaskText, type TaskDraft } from "./parse";

export function createBot(token: string, allowed: Set<number>, botInfo?: UserFromGetMe) {
  const bot = new Bot(token, botInfo ? { botInfo } : undefined);

  // Доступ только для разрешённых Telegram user ID. Остальным — ничего не показываем.
  bot.use(async (ctx, next) => {
    if (ctx.from && allowed.has(ctx.from.id) && ctx.chat?.type === "private") return next();
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: "Нет доступа" }).catch(() => {});
    else if (ctx.chat?.type === "private") await ctx.reply("Нет доступа.").catch(() => {});
  });

  // Черновики задач до подтверждения (живут 30 минут).
  const drafts = new Map<string, { draft: TaskDraft; expires: number }>();
  function remember(draft: TaskDraft) {
    const now = Date.now();
    for (const [k, v] of drafts) if (v.expires < now) drafts.delete(k);
    const id = randomUUID().slice(0, 8);
    drafts.set(id, { draft, expires: now + 30 * 60_000 });
    return id;
  }

  async function propose(ctx: Context, text: string) {
    const draft = parseTaskText(text, todayISO());
    if (!draft.title || draft.title.length > 500) {
      await ctx.reply("Не понял задачу. Напишите, например: «Завтра написать клиенту по YouTube».");
      return;
    }
    const id = remember(draft);
    const kb = new InlineKeyboard()
      .text("✅ Создать", `add:${id}`)
      .text("Без срока", `add_nodate:${id}`)
      .row()
      .text("Отмена", `cancel:${id}`);
    await ctx.reply(`Создать задачу?\n\n«${draft.title}»\nСрок: ${draft.dueDate ? formatRu(draft.dueDate) : "без срока"}`, {
      reply_markup: kb,
    });
  }

  bot.command("start", (ctx) =>
    ctx.reply(
      [
        "Goal Tracker на связи.",
        "",
        "/today — задачи на сегодня",
        "/week — задачи на неделю",
        "/goals — прогресс целей",
        "/report — черновик пятничного отчёта",
        "/add текст — добавить задачу",
        "",
        "Можно просто написать: «Завтра написать клиенту по YouTube» — я предложу задачу, а сохраню только после подтверждения.",
      ].join("\n"),
    ),
  );

  bot.command("today", async (ctx) => {
    const b = await getTaskBuckets();
    const msg = [taskList("Сегодня:", b.today, "На сегодня задач нет.")];
    if (b.overdue.length) msg.push(taskList("Просрочено:", b.overdue, ""));
    await ctx.reply(msg.join("\n\n"));
  });

  bot.command("week", async (ctx) => {
    const b = await getTaskBuckets();
    await ctx.reply(taskList("На неделю:", [...b.today, ...b.week], "На неделю задач нет.", 15));
  });

  bot.command("goals", async (ctx) => {
    const [decl, goals] = await Promise.all([getDeclaration(), listGoals()]);
    await ctx.reply(goalsMessage(decl?.items ?? [], goals.filter((g) => g.status === "active")));
  });

  bot.command("report", async (ctx) => {
    const r = await buildCurrentReport();
    const header = r.savedId ? "Сохранённый отчёт (проверьте перед отправкой наставнику):" : "Черновик отчёта (ещё не сохранён — заполните на сайте):";
    for (const part of splitMessage(`${header}\n\n${r.text}`)) await ctx.reply(part);
  });

  bot.command("add", async (ctx) => {
    const text = ctx.match?.trim();
    if (!text) return ctx.reply("Напишите задачу после команды: /add Завтра написать клиенту");
    await propose(ctx, text);
  });

  bot.on("message:text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return ctx.reply("Неизвестная команда. /start — список команд.");
    await propose(ctx, ctx.message.text);
  });

  bot.callbackQuery(/^(add|add_nodate|cancel):(\w+)$/, async (ctx) => {
    const [, action, id] = ctx.match;
    const entry = drafts.get(id);
    drafts.delete(id);
    if (!entry) {
      await ctx.answerCallbackQuery({ text: "Черновик устарел, отправьте ещё раз" });
      return;
    }
    if (action === "cancel") {
      await ctx.editMessageText("Отменено.");
      return ctx.answerCallbackQuery();
    }
    const dueDate = action === "add_nodate" ? null : entry.draft.dueDate;
    await getDb().insert(schema.tasks).values({ title: entry.draft.title, dueDate, description: "Добавлено через Telegram" });
    await ctx.editMessageText(`✅ Задача создана: «${entry.draft.title}»${dueDate ? `, срок ${formatRu(dueDate)}` : ""}`);
    await ctx.answerCallbackQuery({ text: "Сохранено" });
  });

  bot.catch((err) => {
    // Не логируем содержимое сообщений и токен — только тип ошибки.
    console.error("bot error:", err.error instanceof Error ? err.error.message : "unknown");
  });

  return bot;
}
