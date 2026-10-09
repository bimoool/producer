-- Таблица Веры (указана владельцем). Только если ссылка ещё не задана — не перезаписывает настройку.
UPDATE workspaces
SET sheet_id = '1oUdD1qzRX8mP_6f9pRd-M-hxKmoxOHwNxdLKwfvwgpM',
    sheet_url = 'https://docs.google.com/spreadsheets/d/1oUdD1qzRX8mP_6f9pRd-M-hxKmoxOHwNxdLKwfvwgpM/edit'
WHERE slug = 'vera' AND sheet_id IS NULL;
