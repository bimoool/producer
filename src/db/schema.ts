import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/** Шапка декларации. После locked_at содержательные поля неизменяемы (триггер в БД). */
export const declarations = pgTable("declarations", {
  id: id(),
  title: text("title").notNull(),
  declaredOn: date("declared_on").notNull(),
  cycleStart: date("cycle_start").notNull(),
  // Конец периода декларации. Задаётся один раз, затем неизменяем (триггер).
  endsOn: date("ends_on"),
  priceOfWord: integer("price_of_word"),
  reward: text("reward"),
  financialHypothesis: text("financial_hypothesis"),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/** Пункт декларации. original_text / target_value / unit / completion_criteria неизменяемы после фиксации. */
export const declarationItems = pgTable(
  "declaration_items",
  {
    id: id(),
    declarationId: uuid("declaration_id")
      .notNull()
      .references(() => declarations.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    shortTitle: text("short_title").notNull(),
    originalText: text("original_text").notNull(),
    targetValue: doublePrecision("target_value").notNull(),
    unit: text("unit").notNull(),
    completionCriteria: text("completion_criteria").notNull(),
    deadline: date("deadline"),
    // NULL = статус не подтверждён пользователем
    status: text("status"),
    // NULL = прогресс не подтверждён (не путать с нулём)
    currentValue: doublePrecision("current_value"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "declaration_items_status_check",
      sql`${t.status} is null or ${t.status} in ('done','in_progress','partial','not_done')`,
    ),
    unique("declaration_items_position_unique").on(t.declarationId, t.position),
  ],
);

export const projects = pgTable("projects", {
  id: id(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const goals = pgTable(
  "goals",
  {
    id: id(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category"),
    targetValue: doublePrecision("target_value"),
    currentValue: doublePrecision("current_value"),
    unit: text("unit"),
    deadline: date("deadline"),
    status: text("status").notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("goals_status_check", sql`${t.status} in ('active','done','paused','dropped')`),
  ],
);

/** Append-only история прогресса (UPDATE/DELETE запрещены триггером). */
export const progressUpdates = pgTable(
  "progress_updates",
  {
    id: id(),
    declarationItemId: uuid("declaration_item_id").references(() => declarationItems.id, {
      onDelete: "restrict",
    }),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "cascade" }),
    previousValue: doublePrecision("previous_value"),
    value: doublePrecision("value").notNull(),
    note: text("note"),
    source: text("source").notNull().default("web"),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "progress_updates_target_check",
      sql`(${t.declarationItemId} is null) <> (${t.goalId} is null)`,
    ),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    title: text("title").notNull(),
    description: text("description"),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    declarationItemId: uuid("declaration_item_id").references(() => declarationItems.id, {
      onDelete: "set null",
    }),
    parentTaskId: uuid("parent_task_id").references((): AnyPgColumn => tasks.id, {
      onDelete: "cascade",
    }),
    status: text("status").notNull().default("todo"),
    priority: text("priority").notNull().default("normal"),
    dueDate: date("due_date"),
    result: text("result"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    check("tasks_status_check", sql`${t.status} in ('todo','in_progress','blocked','done')`),
    check("tasks_priority_check", sql`${t.priority} in ('low','normal','high')`),
    check("tasks_not_own_parent", sql`${t.parentTaskId} is null or ${t.parentTaskId} <> ${t.id}`),
    index("tasks_due_date_idx").on(t.dueDate),
    index("tasks_parent_idx").on(t.parentTaskId),
  ],
);

export const taskComments = pgTable("task_comments", {
  id: id(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

/** Журнал изменений, заполняется триггерами БД. */
export const activityLog = pgTable(
  "activity_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    action: text("action").notNull(),
    changes: jsonb("changes"),
    createdAt: createdAt(),
  },
  (t) => [index("activity_log_entity_idx").on(t.entityType, t.entityId)],
);

export const weeklyReports = pgTable(
  "weekly_reports",
  {
    id: id(),
    weekNumber: integer("week_number").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    // draft → final → sent. После sent запись заморожена (триггер).
    status: text("status").notNull().default("draft"),
    fields: jsonb("fields").notNull(),
    // Текст, собранный генератором из fields (для черновиков).
    content: text("content"),
    // Точный текст, отправленный наставнику. Хранится как есть, без переписывания.
    originalText: text("original_text"),
    // Подтверждённые пользователем факты (для импортированных отчётов).
    facts: jsonb("facts"),
    sentOn: date("sent_on"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("weekly_reports_period_unique").on(t.periodStart),
    check("weekly_reports_status_check", sql`${t.status} in ('draft','final','sent')`),
    check("weekly_reports_sent_has_date", sql`${t.status} <> 'sent' or ${t.sentOn} is not null`),
  ],
);

/**
 * Сделки и деньги. Фактические (paid) и потенциальные (potential/expected)
 * никогда не суммируются вместе.
 */
export const deals = pgTable(
  "deals",
  {
    id: id(),
    client: text("client").notNull(),
    title: text("title").notNull(),
    // one_time — разовая сделка, monthly — ежемесячный контракт
    kind: text("kind").notNull().default("one_time"),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("RUB"),
    // paid — деньги получены; expected — договорились, ждём оплату;
    // potential — предложение сделано; lost — отказ
    status: text("status").notNull().default("potential"),
    personalProfit: integer("personal_profit"),
    expectedBy: text("expected_by"),
    paidOn: date("paid_on"),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("deals_kind_check", sql`${t.kind} in ('one_time','monthly')`),
    check("deals_status_check", sql`${t.status} in ('paid','expected','potential','lost')`),
    check("deals_amount_check", sql`${t.amount} >= 0`),
  ],
);

/**
 * Сессии входа через Telegram. В БД хранится только SHA-256 токена из cookie.
 * login_hash — подпись Telegram, использованная для входа (повтор запрещён).
 */
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    tokenHash: text("token_hash").notNull(),
    telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
    loginHash: text("login_hash").notNull(),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    unique("sessions_token_hash_unique").on(t.tokenHash),
    unique("sessions_login_hash_unique").on(t.loginHash),
  ],
);

// ---------------- Producer OS ----------------
// Пространства проектов («Проекты» в интерфейсе). Существующая таблица projects
// (группировка личных целей/задач) — отдельная сущность и не затрагивается.

/** Все, кто может войти на сайт. Владелец — is_owner; блокировка — disabled_at. */
export const users = pgTable(
  "users",
  {
    id: id(),
    telegramId: bigint("telegram_id", { mode: "number" }).notNull(),
    displayName: text("display_name").notNull(),
    isOwner: boolean("is_owner").notNull().default(false),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("users_telegram_id_unique").on(t.telegramId),
    check("users_telegram_id_positive", sql`${t.telegramId} > 0`),
  ],
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: id(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    // client — клиентский проект, personal — личный
    kind: text("kind").notNull().default("client"),
    // Своя копия шаблона Google Sheets (пока только ссылка; импорт — позже)
    sheetUrl: text("sheet_url"),
    sheetId: text("sheet_id"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("workspaces_slug_unique").on(t.slug),
    check("workspaces_kind_check", sql`${t.kind} in ('client','personal')`),
    check("workspaces_slug_format", sql`${t.slug} ~ '^[a-z0-9][a-z0-9-]{1,40}$'`),
  ],
);

/** Доступ пользователя к проекту. Отзыв — revoked_at (история сохраняется). */
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    role: text("role").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("workspace_members_pair_unique").on(t.workspaceId, t.userId),
    check("workspace_members_role_check", sql`${t.role} in ('editor','viewer')`),
    index("workspace_members_user_idx").on(t.userId),
  ],
);
