/**
 * Регрессия: production за Caddy. Внутри контейнера Next.js слушает 0.0.0.0:3000,
 * снаружи сайт — https://producer.bimoool.com. Ни один redirect не должен вести
 * на внутренний адрес. Требует DATABASE_URL (создание сессии при входе).
 */
import { createHash, createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appOrigin, appUrl } from "@/lib/app-origin";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

const INTERNAL = "http://0.0.0.0:3000";
const PUBLIC = "https://producer.bimoool.com";
const TOKEN = "123456789:TEST_token_not_real_abcdefghijklmnopq"; // тестовый, не настоящий
const BAD = /0\.0\.0\.0|localhost|127\.0\.0\.1|:3000/;

/** Запрос так, как его видит приложение за Caddy. */
function proxied(path: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(INTERNAL + path, {
    method: init.method ?? "GET",
    headers: {
      host: "producer.bimoool.com",
      "x-forwarded-host": "producer.bimoool.com",
      "x-forwarded-proto": "https",
      "x-real-ip": "198.51.100.77",
      ...init.headers,
    },
  });
}

function signedQuery(fields: Record<string, string>) {
  const dcs = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
  const hash = createHmac("sha256", createHash("sha256").update(TOKEN).digest()).update(dcs).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

describe("appOrigin", () => {
  it("по умолчанию и при некорректном APP_URL — production-домен", () => {
    expect(appOrigin(undefined)).toBe(PUBLIC);
    expect(appOrigin("https://0.0.0.0:3000")).toBe(PUBLIC);
    expect(appOrigin("http://0.0.0.0:3000")).toBe(PUBLIC);
    expect(appOrigin("http://producer.bimoool.com")).toBe(PUBLIC);
    expect(appOrigin("not a url")).toBe(PUBLIC);
    expect(appOrigin("https://producer.bimoool.com/")).toBe(PUBLIC);
  });
  it("appUrl не выпускает за пределы сайта", () => {
    expect(appUrl("//evil.example/x").toString()).toBe(PUBLIC + "/");
    expect(appUrl("https://evil.example").toString()).toBe(PUBLIC + "/");
    expect(appUrl("/login").toString()).toBe(PUBLIC + "/login");
  });
});

d("redirect'ы за reverse proxy (внутри 0.0.0.0:3000, снаружи https://producer.bimoool.com)", () => {
  const sql = postgres(url!, { max: 1 });
  const saved = { ...process.env };

  beforeAll(() => {
    process.env.APP_URL = PUBLIC;
    process.env.TELEGRAM_BOT_TOKEN = TOKEN;
    process.env.TELEGRAM_ALLOWED_USER_IDS = "65107390";
  });
  afterAll(async () => {
    process.env = saved;
    await sql`delete from sessions where telegram_id = 65107390 and created_at > now() - interval '5 minutes'`;
    await sql.end();
  });

  it("успешный Telegram callback → https://producer.bimoool.com/ и cookie сессии", async () => {
    const { GET } = await import("@/app/auth/telegram/callback/route");
    const q = signedQuery({ id: "65107390", first_name: "Bim", auth_date: String(Math.floor(Date.now() / 1000)) });
    const res = await GET(proxied(`/auth/telegram/callback?${q}`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://producer.bimoool.com/");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^__Host-gt_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).not.toMatch(/Domain=/i);
  });

  it("неудачный callback → https://producer.bimoool.com/login?error=…", async () => {
    const { GET } = await import("@/app/auth/telegram/callback/route");
    const forged = signedQuery({ id: "111", first_name: "X", auth_date: String(Math.floor(Date.now() / 1000)) });
    for (const q of [forged, "id=65107390&auth_date=1&hash=" + "0".repeat(64), ""]) {
      const res = await GET(proxied(`/auth/telegram/callback?${q}`));
      const loc = res.headers.get("location") ?? "";
      expect(loc.startsWith("https://producer.bimoool.com/login")).toBe(true);
      expect(loc).not.toMatch(BAD);
      expect(res.headers.get("set-cookie")).toBeNull();
    }
  });

  it("выход → https://producer.bimoool.com/login; чужой origin — 403", async () => {
    const { POST } = await import("@/app/auth/logout/route");
    const ok = await POST(proxied("/auth/logout", { method: "POST", headers: { "sec-fetch-site": "same-origin" } }));
    expect(ok.status).toBe(303);
    expect(ok.headers.get("location")).toBe("https://producer.bimoool.com/login");
    const viaOrigin = await POST(proxied("/auth/logout", { method: "POST", headers: { origin: PUBLIC } }));
    expect(viaOrigin.headers.get("location")).toBe("https://producer.bimoool.com/login");
    const evil = await POST(proxied("/auth/logout", { method: "POST", headers: { "sec-fetch-site": "cross-site", origin: "https://evil.example" } }));
    expect(evil.status).toBe(403);
    const internalOrigin = await POST(proxied("/auth/logout", { method: "POST", headers: { origin: INTERNAL } }));
    expect(internalOrigin.status).toBe(403);
  });

  it("proxy: страница без сессии → https://producer.bimoool.com/login", async () => {
    const { proxy } = await import("@/proxy");
    for (const p of ["/", "/declaration", "/reports/new", "/finance"]) {
      const res = await proxy(proxied(p, { headers: { accept: "text/html" } }));
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe("https://producer.bimoool.com/login");
    }
    const api = await proxy(proxied("/tasks", { method: "POST" }));
    expect(api.status).toBe(401);
    expect(api.headers.get("location")).toBeNull();
  });
});
