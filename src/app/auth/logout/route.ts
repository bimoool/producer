import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, revokeSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Защита от CSRF: выход только со своей же страницы.
  if (!isSameOrigin(request)) return new NextResponse("Forbidden", { status: 403 });
  await revokeSession(request.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.redirect(new URL("/login", request.nextUrl.origin), 303);
  res.cookies.set({ name: SESSION_COOKIE, value: "", httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

function isSameOrigin(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}
