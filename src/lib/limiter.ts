import { FailureLimiter } from "@/lib/rate-limit";

// Один экземпляр на процесс (proxy и route handlers могут грузить модуль отдельно).
const g = globalThis as unknown as { __gtLimiter?: FailureLimiter };
// 10 неудачных попыток входа с IP или 50 со всех IP за 15 минут → блокировка на окно.
export const loginLimiter = (g.__gtLimiter ??= new FailureLimiter({ maxPerKey: 10, maxGlobal: 50, windowMs: 15 * 60_000 }));

/** Caddy перезаписывает X-Real-IP адресом клиента; приложение слушает только 127.0.0.1. */
export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
