-- Начальные данные. Прогресс и статусы обязательств НЕ устанавливаются (NULL = не подтверждено).
INSERT INTO declarations (id, title, declared_on, cycle_start, price_of_word, reward, financial_hypothesis, locked_at)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Декларация от 30.09.2026',
  '2026-09-30',
  '2026-10-02',
  20000,
  'Покупка футболки и рубашки в «Табу»',
  'Получить 150 000–300 000 рублей чистыми, если проверяемые гипотезы сработают. Это гипотеза, а не гарантированный результат.',
  NULL
);
--> statement-breakpoint
INSERT INTO declaration_items (declaration_id, position, short_title, original_text, target_value, unit, completion_criteria) VALUES
  ('00000000-0000-4000-8000-000000000001', 1, 'Кастдевы Веры',
   'Провести 15 кастдевов по проекту «Спортивный блог Веры».', 15, 'кастдевов',
   '15 заполненных кастдевов.'),
  ('00000000-0000-4000-8000-000000000001', 2, 'Встречи по YouTube',
   'Провести 3 встречи по упаковке и запуску YouTube-канала.', 3, 'встречи',
   'Отчёт по проведённым встречам и конверсии в сделку.'),
  ('00000000-0000-4000-8000-000000000001', 3, 'Пилот YouTube',
   'Снять пилотный выпуск YouTube в творческий проект.', 1, 'выпуск',
   'Опубликованный выпуск на YouTube-канале.');
--> statement-breakpoint
-- Фиксация декларации: после этого текст, цели и критерии неизменяемы.
UPDATE declarations SET locked_at = '2026-09-30T00:00:00+05:00' WHERE id = '00000000-0000-4000-8000-000000000001';
--> statement-breakpoint
UPDATE declaration_items SET locked_at = '2026-09-30T00:00:00+05:00' WHERE declaration_id = '00000000-0000-4000-8000-000000000001';
--> statement-breakpoint
INSERT INTO projects (id, title, description) VALUES
  ('00000000-0000-4000-8000-000000000101', 'Контент-завод ББФ', NULL);
--> statement-breakpoint
INSERT INTO goals (project_id, title, description, category) VALUES
  ('00000000-0000-4000-8000-000000000101', 'Провести тесты контент-завода ББФ',
   'Детали тестов пока не определены.', 'Вне декларации');
--> statement-breakpoint
INSERT INTO tasks (title) VALUES
  ('Пройти курс «Выбор ниши»'),
  ('Пройти курс «Выбор Мишы»');
