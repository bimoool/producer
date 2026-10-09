import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyTelegramLogin } from "./telegram-auth";

const botToken = "123456789:TEST_token_not_real_abcdefghijklmnopq";
const allowed = new Set([65107390]);
const now = 1_791_500_000;

function sign(fields: Record<string, string>, token = botToken) {
  const dcs = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
  const secret = createHash("sha256").update(token).digest();
  return new URLSearchParams({ ...fields, hash: createHmac("sha256", secret).update(dcs).digest("hex") });
}
const opts = { botToken, allowed, nowSec: now, maxAgeSec: 3600 };
const base = { id: "65107390", first_name: "Bim", username: "bim", auth_date: String(now - 10) };

describe("verifyTelegramLogin", () => {
  it("принимает корректную подпись разрешённого пользователя", () => {
    expect(verifyTelegramLogin(sign(base), opts)).toMatchObject({ ok: true, telegramId: 65107390 });
  });
  it("отклоняет другой Telegram ID даже с верной подписью", () => {
    expect(verifyTelegramLogin(sign({ ...base, id: "111" }), opts)).toEqual({ ok: false, reason: "forbidden" });
  });
  it("отклоняет подмену поля после подписи", () => {
    const p = sign(base);
    p.set("id", "111");
    expect(verifyTelegramLogin(p, opts)).toEqual({ ok: false, reason: "bad_signature" });
    const q = sign({ ...base, id: "111" });
    q.set("id", "65107390");
    expect(verifyTelegramLogin(q, opts)).toEqual({ ok: false, reason: "bad_signature" });
  });
  it("отклоняет подпись чужим токеном", () => {
    expect(verifyTelegramLogin(sign(base, "999:other_token_xxxxxxxxxxxxxxxxxxxxxxxx"), opts)).toEqual({ ok: false, reason: "bad_signature" });
  });
  it("отклоняет устаревшие и будущие данные", () => {
    expect(verifyTelegramLogin(sign({ ...base, auth_date: String(now - 7200) }), opts)).toEqual({ ok: false, reason: "expired" });
    expect(verifyTelegramLogin(sign({ ...base, auth_date: String(now + 3600) }), opts)).toEqual({ ok: false, reason: "expired" });
  });
  it("лишние параметры не участвуют в подписи и не ломают проверку", () => {
    const p = sign(base);
    p.set("redirect", "/x");
    expect(verifyTelegramLogin(p, opts).ok).toBe(true);
  });
  it("мусор отклоняется", () => {
    expect(verifyTelegramLogin(new URLSearchParams("id=1&hash=zz&auth_date=1"), opts)).toEqual({ ok: false, reason: "bad_request" });
  });
});
