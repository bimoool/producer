import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Поля, которые присылает Telegram Login Widget. */
const FIELDS = ["id", "first_name", "last_name", "username", "photo_url", "auth_date"] as const;

export type TelegramLoginResult =
  | { ok: true; telegramId: number; hash: string }
  | { ok: false; reason: "bad_request" | "bad_signature" | "expired" | "forbidden" };

/**
 * Проверка данных входа по алгоритму Telegram:
 * secret = SHA256(bot_token); hash = HMAC_SHA256(data_check_string, secret).
 * data_check_string — все поля кроме hash, отсортированные, "key=value" через \n.
 */
export function verifyTelegramLogin(
  params: URLSearchParams,
  opts: { botToken: string; allowed?: Set<number>; nowSec: number; maxAgeSec: number },
): TelegramLoginResult {
  const hash = params.get("hash") ?? "";
  const id = params.get("id") ?? "";
  const authDate = Number(params.get("auth_date"));
  if (!/^[0-9a-f]{64}$/.test(hash) || !/^\d{1,20}$/.test(id) || !Number.isFinite(authDate)) {
    return { ok: false, reason: "bad_request" };
  }
  const pairs: string[] = [];
  for (const key of FIELDS) {
    const v = params.get(key);
    if (v !== null) pairs.push(`${key}=${v}`);
  }
  pairs.sort();
  const secret = createHash("sha256").update(opts.botToken).digest();
  const expected = createHmac("sha256", secret).update(pairs.join("\n")).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "bad_signature" };
  }
  if (authDate > opts.nowSec + 60 || opts.nowSec - authDate > opts.maxAgeSec) {
    return { ok: false, reason: "expired" };
  }
  const telegramId = Number(id);
  if (opts.allowed && !opts.allowed.has(telegramId)) return { ok: false, reason: "forbidden" };
  return { ok: true, telegramId, hash };
}

export type AuthConfig = { botToken: string } | null;

/** Без токена бота вход закрыт полностью. Кого пускать — решает БД (users / workspace_members). */
export function authConfig(): AuthConfig {
  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
  if (!/^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(botToken)) return null;
  return { botToken };
}
