import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export const SESSION_TTL_SEC = 30 * 24 * 60 * 60;
/** __Host-: только Secure, только этот домен, path=/ — cookie нельзя подменить с поддомена. */
export const SESSION_COOKIE = "__Host-gt_session";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Создаёт сессию. Повторное использование одной подписи Telegram отклоняется (unique login_hash). */
export async function createSession(telegramId: number, loginHash: string): Promise<string | null> {
  const token = randomBytes(32).toString("base64url");
  const rows = await getDb()
    .insert(schema.sessions)
    .values({
      tokenHash: sha256(token),
      telegramId,
      loginHash,
      expiresAt: new Date(Date.now() + SESSION_TTL_SEC * 1000),
    })
    .onConflictDoNothing({ target: schema.sessions.loginHash })
    .returning({ id: schema.sessions.id });
  return rows.length ? token : null;
}

export async function revokeSession(token: string | undefined) {
  if (!token) return;
  await getDb()
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(eq(schema.sessions.tokenHash, sha256(token)));
}

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SEC,
  };
}
