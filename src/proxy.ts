import { NextResponse, type NextRequest } from "next/server";
import { clientIp, loginLimiter } from "@/lib/limiter";
import { SESSION_COOKIE, validateSession } from "@/lib/session";
import { authConfig } from "@/lib/telegram-auth";

const PUBLIC = new Set(["/login", "/auth/telegram/callback", "/auth/logout", "/api/health"]);

/**
 * Каждая страница, server action и API (кроме PUBLIC) требует действующую
 * серверную сессию: cookie → SHA-256 → запись в БД, не отозвана, не истекла,
 * Telegram ID в allowlist. Без настроенного входа доступ закрыт.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = clientIp(request.headers);
  const wait = loginLimiter.blockedFor(ip);
  if (wait > 0) {
    return new NextResponse("Too many failed attempts", { status: 429, headers: { "Retry-After": String(Math.ceil(wait / 1000)) } });
  }
  if (PUBLIC.has(pathname)) return NextResponse.next();

  const cfg = authConfig();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (cfg && token) {
    try {
      if (await validateSession(token, cfg.allowed)) return NextResponse.next();
    } catch {
      return new NextResponse("Service unavailable", { status: 503 });
    }
  }
  const isPage = request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");
  if (isPage) return NextResponse.redirect(new URL("/login", request.nextUrl.origin), 303);
  return new NextResponse("Unauthorized", { status: 401 });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
