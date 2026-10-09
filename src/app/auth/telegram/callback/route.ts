import { NextResponse, type NextRequest } from "next/server";
import { clientIp, loginLimiter } from "@/lib/limiter";
import { createSession, sessionCookie } from "@/lib/session";
import { authConfig, verifyTelegramLogin } from "@/lib/telegram-auth";

export const dynamic = "force-dynamic";

const MAX_AGE_SEC = 10 * 60;

function back(request: NextRequest, path: string) {
  const res = NextResponse.redirect(new URL(path, request.nextUrl.origin), 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export async function GET(request: NextRequest) {
  const ip = clientIp(request.headers);
  const cfg = authConfig();
  if (!cfg) return back(request, "/login");

  const result = verifyTelegramLogin(request.nextUrl.searchParams, {
    ...cfg,
    nowSec: Math.floor(Date.now() / 1000),
    maxAgeSec: MAX_AGE_SEC,
  });
  if (!result.ok) {
    loginLimiter.fail(ip);
    return back(request, `/login?error=${result.reason}`);
  }
  const token = await createSession(result.telegramId, result.hash);
  if (!token) {
    loginLimiter.fail(ip);
    return back(request, "/login?error=replay");
  }
  loginLimiter.succeed(ip);
  const res = back(request, "/");
  res.cookies.set(sessionCookie(token));
  return res;
}
