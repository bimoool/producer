/**
 * Ограничение перебора пароля: после N неудачных попыток с одного IP
 * вход блокируется на окно. Плюс общий лимит неудач на все IP
 * (от распределённого перебора). Хранится в памяти процесса — приложение
 * работает одним процессом за nginx.
 */
export type LimiterOptions = { maxPerKey: number; maxGlobal: number; windowMs: number };

export class FailureLimiter {
  private hits = new Map<string, number[]>();
  private global: number[] = [];
  constructor(private opts: LimiterOptions) {}

  private prune(list: number[], now: number) {
    const from = now - this.opts.windowMs;
    let i = 0;
    while (i < list.length && list[i] <= from) i++;
    return i ? list.slice(i) : list;
  }

  /** Сколько миллисекунд ждать, если ключ заблокирован; 0 — можно пробовать. */
  blockedFor(key: string, now = Date.now()): number {
    const list = this.prune(this.hits.get(key) ?? [], now);
    this.global = this.prune(this.global, now);
    if (list.length) this.hits.set(key, list);
    else this.hits.delete(key);
    if (list.length >= this.opts.maxPerKey) return list[0] + this.opts.windowMs - now;
    if (this.global.length >= this.opts.maxGlobal) return this.global[0] + this.opts.windowMs - now;
    return 0;
  }

  fail(key: string, now = Date.now()) {
    const list = this.prune(this.hits.get(key) ?? [], now);
    list.push(now);
    this.hits.set(key, list);
    this.global.push(now);
    if (this.hits.size > 10_000) this.hits.clear(); // защита памяти
  }

  succeed(key: string) {
    this.hits.delete(key);
  }
}
