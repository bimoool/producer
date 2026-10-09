import { describe, expect, it } from "vitest";
import { FailureLimiter } from "./rate-limit";

describe("FailureLimiter", () => {
  const opts = { maxPerKey: 3, maxGlobal: 5, windowMs: 1000 };
  it("блокирует IP после N неудач и отпускает после окна", () => {
    const l = new FailureLimiter(opts);
    for (let i = 0; i < 3; i++) l.fail("a", 100 + i);
    expect(l.blockedFor("a", 200)).toBeGreaterThan(0);
    expect(l.blockedFor("b", 200)).toBe(0);
    expect(l.blockedFor("a", 1200)).toBe(0);
  });
  it("успешный вход сбрасывает счётчик IP", () => {
    const l = new FailureLimiter(opts);
    l.fail("a", 1);
    l.fail("a", 2);
    l.succeed("a");
    l.fail("a", 3);
    expect(l.blockedFor("a", 4)).toBe(0);
  });
  it("общий лимит против распределённого перебора", () => {
    const l = new FailureLimiter(opts);
    for (let i = 0; i < 5; i++) l.fail(`ip${i}`, 10 + i);
    expect(l.blockedFor("new", 20)).toBeGreaterThan(0);
  });
});
