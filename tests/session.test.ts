import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { createSession, revokeSession, validateSession } from "@/lib/session";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;
const allowed = new Set([65107390]);

d("сессии", () => {
  const sql = postgres(url!, { max: 1 });
  afterAll(async () => {
    await sql`delete from sessions where login_hash like 'test-%'`;
    await sql.end();
  });

  it("создание, проверка, отзыв", async () => {
    const token = await createSession(65107390, `test-${Date.now()}-a`);
    expect(token).toBeTruthy();
    expect(await validateSession(token!, allowed)).toBe(true);
    expect(await validateSession(token! + "x", allowed)).toBe(false);
    expect(await validateSession(undefined, allowed)).toBe(false);
    await revokeSession(token!);
    expect(await validateSession(token!, allowed)).toBe(false);
  });

  it("в БД хранится только хеш токена", async () => {
    const token = await createSession(65107390, `test-${Date.now()}-b`);
    const rows = await sql`select token_hash from sessions where token_hash = ${token!}`;
    expect(rows.length).toBe(0);
  });

  it("одна подпись Telegram — один вход (повтор отклоняется)", async () => {
    const h = `test-${Date.now()}-c`;
    expect(await createSession(65107390, h)).toBeTruthy();
    expect(await createSession(65107390, h)).toBeNull();
  });

  it("истёкшая сессия и ID вне allowlist не проходят", async () => {
    const token = await createSession(65107390, `test-${Date.now()}-d`);
    await sql`update sessions set expires_at = now() - interval '1 second' where login_hash like 'test-%-d'`;
    expect(await validateSession(token!, allowed)).toBe(false);
    const t2 = await createSession(65107390, `test-${Date.now()}-e`);
    expect(await validateSession(t2!, new Set([1]))).toBe(false);
  });
});
