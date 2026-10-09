import { NextResponse, type NextRequest } from "next/server";
import { checkBasicAuth } from "@/lib/auth";
import { FailureLimiter } from "@/lib/rate-limit";

// 10 неудачных попыток с IP или 50 со всех IP за 15 минут → блокировка.
const limiter = new FailureLimiter({ maxPerKey: 10, maxGlobal: 50, windowMs: 15 * 60_000 });

function clientIp(request: NextRequest): string {
  // Приложение слушает только 127.0.0.1, X-Real-IP выставляет nginx.
  return request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** Весь сайт закрыт HTTP Basic Auth. Без настроенных учётных данных доступ запрещён. */
export function proxy(request: NextRequest) {
  const ip = clientIp(request);
  const wait = limiter.blockedFor(ip);
  if (wait > 0) {
    return new NextResponse("Too many failed attempts", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(wait / 1000)) },
    });
  }
  const header = request.headers.get("authorization");
  const result = checkBasicAuth(header, {
    user: process.env.BASIC_AUTH_USER,
    password: process.env.BASIC_AUTH_PASSWORD,
  });
  if (result === "ok") {
    limiter.succeed(ip);
    return NextResponse.next();
  }
  // Запрос без заголовка — это первый заход браузера, не попытка подбора.
  if (result === "denied" && header) limiter.fail(ip);
  return new NextResponse(result === "misconfigured" ? "Auth is not configured" : "Unauthorized", {
    status: 401,
    headers: result === "misconfigured" ? {} : { "WWW-Authenticate": 'Basic realm="Goal Tracker", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
