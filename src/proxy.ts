import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/app-origin";
import { resolveViewer } from "@/lib/authz";
import { clientIp, loginLimiter } from "@/lib/limiter";
import { SESSION_COOKIE } from "@/lib/session";
import { authConfig } from "@/lib/telegram-auth";

const PUBLIC = new Set(["/login", "/auth/telegram/callback", "/auth/logout", "/api/health"]);

/** Пути, доступные не-владельцу (дальше права проверяет каждая страница и каждое действие). */
function memberPath(pathname: string) {
  return pathname === "/projects" || pathname.startsWith("/projects/");
}

/**
 * Первый рубеж: действующая сессия (сверка с БД на каждый запрос) и грубое
 * разделение «владелец / участник». Это НЕ единственная проверка: страницы и
 * Server Actions сами проверяют права (lib/authz.ts).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = clientIp(request.headers);
  const wait = loginLimiter.blockedFor(ip);
  if (wait > 0) {
    return new NextResponse("Too many failed attempts", { status: 429, headers: { "Retry-After": String(Math.ceil(wait / 1000)) } });
  }
  if (PUBLIC.has(pathname)) return NextResponse.next();

  const isPage = request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");
  let viewer = null;
  if (authConfig()) {
    try {
      viewer = await resolveViewer(request.cookies.get(SESSION_COOKIE)?.value);
    } catch {
      return new NextResponse("Service unavailable", { status: 503 });
    }
  }
  if (!viewer) {
    if (isPage) return NextResponse.redirect(appUrl("/login"), 303);
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!viewer.isOwner && !memberPath(pathname)) {
    if (isPage) return NextResponse.redirect(appUrl("/projects"), 303);
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
