import { describe, expect, it } from "vitest";
import { parseAllowlist, parseTaskText } from "./parse";

const today = "2026-10-09"; // пятница

describe("parseTaskText", () => {
  it("«Завтра написать клиенту по YouTube»", () => {
    expect(parseTaskText("Завтра написать клиенту по YouTube", today)).toEqual({
      title: "Написать клиенту по YouTube",
      dueDate: "2026-10-10",
    });
  });
  it("дата в конце фразы", () => {
    expect(parseTaskText("позвонить Вере послезавтра", today)).toEqual({ title: "Позвонить Вере", dueDate: "2026-10-11" });
    expect(parseTaskText("снять пилот до 20.10", today)).toEqual({ title: "Снять пилот", dueDate: "2026-10-20" });
  });
  it("день недели — ближайший следующий", () => {
    expect(parseTaskText("в понедельник кастдев", today).dueDate).toBe("2026-10-12");
    expect(parseTaskText("в пятницу отчёт", today).dueDate).toBe("2026-10-16");
  });
  it("прошедшая дата без года переносится на следующий год", () => {
    expect(parseTaskText("05.01 итоги", today).dueDate).toBe("2027-01-05");
  });
  it("без даты — срок не ставится, текст не портится", () => {
    expect(parseTaskText("Пройти курс «Выбор Мишы»", today)).toEqual({ title: "Пройти курс «Выбор Мишы»", dueDate: null });
    expect(parseTaskText("обсудить завтрашний план", today).dueDate).toBeNull();
  });
  it("некорректная дата не распознаётся", () => {
    expect(parseTaskText("встреча 31.02", today).dueDate).toBeNull();
  });
});

describe("parseAllowlist", () => {
  it("только числовые ID", () => {
    expect([...parseAllowlist("123, 456 abc:token")]).toEqual([123, 456]);
    expect(parseAllowlist(undefined).size).toBe(0);
  });
});
