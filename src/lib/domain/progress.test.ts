import { describe, expect, it } from "vitest";
import { computeProgress, formatProgress } from "./progress";

describe("computeProgress", () => {
  it("null — не подтверждён, не ноль", () => {
    expect(computeProgress(null, 15)).toEqual({ confirmed: false });
    expect(formatProgress(computeProgress(null, 15))).toBe("Прогресс не подтверждён");
  });
  it("ноль — подтверждённый ноль", () => {
    expect(computeProgress(0, 15)).toEqual({ confirmed: true, current: 0, target: 15, percent: 0 });
  });
  it("процент округляется и ограничен 0..100", () => {
    expect(computeProgress(5, 15)).toMatchObject({ percent: 33 });
    expect(computeProgress(20, 15)).toMatchObject({ percent: 100 });
  });
  it("нулевая цель не даёт деления на ноль", () => {
    expect(computeProgress(3, 0)).toMatchObject({ percent: 0 });
  });
});
