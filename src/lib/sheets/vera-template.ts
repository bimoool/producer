/**
 * Шаблон «Аналитика Веры» (основа шаблона Producer OS для проектов).
 * Разбор вкладок → нормализованные данные для интерфейса.
 * В снимок попадают только нужные интерфейсу поля, а не вся таблица.
 */
import { date, fraction, num, text, url, type Cell } from "./cells";
import { readTable, type Rows } from "./table";

export const TABS = {
  reels: "01 Все Reels",
  drivers: "02 Драйверы роста",
  female: "03 Женская аудитория",
  hypotheses: "04 Гипотезы",
  daily: "05 90 дней",
  goals: "07 Трекер целей",
  plan: "08 Контент-план",
  lab: "10 Лаборатория Reels",
} as const;
export type TabKey = keyof typeof TABS;

const nonEmpty = (...v: Cell[]) => v.some((x) => text(x) !== "");

// ---------- 08 Контент-план ----------
export type PlanItem = {
  row: number;
  date: string | null;
  dateText: string;
  idea: string;
  goal: string;
  cta: string;
  audience: string;
  hypothesis: string;
  contentType: string;
  tags: string;
  status: string;
  results: {
    igViews: number | null;
    igFollows: number | null;
    leads: number | null;
    revenue: number | null;
    tgClicks: number | null;
    ytViews: number | null;
    ytSubs: number | null;
    vkViews: number | null;
    vkSubs: number | null;
  };
  conclusion: string;
};

export function parsePlan(values: Rows, year: number) {
  const t = readTable(
    values,
    {
      date: ["Дата"],
      idea: ["Reel / идея", "Идея", "Reel"],
      goal: ["Главная цель", "Цель"],
      cta: ["CTA"],
      audience: ["Аудитория"],
      hypothesis: ["Гипотеза"],
      contentType: ["Тип контента"],
      tags: ["Теги"],
      status: ["Статус"],
      igViews: ["Instagram views", "IG views"],
      igFollows: ["IG follows", "Instagram follows"],
      leads: ["Лиды"],
      revenue: ["Выручка, ₽", "Выручка"],
      tgClicks: ["TG переходы"],
      ytViews: ["YT views"],
      ytSubs: ["YT subs"],
      vkViews: ["VK views"],
      vkSubs: ["VK subs"],
      conclusion: ["Вывод / следующий тест", "Вывод"],
    },
    ["date", "idea"],
  );
  if (!t) return null;
  const items: PlanItem[] = t.rows
    .filter((r) => nonEmpty(r.get("idea"), r.get("hypothesis")))
    .map((r) => ({
      row: r.rowNumber,
      date: date(r.get("date"), year),
      dateText: text(r.get("date")),
      idea: text(r.get("idea")),
      goal: text(r.get("goal")),
      cta: text(r.get("cta")),
      audience: text(r.get("audience")),
      hypothesis: text(r.get("hypothesis")),
      contentType: text(r.get("contentType")),
      tags: text(r.get("tags")),
      status: text(r.get("status")),
      results: {
        igViews: num(r.get("igViews")),
        igFollows: num(r.get("igFollows")),
        leads: num(r.get("leads")),
        revenue: num(r.get("revenue")),
        tgClicks: num(r.get("tgClicks")),
        ytViews: num(r.get("ytViews")),
        ytSubs: num(r.get("ytSubs")),
        vkViews: num(r.get("vkViews")),
        vkSubs: num(r.get("vkSubs")),
      },
      conclusion: text(r.get("conclusion")),
    }));
  return { items, missing: t.missing };
}

// ---------- 10 Лаборатория Reels ----------
export type LabScenario = {
  row: number;
  test: string;
  branch: string;
  basis: string;
  lesson: string;
  goal: string;
  audience: string;
  hypothesis: string;
  hookA: string;
  hookB: string;
  beats: { label: string; text: string }[];
  payoff: string;
  cta: string;
  ctaType: string;
  mainMetric: string;
  threshold: string;
  status: string;
  fact: {
    date: string | null;
    views: number | null;
    reach: number | null;
    retention: string;
    shares: number | null;
    saves: number | null;
    follows: number | null;
    femaleFollows: number | null;
    leads: number | null;
    revenue: number | null;
    follows1k: number | null;
    shares1k: number | null;
    saves1k: number | null;
    womenShare: number | null;
    leads1k: number | null;
  };
  result: string;
  decision: string;
  nextTest: string;
  humanizer: string;
  note: string;
  link: string | null;
};

const BEATS = [
  ["b0", "0–3 с"],
  ["up1", "↑ 1"],
  ["down1", "↓ 1"],
  ["up2", "↑ 2"],
  ["down2", "↓ 2"],
] as const;

export function parseLab(values: Rows, year: number) {
  const t = readTable(
    values,
    {
      test: ["Test", "Тест"],
      branch: ["Ветка"],
      basis: ["Реальная опора"],
      lesson: ["Урок / конфликт"],
      goal: ["Цель"],
      audience: ["Аудитория"],
      hypothesis: ["Гипотеза"],
      hookA: ["Hook A"],
      hookB: ["Hook B"],
      b0: ["0–3с", "0-3с", "0–3 с"],
      up1: ["↑ 1", "↑1"],
      down1: ["↓ 1", "↓1"],
      up2: ["↑ 2", "↑2"],
      down2: ["↓ 2", "↓2"],
      payoff: ["Payoff"],
      cta: ["CTA"],
      ctaType: ["Тип CTA"],
      mainMetric: ["Главная метрика"],
      threshold: ["Порог успеха"],
      status: ["Статус"],
      date: ["Дата"],
      views: ["Views"],
      reach: ["Reach"],
      retention: ["Watch / retention"],
      shares: ["Shares"],
      saves: ["Saves"],
      follows: ["Follows"],
      femaleFollows: ["Female follows"],
      leads: ["Leads"],
      revenue: ["Revenue, ₽"],
      follows1k: ["Follows / 1k"],
      shares1k: ["Shares / 1k"],
      saves1k: ["Saves / 1k"],
      womenShare: ["Women %"],
      leads1k: ["Leads / 1k"],
      result: ["Результат"],
      decision: ["Решение"],
      nextTest: ["Следующий тест"],
      humanizer: ["Humanizer"],
      note: ["Ссылка / примечание"],
    },
    ["test", "hookA"],
  );
  if (!t) return null;
  const items: LabScenario[] = t.rows
    .filter((r) => nonEmpty(r.get("test"), r.get("hookA"), r.get("hypothesis")))
    .map((r) => ({
      row: r.rowNumber,
      test: text(r.get("test")),
      branch: text(r.get("branch")),
      basis: text(r.get("basis")),
      lesson: text(r.get("lesson")),
      goal: text(r.get("goal")),
      audience: text(r.get("audience")),
      hypothesis: text(r.get("hypothesis")),
      hookA: text(r.get("hookA")),
      hookB: text(r.get("hookB")),
      beats: BEATS.map(([k, label]) => ({ label, text: text(r.get(k)) })).filter((b) => b.text),
      payoff: text(r.get("payoff")),
      cta: text(r.get("cta")),
      ctaType: text(r.get("ctaType")),
      mainMetric: text(r.get("mainMetric")),
      threshold: text(r.get("threshold")),
      status: text(r.get("status")),
      fact: {
        date: date(r.get("date"), year),
        views: num(r.get("views")),
        reach: num(r.get("reach")),
        retention: text(r.get("retention")),
        shares: num(r.get("shares")),
        saves: num(r.get("saves")),
        follows: num(r.get("follows")),
        femaleFollows: num(r.get("femaleFollows")),
        leads: num(r.get("leads")),
        revenue: num(r.get("revenue")),
        follows1k: num(r.get("follows1k")),
        shares1k: num(r.get("shares1k")),
        saves1k: num(r.get("saves1k")),
        womenShare: fraction(r.get("womenShare")),
        leads1k: num(r.get("leads1k")),
      },
      result: text(r.get("result")),
      decision: text(r.get("decision")),
      nextTest: text(r.get("nextTest")),
      humanizer: text(r.get("humanizer")),
      note: text(r.get("note")),
      link: url(r.get("note")),
    }));
  return { items, missing: t.missing };
}

// ---------- 01 Все Reels ----------
export type Reel = {
  date: string | null;
  time: string;
  description: string;
  durationSec: number | null;
  views: number | null;
  reach: number | null;
  likes: number | null;
  shares: number | null;
  comments: number | null;
  saves: number | null;
  follows: number | null;
  follows1k: number | null;
  engagementRate: number | null;
  url: string | null;
  format: string;
  role: string;
  status: string;
  decision: string;
};

export function parseReels(values: Rows, year: number) {
  const t = readTable(
    values,
    {
      date: ["Дата"],
      time: ["Время"],
      description: ["Описание"],
      duration: ["Длительность, сек", "Длительность"],
      views: ["Views"],
      reach: ["Reach"],
      likes: ["Likes"],
      shares: ["Shares"],
      comments: ["Comments"],
      saves: ["Saves"],
      follows: ["Follows"],
      follows1k: ["Follows / 1k Reach"],
      er: ["Engagement / Reach"],
      url: ["Ссылка"],
      format: ["Формат (ручн.)", "Предварительный формат"],
      role: ["Роль сейчас"],
      status: ["Статус теста"],
      decision: ["Решение"],
    },
    ["date", "views", "reach"],
  );
  if (!t) return null;
  const items: Reel[] = t.rows
    .filter((r) => nonEmpty(r.get("date"), r.get("url")) && nonEmpty(r.get("views"), r.get("reach")))
    .map((r) => {
      const reach = num(r.get("reach"));
      const follows = num(r.get("follows"));
      return {
        date: date(r.get("date"), year),
        time: text(r.get("time")),
        description: text(r.get("description")),
        durationSec: num(r.get("duration")),
        views: num(r.get("views")),
        reach,
        likes: num(r.get("likes")),
        shares: num(r.get("shares")),
        comments: num(r.get("comments")),
        saves: num(r.get("saves")),
        follows,
        // берём из таблицы; если пусто — считаем сами
        follows1k: num(r.get("follows1k")) ?? (reach && follows !== null ? (follows / reach) * 1000 : null),
        engagementRate: fraction(r.get("er")),
        url: url(r.get("url")),
        format: text(r.get("format")),
        role: text(r.get("role")),
        status: text(r.get("status")),
        decision: text(r.get("decision")),
      };
    });
  return { items, missing: t.missing };
}

// ---------- 02 Драйверы роста / 03 Женская аудитория ----------
export type Highlight = {
  date: string | null;
  description: string;
  views: number | null;
  reach: number | null;
  follows: number | null;
  follows1k: number | null;
  shares: number | null;
  saves: number | null;
  url: string | null;
  why: string;
  repeat: string;
  dontCopy: string;
  nextTest: string;
  status: string;
  femaleFit: string;
  womenShare: number | null;
};

export function parseHighlights(values: Rows, year: number) {
  const t = readTable(
    values,
    {
      date: ["Дата"],
      description: ["Описание / контекст", "Описание"],
      views: ["Views"],
      reach: ["Reach"],
      follows: ["Follows"],
      follows1k: ["Follows / 1k Reach"],
      shares: ["Shares"],
      saves: ["Saves"],
      url: ["Ссылка"],
      why: ["Почему важен"],
      repeat: ["Что повторять"],
      dontCopy: ["Что НЕ копировать"],
      nextTest: ["Следующий тест"],
      status: ["Статус"],
      femaleFit: ["Female-fit"],
      womenShare: ["% женщин"],
    },
    ["date", "views"],
  );
  if (!t) return null;
  const items: Highlight[] = t.rows
    .filter((r) => nonEmpty(r.get("url"), r.get("description")))
    .map((r) => ({
      date: date(r.get("date"), year),
      description: text(r.get("description")),
      views: num(r.get("views")),
      reach: num(r.get("reach")),
      follows: num(r.get("follows")),
      follows1k: num(r.get("follows1k")),
      shares: num(r.get("shares")),
      saves: num(r.get("saves")),
      url: url(r.get("url")),
      why: text(r.get("why")),
      repeat: text(r.get("repeat")),
      dontCopy: text(r.get("dontCopy")),
      nextTest: text(r.get("nextTest")),
      status: text(r.get("status")),
      femaleFit: text(r.get("femaleFit")),
      womenShare: fraction(r.get("womenShare")),
    }));
  return { items, missing: t.missing };
}

// ---------- 04 Гипотезы ----------
export type Hypothesis = {
  id: string;
  direction: string;
  hypothesis: string;
  why: string;
  testFormat: string;
  volume: string;
  mainMetric: string;
  secondaryMetric: string;
  threshold: string;
  result: string;
  decision: string;
  nextStep: string;
  evidence: string;
  confirms: string;
  sourceUrl: string | null;
  quality: string;
};

export function parseHypotheses(values: Rows) {
  const t = readTable(
    values,
    {
      id: ["ID"],
      direction: ["Направление"],
      hypothesis: ["Гипотеза"],
      why: ["Зачем"],
      testFormat: ["Формат теста"],
      volume: ["Объём теста"],
      mainMetric: ["Основная метрика"],
      secondaryMetric: ["Вторичная метрика"],
      threshold: ["Порог успеха"],
      result: ["Результат"],
      decision: ["Решение"],
      nextStep: ["Следующий шаг"],
      evidence: ["Реальный кейс / исследование", "Реальный кейс / исследование (опора)", "Реальный кейс"],
      confirms: ["Что подтверждает"],
      sourceUrl: ["Ссылка на источник"],
      quality: ["Качество опоры"],
    },
    ["hypothesis", "threshold"],
  );
  if (!t) return null;
  const items: Hypothesis[] = t.rows
    .filter((r) => nonEmpty(r.get("hypothesis")))
    .map((r) => ({
      id: text(r.get("id")),
      direction: text(r.get("direction")),
      hypothesis: text(r.get("hypothesis")),
      why: text(r.get("why")),
      testFormat: text(r.get("testFormat")),
      volume: text(r.get("volume")),
      mainMetric: text(r.get("mainMetric")),
      secondaryMetric: text(r.get("secondaryMetric")),
      threshold: text(r.get("threshold")),
      result: text(r.get("result")),
      decision: text(r.get("decision")),
      nextStep: text(r.get("nextStep")),
      evidence: text(r.get("evidence")),
      confirms: text(r.get("confirms")),
      sourceUrl: url(r.get("sourceUrl")),
      quality: text(r.get("quality")),
    }));
  return { items, missing: t.missing };
}

// ---------- 05 90 дней ----------
export type DailyStat = {
  date: string;
  views: number | null;
  reach: number | null;
  follows: number | null;
  profileVisits: number | null;
  linkClicks: number | null;
};

export function parseDaily(values: Rows, year: number) {
  const t = readTable(
    values,
    {
      date: ["Дата"],
      views: ["Views"],
      reach: ["Reach"],
      follows: ["Follows"],
      profileVisits: ["Profile visits"],
      linkClicks: ["Link clicks"],
    },
    ["date", "views"],
  );
  if (!t) return null;
  const items: DailyStat[] = [];
  for (const r of t.rows) {
    const d = date(r.get("date"), year);
    if (!d) continue;
    items.push({
      date: d,
      views: num(r.get("views")),
      reach: num(r.get("reach")),
      follows: num(r.get("follows")),
      profileVisits: num(r.get("profileVisits")),
      linkClicks: num(r.get("linkClicks")),
    });
  }
  items.sort((a, b) => a.date.localeCompare(b.date));
  return { items, missing: t.missing };
}

// ---------- 07 Трекер целей ----------
export type SheetGoal = {
  goal: string;
  deadline: string | null;
  deadlineText: string;
  start: number | null;
  plan: number | null;
  fact: number | null;
  /** Прогресс из таблицы (доля); если пусто — (факт − старт) / (план − старт). */
  progress: number | null;
  status: string;
  nextAction: string;
};

export function parseGoals(values: Rows, year: number) {
  const t = readTable(
    values,
    {
      goal: ["Цель"],
      deadline: ["Дедлайн"],
      start: ["Старт"],
      plan: ["План"],
      fact: ["Факт"],
      progress: ["Прогресс"],
      status: ["Статус"],
      nextAction: ["Следующее действие"],
    },
    ["goal", "plan"],
  );
  if (!t) return null;
  const items: SheetGoal[] = t.rows
    .filter((r) => nonEmpty(r.get("goal")))
    .map((r) => {
      const start = num(r.get("start"));
      const plan = num(r.get("plan"));
      const fact = num(r.get("fact"));
      let progress = fraction(r.get("progress"));
      if (progress === null && plan !== null && fact !== null && plan !== (start ?? 0)) {
        progress = (fact - (start ?? 0)) / (plan - (start ?? 0));
      }
      return {
        goal: text(r.get("goal")),
        deadline: date(r.get("deadline"), year),
        deadlineText: text(r.get("deadline")),
        start,
        plan,
        fact,
        progress,
        status: text(r.get("status")),
        nextAction: text(r.get("nextAction")),
      };
    });
  return { items, missing: t.missing };
}

// ---------- Снимок целиком ----------
export type VeraSnapshot = {
  version: 1;
  plan: PlanItem[];
  lab: LabScenario[];
  reels: Reel[];
  drivers: Highlight[];
  female: Highlight[];
  hypotheses: Hypothesis[];
  daily: DailyStat[];
  goals: SheetGoal[];
  /** Проблемы разбора: отсутствующая вкладка/заголовок/столбец. */
  warnings: string[];
};

/** Разбор всех вкладок. Отсутствие вкладки или столбца — предупреждение, а не падение. */
export function parseSnapshot(tabs: Partial<Record<TabKey, Rows>>, year: number): VeraSnapshot {
  const warnings: string[] = [];
  function take<T>(key: TabKey, parsed: { items: T[]; missing: string[] } | null | undefined): T[] {
    if (!tabs[key]) {
      warnings.push(`Нет вкладки «${TABS[key]}»`);
      return [];
    }
    if (!parsed) {
      warnings.push(`Во вкладке «${TABS[key]}» не найдена строка заголовков`);
      return [];
    }
    if (parsed.missing.length) warnings.push(`«${TABS[key]}»: нет столбцов ${parsed.missing.join(", ")}`);
    return parsed.items;
  }
  return {
    version: 1,
    plan: take("plan", tabs.plan && parsePlan(tabs.plan, year)),
    lab: take("lab", tabs.lab && parseLab(tabs.lab, year)),
    reels: take("reels", tabs.reels && parseReels(tabs.reels, year)),
    drivers: take("drivers", tabs.drivers && parseHighlights(tabs.drivers, year)),
    female: take("female", tabs.female && parseHighlights(tabs.female, year)),
    hypotheses: take("hypotheses", tabs.hypotheses && parseHypotheses(tabs.hypotheses)),
    daily: take("daily", tabs.daily && parseDaily(tabs.daily, year)),
    goals: take("goals", tabs.goals && parseGoals(tabs.goals, year)),
    warnings,
  };
}
