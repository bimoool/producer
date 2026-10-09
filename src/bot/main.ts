import { createBot } from "./bot";
import { parseAllowlist } from "./parse";

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const allowed = parseAllowlist(process.env.TELEGRAM_ALLOWED_USER_IDS);
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  if (allowed.size === 0) throw new Error("TELEGRAM_ALLOWED_USER_IDS is empty — bot refuses to start without allowlist");

  const bot = createBot(token, allowed);
  await bot.api.setMyCommands([
    { command: "today", description: "Задачи на сегодня" },
    { command: "week", description: "Задачи на неделю" },
    { command: "goals", description: "Прогресс целей" },
    { command: "report", description: "Черновик отчёта" },
    { command: "add", description: "Добавить задачу" },
  ]);
  console.log(`bot started, allowlist size: ${allowed.size}`);
  await bot.start();
}

main().catch((err) => {
  // Только сообщение ошибки: без токена и содержимого апдейтов.
  console.error("bot failed:", err instanceof Error ? err.message.replace(/\d{6,}:[\w-]{20,}/g, "***") : "unknown");
  process.exit(1);
});
