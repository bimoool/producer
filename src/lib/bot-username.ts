let cached: string | null = null;

/** Имя бота для виджета входа: из TELEGRAM_BOT_USERNAME или через getMe (кэшируется). */
export async function getBotUsername(token: string): Promise<string | null> {
  const fromEnv = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  if (fromEnv) return fromEnv;
  if (cached) return cached;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    const data = (await res.json()) as { ok?: boolean; result?: { username?: string } };
    if (data.ok && data.result?.username) cached = data.result.username;
  } catch {
    // URL содержит токен — не логируем ни его, ни текст ошибки.
    console.error("telegram getMe failed");
  }
  return cached;
}
