-- Подтверждённые пользователем данные на 09.10.2026.
-- Миграция выполняется ровно один раз (журнал drizzle), поэтому повторный деплой
-- не создаёт дублей и не перезаписывает прогресс, внесённый позже через интерфейс.
-- Исходные тексты обязательств НЕ изменяются.

UPDATE declarations SET ends_on = '2026-11-15'
  WHERE id = '00000000-0000-4000-8000-000000000001' AND ends_on IS NULL;
--> statement-breakpoint
UPDATE declaration_items SET deadline = '2026-11-15'
  WHERE declaration_id = '00000000-0000-4000-8000-000000000001' AND deadline IS NULL;
--> statement-breakpoint
-- Прогресс: каждая запись истории фиксирует переход от «не подтверждено» к значению.
INSERT INTO progress_updates (declaration_item_id, previous_value, value, note, source)
SELECT id, current_value, v.value, v.note, 'import'
FROM declaration_items di
JOIN (VALUES
  (1, 0::float8, 'Подтверждено 09.10.2026: кастдевов 0, статус «не выполнено».'),
  (2, 2::float8, 'Подтверждено 09.10.2026: проведены 2 встречи по YouTube-каналам.'),
  (3, 0::float8, 'Подтверждено 09.10.2026: 09.10 проведена первая съёмка; завершение съёмок — начало ноября; публикация до 15.11.2026.')
) AS v(pos, value, note) ON v.pos = di.position
WHERE di.declaration_id = '00000000-0000-4000-8000-000000000001' AND di.current_value IS NULL;
--> statement-breakpoint
UPDATE declaration_items di SET current_value = v.value, status = v.status
FROM (VALUES
  (1, 0::float8, 'not_done'),
  (2, 2::float8, 'partial'),
  (3, 0::float8, 'in_progress')
) AS v(pos, value, status)
WHERE di.position = v.pos
  AND di.declaration_id = '00000000-0000-4000-8000-000000000001'
  AND di.current_value IS NULL AND di.status IS NULL;
--> statement-breakpoint
-- Задачи по пилоту (сроки — только те, что назвал пользователь).
INSERT INTO tasks (title, description, declaration_item_id, status, due_date, completed_at, result)
SELECT t.title, t.description, di.id, t.status, t.due_date, t.completed_at, t.result
FROM declaration_items di,
(VALUES
  ('Первая съёмка творческого YouTube', NULL, 'done', NULL::date, '2026-10-09T18:00:00+05:00'::timestamptz, 'Проведена 09.10.2026.'),
  ('Завершить съёмки пилота', 'Планируется на начало ноября.', 'todo', NULL::date, NULL::timestamptz, NULL),
  ('Опубликовать пилот на YouTube-канале', 'Критерий обязательства: опубликованный выпуск.', 'todo', '2026-11-15'::date, NULL::timestamptz, NULL)
) AS t(title, description, status, due_date, completed_at, result)
WHERE di.declaration_id = '00000000-0000-4000-8000-000000000001' AND di.position = 3;
--> statement-breakpoint
-- Деньги. Фактическое (paid) отдельно от потенциального.
INSERT INTO deals (client, title, kind, amount, status, personal_profit, expected_by, note) VALUES
  ('УММАШ', 'Производство видеоролика', 'one_time', 124050, 'paid', 50000, NULL,
   'Проект завершён и оплачен. Выручка проекта 124 050 ₽, личная прибыль 50 000 ₽.'),
  ('СКМ Девелопмент', 'Концепция YouTube', 'one_time', 500000, 'potential', NULL, 'до ноября', 'Ожидание решения.'),
  ('УММАШ', 'Концепция YouTube', 'one_time', 100000, 'potential', NULL, 'октябрь',
   'Отдельное предложение, не связано с оплаченным роликом. Ожидание ответа.'),
  ('Эксперт по эмоциональному интеллекту', 'Продюсирование Instagram', 'monthly', 50000, 'potential', NULL, 'октябрь',
   'Встреча проведена, ожидание ответа.'),
  ('Дима (предпринимательская десятка)', 'Стартовая упаковка блога и контент-план', 'one_time', 20000, 'potential', NULL, NULL,
   'Предложение сделано.');
--> statement-breakpoint
-- Первый отчёт: отправлен наставнику. Точный текст в систему не передан —
-- храним только подтверждённые факты, original_text = NULL («нужно импортировать»).
INSERT INTO weekly_reports (week_number, period_start, period_end, status, fields, content, original_text, facts, sent_on)
VALUES (1, '2026-10-02', '2026-10-09', 'sent', '{}'::jsonb, NULL, NULL,
'{
  "source": "Факты подтверждены пользователем 09.10.2026. Это не текст отчёта.",
  "declaration": [
    {"position": 1, "status": "not_done", "progress": "0 из 15"},
    {"position": 2, "status": "partial", "progress": "2 из 3"},
    {"position": 3, "status": "in_progress", "progress": "0 из 1", "note": "09.10 первая съёмка; завершение съёмок — начало ноября; публикация до 15.11.2026"}
  ],
  "results": [
    "2 встречи по YouTube",
    "Предложения: СКМ Девелопмент — 500 000 ₽, УММАШ (концепция YouTube) — 100 000 ₽",
    "Новый продукт: экспертное продюсирование",
    "Встреча с экспертом по эмоциональному интеллекту, предложение 50 000 ₽/мес",
    "Предложение Диме — 20 000 ₽",
    "Собрана стратегия продвижения Веры",
    "Начат монтаж мини-курсов Веры",
    "Проведена первая съёмка творческого YouTube",
    "Сдан и оплачен ролик УММАШ: чек 124 050 ₽, личная прибыль 50 000 ₽",
    "Начата разработка Goal Tracker"
  ],
  "notDone": ["Кастдевы: 0", "Курсы «Выбор ниши» и «Выбор Мишы» не начаты"],
  "insight": "YouTube и экспертное Instagram-продюсирование можно развивать как два продукта внутри одного направления видеопродюсирования.",
  "extraBusiness": [
    {"name": "Студия подкастов", "personalIncome": 0},
    {"name": "Рентал", "personalIncome": 0}
  ],
  "state": {"score": 3, "why": "Дополнительный стресс по семейным обстоятельствам, из-за которого выпал из рабочего процесса на несколько дней."},
  "requestToTen": "Контакты предпринимателей, экспертов и компаний, которым интересно развитие через видеоконтент."
}'::jsonb,
'2026-10-09')
ON CONFLICT (period_start) DO NOTHING;
