import { describe, expect, it } from "vitest";
import { parseSnapshot, TABS } from "./vera-template";

// Фикстуры повторяют структуру настоящей таблицы «Аналитика Веры»:
// заголовок-баннер над шапкой (08, 07), строка групп над шапкой (10), шапка в 1-й строке (01–05).
const plan = [
  ["КОНТЕНТ-ПЛАН И ТРЕКЕР РЕЗУЛЬТАТОВ", "", "", "", "", "Гипотеза → публикация → результат"],
  ["Дата", "Reel / идея", "Главная цель", "CTA", "Аудитория", "Гипотеза", "Тип контента", "Теги", "Статус", "Instagram views", "IG follows", "Лиды", "Выручка, ₽", "TG переходы", "YT views", "YT subs", "VK views", "VK subs", "Вывод / следующий тест"],
  [46310, "Ошибки в КБЖУ", "Подписки", "Подпишись", "Женщины 25–35", "H03", "Обучающий", "кбжу", "Опубликован", "12 400", "85", "", "", "", "", "", "", "", "Повторить с другим хуком"],
  ["20.10.2026", "Утро тренера", "Доверие", "Сохрани", "Широкая", "H01", "Lifestyle", "", "Запланирован"],
  ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["#REF!", "Без даты, но с идеей", "", "", "", "", "", "", "Идея"],
];

const lab = [
  ["ОСНОВА", "", "", "", "ГИПОТЕЗА", "", "", "HOOK", "", "ДРАМАТУРГИЯ"],
  ["Test", "Ветка", "Реальная опора", "Урок / конфликт", "Цель", "Аудитория", "Гипотеза", "Hook A", "Hook B", "0–3с", "↑ 1", "↓ 1", "↑ 2", "↓ 2", "Payoff", "CTA", "Тип CTA", "Главная метрика", "Порог успеха", "Статус", "Дата", "Views", "Reach", "Watch / retention", "Shares", "Saves", "Follows", "Female follows", "Leads", "Revenue, ₽", "Follows / 1k", "Shares / 1k", "Saves / 1k", "Women %", "Leads / 1k", "Результат", "Решение", "Следующий тест", "Humanizer", "Ссылка / примечание"],
  ["T01", "Женская аудитория", "Кейс Tone It Up", "Не могу похудеть", "Подписки", "Женщины", "Ошибки КБЖУ дают подписки", "Ты считаешь КБЖУ неправильно", "3 ошибки в КБЖУ", "Стоп-кадр", "Ошибка 1", "Почему", "Ошибка 2", "Последствие", "Правильная схема", "Подпишись", "Подписка", "Follows / 1k", "≥ 6", "Снят", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Вариант B", "", "https://www.instagram.com/reel/abc/ — исходник"],
  ["", "", "", "", "", "", "", "", "", ""],
];

const reels = [
  ["Дата", "Время", "Описание", "Длительность, сек", "Views", "Reach", "Likes", "Shares", "Comments", "Saves", "Follows", "Follows / 1k Reach", "Shares / 1k Reach", "Saves / 1k Reach", "Engagement / Reach", "Views / Reach", "Ссылка", "Предварительный формат", "Роль сейчас", "Целевая аудитория (ручн.)", "Тема (ручн.)", "Хук (ручн.)", "Формат (ручн.)", "Почему сработало / нет", "Решение", "Статус теста"],
  ["2026-10-04", "22:37", "", 18, "6 496", "5 087", 366, 4, 45, 9, 10, "1,97", "0,79", "1,77", "8,33%", "1,28", "https://www.instagram.com/reel/DeGeXo5MoNK/", "Personality / lifestyle", "Baseline", "", "", "", "", "", "", "Не разобран"],
  [46239, "", "Единственный способ", 12, 98462, 55791, 1, 345, 1, 691, 557, "", "", "", 0.05, "", "https://www.instagram.com/reel/Dbp_p3AM-xY/", "", "Viral"],
];

const drivers = [
  ["Дата", "Описание / контекст", "Длительность", "Views", "Reach", "Follows", "Follows / 1k Reach", "Shares", "Saves", "Ссылка", "Почему важен", "Что повторять", "Что НЕ копировать", "Следующий тест", "Статус"],
  ["2026-08-05", "Единственный способ выиграть эту жизнь", 12, 98462, 55791, 557, "9,98", 345, 691, "https://www.instagram.com/reel/Dbp_p3AM-xY/", "Сильный драйвер роста", "Повторить механику хука", "Не копировать дословно", "Сделать 2 вариации", "К разбору"],
];

const female = [
  ["Дата", "Описание / контекст", "Длительность", "Views", "Reach", "Follows", "Follows / 1k Reach", "Shares", "Saves", "Ссылка", "Почему важен", "Что повторять", "Что НЕ копировать", "Следующий тест", "Статус", "Женские подписки (факт)", "% женщин", "Источник пола", "Female-fit"],
  ["2026-08-27", "Точки над И", 43, 138841, 99538, 541, "5,44", 254, 479, "https://www.instagram.com/reel/DcjgdtCMfkd/", "Кандидат", "Сохранить тему", "Не считать женским", "Снять 2–3 варианта", "К разбору", "", "", "Нет данных", "Высокий"],
];

const hypotheses = [
  ["ID", "Направление", "Гипотеза", "Зачем", "Формат теста", "Объём теста", "Основная метрика", "Вторичная метрика", "Порог успеха", "Результат", "Решение", "Следующий шаг", "Реальный кейс / исследование", "Что подтверждает", "Ссылка на источник", "Качество опоры"],
  ["H01", "Рост", "Повторяем механики топовых acquisition Reels", "Поддержать рост", "2 вариации", "6–8 Reels", "Follows / 1k Reach", "Views", "≥ медианы топ-кластера", "", "Тестировать", "Разметить хуки топ-15", "Tone It Up", "Контент сообщества", "https://www.builtbyfoundry.io/blog/tone-it-up", "Кейс"],
];

const daily = [
  ["Дата", "Views", "Reach", "Follows", "Profile visits", "Link clicks"],
  ["2026-07-08T00:00:00", 19171, 8855, 45, 744, 0],
  [46300, "1 000", "", 3, "", ""],
  ["итого", 1, 1, 1, 1, 1],
];

const goals = [
  ["ТРЕКЕР ЦЕЛЕЙ — ОКТЯБРЬ 2026", "", "", "", "Каждый Reel двигает одну главную цель"],
  ["Цель", "Дедлайн", "Старт", "План", "Факт", "Прогресс", "Статус", "Следующее действие"],
  ["Подписчики +1000", "31.10.2026", 12000, 13000, 12400, "", "В процессе", "Снять 3 Reels по H03"],
  ["Лиды", "31.10.2026", "", 20, 5, 0.25, "Отстаём", "Запустить CTA в TG"],
  ["Пустой план", "", "", "", "", "", "", ""],
];

describe("parseSnapshot (структура таблицы Веры)", () => {
  const snap = parseSnapshot({ plan, lab, reels, drivers, female, hypotheses, daily, goals }, 2026);

  it("без предупреждений на полной таблице", () => {
    expect(snap.warnings.filter((w) => !w.includes("нет столбцов"))).toEqual([]);
  });

  it("контент-план: шапка под баннером, даты, числа с пробелами, пустые строки пропускаются", () => {
    expect(snap.plan).toHaveLength(3);
    const [a, b, c] = snap.plan;
    expect(a).toMatchObject({ date: "2026-10-15", idea: "Ошибки в КБЖУ", goal: "Подписки", status: "Опубликован", conclusion: "Повторить с другим хуком" });
    expect(a.results.igViews).toBe(12400);
    expect(a.results.leads).toBeNull();
    expect(b).toMatchObject({ date: "2026-10-20", status: "Запланирован" });
    expect(b.results.igViews).toBeNull();
    expect(c.date).toBeNull();
    expect(c.dateText).toBe("");
    expect(a.row).toBe(3);
  });

  it("лаборатория: шапка под строкой групп, драматургия по этапам, ссылка из примечания", () => {
    expect(snap.lab).toHaveLength(1);
    const s = snap.lab[0];
    expect(s).toMatchObject({ test: "T01", basis: "Кейс Tone It Up", hookA: "Ты считаешь КБЖУ неправильно", hookB: "3 ошибки в КБЖУ", payoff: "Правильная схема", cta: "Подпишись", mainMetric: "Follows / 1k", threshold: "≥ 6", status: "Снят" });
    expect(s.beats.map((b) => b.label)).toEqual(["0–3 с", "↑ 1", "↓ 1", "↑ 2", "↓ 2"]);
    expect(s.fact.views).toBeNull();
    expect(s.link).toBe("https://www.instagram.com/reel/abc/");
  });

  it("все Reels: числа, проценты, серийные даты, ссылки; конверсия считается, если не заполнена", () => {
    expect(snap.reels).toHaveLength(2);
    expect(snap.reels[0]).toMatchObject({ date: "2026-10-04", views: 6496, reach: 5087, follows: 10, follows1k: 1.97, url: "https://www.instagram.com/reel/DeGeXo5MoNK/" });
    expect(snap.reels[0].engagementRate).toBeCloseTo(0.0833);
    expect(snap.reels[1].date).toBe("2026-08-05");
    expect(snap.reels[1].follows1k).toBeCloseTo((557 / 55791) * 1000);
  });

  it("драйверы и женская аудитория", () => {
    expect(snap.drivers[0]).toMatchObject({ follows: 557, follows1k: 9.98, nextTest: "Сделать 2 вариации", status: "К разбору" });
    expect(snap.female[0]).toMatchObject({ femaleFit: "Высокий", womenShare: null });
  });

  it("гипотезы", () => {
    expect(snap.hypotheses[0]).toMatchObject({ id: "H01", threshold: "≥ медианы топ-кластера", decision: "Тестировать", result: "", sourceUrl: "https://www.builtbyfoundry.io/blog/tone-it-up" });
  });

  it("90 дней: строки без даты пропускаются, сортировка по дате", () => {
    expect(snap.daily.map((d) => d.date)).toEqual(["2026-07-08", "2026-10-05"]);
    expect(snap.daily[1]).toMatchObject({ views: 1000, reach: null });
  });

  it("цели: прогресс из таблицы или из старт/план/факт; без плана — без прогресса", () => {
    expect(snap.goals).toHaveLength(3);
    expect(snap.goals[0].progress).toBeCloseTo(0.4);
    expect(snap.goals[0].deadline).toBe("2026-10-31");
    expect(snap.goals[1].progress).toBe(0.25);
    expect(snap.goals[2].progress).toBeNull();
  });

  it("нет вкладки или шапки — предупреждение, остальное разбирается", () => {
    const s = parseSnapshot({ plan: [["что-то другое"]], reels }, 2026);
    expect(s.plan).toEqual([]);
    expect(s.reels).toHaveLength(2);
    expect(s.warnings).toContain(`Во вкладке «${TABS.plan}» не найдена строка заголовков`);
    expect(s.warnings).toContain(`Нет вкладки «${TABS.lab}»`);
  });

  it("переставленные столбцы разбираются по заголовкам", () => {
    const swapped = hypotheses.map((r) => [r[8], r[2], r[0], r[10]]);
    const s = parseSnapshot({ hypotheses: swapped }, 2026);
    expect(s.hypotheses[0]).toMatchObject({ id: "H01", threshold: "≥ медианы топ-кластера", decision: "Тестировать" });
  });
});
