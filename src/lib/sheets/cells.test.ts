import { describe, expect, it } from "vitest";
import { date, fraction, headerKey, num, text, url } from "./cells";

describe("text", () => {
  it("пустые и ошибки формул → пустая строка", () => {
    expect(text(undefined)).toBe("");
    expect(text(null)).toBe("");
    expect(text("  ")).toBe("");
    expect(text("#DIV/0!")).toBe("");
    expect(text("#N/A")).toBe("");
    expect(text("#REF!")).toBe("");
  });
  it("неразрывные пробелы и обрезка", () => expect(text(" Привет ")).toBe("Привет"));
});

describe("num", () => {
  it("числа из API как есть", () => {
    expect(num(6496)).toBe(6496);
    expect(num(0)).toBe(0);
  });
  it("числа с пробелами-разделителями и запятой", () => {
    expect(num("6 496")).toBe(6496);
    expect(num("6 496")).toBe(6496);
    expect(num("124 050")).toBe(124050);
    expect(num("1,97")).toBe(1.97);
    expect(num("1 234,5")).toBe(1234.5);
    expect(num("1,234.5")).toBe(1234.5);
    expect(num("124 050 ₽")).toBe(124050);
    expect(num("−5")).toBe(-5);
  });
  it("проценты → доля", () => expect(num("8,33%")).toBeCloseTo(0.0833));
  it("текст, пусто и ошибки → null (не ноль)", () => {
    expect(num("")).toBeNull();
    expect(num(undefined)).toBeNull();
    expect(num("К разбору")).toBeNull();
    expect(num("6–8 Reels")).toBeNull();
    expect(num("#DIV/0!")).toBeNull();
    expect(num(Number.NaN)).toBeNull();
  });
});

describe("fraction", () => {
  it("доля из API, проценты из текста, проценты числом", () => {
    expect(fraction(0.0833)).toBe(0.0833);
    expect(fraction("8,33%")).toBeCloseTo(0.0833);
    expect(fraction(45)).toBe(0.45);
    expect(fraction("")).toBeNull();
  });
});

describe("date", () => {
  it("серийный номер Google Sheets", () => {
    expect(date(46299)).toBe("2026-10-04");
    expect(date(46299.94)).toBe("2026-10-04");
    expect(date(12)).toBeNull();
  });
  it("ISO и ISO с временем", () => {
    expect(date("2026-10-04")).toBe("2026-10-04");
    expect(date("2026-07-08T00:00:00")).toBe("2026-07-08");
  });
  it("русский формат", () => {
    expect(date("04.10.2026")).toBe("2026-10-04");
    expect(date("4.10.26")).toBe("2026-10-04");
    expect(date("4.10", 2026)).toBe("2026-10-04");
    expect(date("4.10")).toBeNull();
  });
  it("мусор и несуществующие даты", () => {
    expect(date("31.02.2026")).toBeNull();
    expect(date("скоро")).toBeNull();
    expect(date("")).toBeNull();
  });
});

describe("url", () => {
  it("только http(s)", () => {
    expect(url("https://www.instagram.com/reel/DeGeXo5MoNK/")).toBe("https://www.instagram.com/reel/DeGeXo5MoNK/");
    expect(url("смотри https://www.instagram.com/reel/x/ тут")).toBe("https://www.instagram.com/reel/x/");
    expect(url("javascript:alert(1)")).toBeNull();
    expect(url("")).toBeNull();
  });
});

describe("headerKey", () => {
  it("регистр, ё и пробелы не влияют", () => expect(headerKey("  Вывод /  следующий\nтест ")).toBe("вывод / следующий тест"));
});
