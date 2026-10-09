# Деплой Goal Tracker → https://producer.bimoool.com

Сервер: Caddy на хосте (80/443, автоматический HTTPS), приложение — Docker Compose-проект
`goaltracker` на `127.0.0.1:3100`. Вход — только через Telegram, только ID 65107390.

## Одна команда (веб-консоль DigitalOcean, root)

```bash
cd /opt/goaltracker && git pull --ff-only && bash deploy/go.sh
```

- Если в `/opt/goaltracker/.env` ещё нет `TELEGRAM_BOT_TOKEN`, команда спросит его скрытым вводом.
  Токен из Claude Code Cloud на сервер **не попадает** — его нужно вставить здесь один раз.
- Дальше: сборка образов по одному (5–15 минут на 2 ГБ RAM) → миграции → веб →
  блок `producer.bimoool.com` в Caddyfile (резервная копия, `caddy validate`,
  `systemctl reload caddy`; при ошибке Caddyfile восстанавливается) → бот.
- Повторный запуск безопасен: `.env` не перезаписывается, данные не дублируются,
  чужие контейнеры и сайты не трогаются.

## Один раз в Telegram (без этого кнопка входа не работает)

@BotFather → `/setdomain` → выбрать бота → `producer.bimoool.com`.

## Проверка

```bash
bash /opt/goaltracker/deploy/verify.sh
```

## Как устроен вход

- Официальный Telegram Login Widget → `/auth/telegram/callback`: подпись проверяется на
  сервере (HMAC-SHA256 от токена бота), срок данных — 10 минут, каждая подпись — один раз.
- Пускается только ID из `TELEGRAM_ALLOWED_USER_IDS` (65107390). Регистрации нет.
- Сессия: случайный токен в cookie `__Host-gt_session` (HttpOnly, Secure, SameSite=Lax, 30 дней);
  в БД — только его SHA-256. Каждая страница, действие и API проверяют сессию в БД.
- «Выйти» отзывает сессию на сервере. Выход с чужого сайта отклоняется.
- 10 неудачных попыток входа с IP (или 50 со всех) за 15 минут → блокировка на 15 минут.
- Без токена или allowlist на сервере вход закрыт полностью.

## Обновление

Та же команда: `cd /opt/goaltracker && git pull --ff-only && bash deploy/go.sh`.

## Откат Caddy

```bash
ls /etc/caddy/Caddyfile.bak.*
cp -p /etc/caddy/Caddyfile.bak.<время> /etc/caddy/Caddyfile && caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy
```

## Резервные копии БД (ежедневно, 7 дней)

```bash
mkdir -p /opt/goaltracker-backups && ( crontab -l 2>/dev/null | grep -v goaltracker-backups;
  echo '15 3 * * * cd /opt/goaltracker && docker compose exec -T db pg_dump -U goal goaltracker | gzip > /opt/goaltracker-backups/goal-$(date +\%F).sql.gz && find /opt/goaltracker-backups -name "*.sql.gz" -mtime +7 -delete' ) | crontab -
```

## Резервная копия перед миграцией

`deploy/install.sh` перед запуском миграций вызывает `deploy/backup.sh`:
`pg_dump` из контейнера `db` проекта goaltracker → `/opt/goaltracker-backups/pre-migrate-<время>.sql.gz`
(права 600) → проверка архива → восстановление во временную БД `goaltracker_restore_check`
в том же контейнере → сверка числа строк ключевых таблиц → удаление временной БД.
Если что-то не сходится, миграции не запускаются. Другие контейнеры не затрагиваются.

Вручную: `bash /opt/goaltracker/deploy/backup.sh`.

## Google Sheets (данные проектов)

Чтение таблиц — сервисным аккаунтом Google, только чтение (`spreadsheets.readonly`).
Ключ хранится только в `/opt/goaltracker/.env` как `GOOGLE_SERVICE_ACCOUNT_JSON`
(JSON ключа в base64, одной строкой). Таблица открывается email сервисного аккаунта
с правом «Читатель»; публичной она не становится. Снимок последних успешно полученных
данных хранится в `workspace_sheet_snapshots` и остаётся при сбоях Google.
