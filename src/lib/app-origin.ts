/**
 * Внешний адрес сайта. Все абсолютные URL для пользователя строятся только отсюда,
 * а не из request.url / nextUrl.origin: за Caddy внутри контейнера это 0.0.0.0:3000.
 */
export const DEFAULT_APP_ORIGIN = "https://producer.bimoool.com";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function appOrigin(raw: string | undefined = process.env.APP_URL): string {
  if (!raw) return DEFAULT_APP_ORIGIN;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return DEFAULT_APP_ORIGIN;
  }
  // https — всегда; http — только для локальной разработки. 0.0.0.0 и прочее — никогда.
  if (u.protocol === "https:" && u.hostname !== "0.0.0.0") return u.origin;
  if (u.protocol === "http:" && LOCAL_HOSTS.has(u.hostname)) return u.origin;
  return DEFAULT_APP_ORIGIN;
}

/** Абсолютный URL внутри сайта; принимает только локальные пути вида "/x". */
export function appUrl(path: string): URL {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) path = "/";
  return new URL(path, appOrigin());
}
