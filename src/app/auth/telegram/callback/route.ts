import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { appUrl } from "@/lib/app-origin";
import { loginDecision } from "@/lib/authz";
import { clientIp, loginLimiter } from "@/lib/limiter";
import { createSession, sessionCookie } from "@/lib/session";
import { authConfig, verifyTelegramLogin } from "@/lib/telegram-auth";

export const dynamic = "force-dynamic";

const MAX_AGE_SEC = 10 * 60;

function back(path: string) {
  const res = NextResponse.redirect(appUrl(path), 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export async function GET(request: NextRequest) {
  const ip = clientIp(request.headers);
  const cfg = authConfig();
  if (!cfg) return back("/login");

  const result = verifyTelegramLogin(request.nextUrl.searchParams, {
    botToken: cfg.botToken,
    nowSec: Math.floor(Date.now() / 1000),
    maxAgeSec: MAX_AGE_SEC,
  });
  if (!result.ok) {
    loginLimiter.fail(ip);
    return back(`/login?error=${result.reason}`);
  }
  // Кого пускать — решает БД: владелец или пользователь с действующим доступом к проекту.
  const decision = await loginDecision(result.telegramId);
  if (decision === "forbidden") {
    loginLimiter.fail(ip);
    return back("/login?error=forbidden");
  }
  const token = await createSession(result.telegramId, result.hash);
  if (!token) {
    loginLimiter.fail(ip);
    return back("/login?error=replay");
  }
  loginLimiter.succeed(ip);
  const res = back(decision === "owner" ? "/" : "/projects");
  res.cookies.set(sessionCookie(token));
  return res;
}
