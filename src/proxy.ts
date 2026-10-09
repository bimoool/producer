import { NextResponse, type NextRequest } from "next/server";
import { checkBasicAuth } from "@/lib/auth";

/** Весь сайт закрыт HTTP Basic Auth. Без настроенных учётных данных доступ запрещён. */
export function proxy(request: NextRequest) {
  const result = checkBasicAuth(request.headers.get("authorization"), {
    user: process.env.BASIC_AUTH_USER,
    password: process.env.BASIC_AUTH_PASSWORD,
  });
  if (result === "ok") return NextResponse.next();
  return new NextResponse(result === "misconfigured" ? "Auth is not configured" : "Unauthorized", {
    status: 401,
    headers: result === "misconfigured" ? {} : { "WWW-Authenticate": 'Basic realm="Goal Tracker", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
