# Деплой Goal Tracker на producer.bimoool.com (192.241.141.47)

Схема: Docker Compose (Postgres + веб + бот) на сервере. Веб слушает только
`127.0.0.1:3100`, наружу его отдаёт уже установленный reverse proxy с HTTPS
(Let's Encrypt). Существующие сайты не изменяются: для нового домена — отдельный файл конфигурации.

Все команды выполняются по SSH на сервере (`ssh root@192.241.141.47`), если не сказано иное.

## 0. DNS (в панели регистратора bimoool.com)

A-запись: `producer` → `192.241.141.47`. Проверка: `getent hosts producer.bimoool.com`.

## 1. Осмотр сервера (только чтение)

```bash
curl -fsSL https://raw.githubusercontent.com/bimoool/producer/claude/funny-feynman-4wjyug/deploy/inspect-server.sh -o /tmp/inspect-server.sh
bash /tmp/inspect-server.sh 2>&1 | tee /tmp/inspect.txt
```

Скрипт ничего не меняет и не печатает секреты. Пришлите вывод (`/tmp/inspect.txt`) —
по нему выбирается шаг 5 (nginx / caddy / другое). Если репозиторий уже приватный — скопируйте
скрипт с Mac: `scp deploy/inspect-server.sh root@192.241.141.47:/tmp/`.

## 2. Docker (если не установлен)

```bash
curl -fsSL https://get.docker.com | sh
```

## 3. Код

Публичный репозиторий:
```bash
git clone -b claude/funny-feynman-4wjyug https://github.com/bimoool/producer.git /opt/goaltracker
```

Приватный репозиторий (рекомендуется) — deploy key только на чтение:
```bash
ssh-keygen -t ed25519 -N "" -f /root/.ssh/goaltracker_deploy -C goaltracker-deploy
cat /root/.ssh/goaltracker_deploy.pub
# GitHub → bimoool/producer → Settings → Deploy keys → Add deploy key (без write access) → вставить ключ
GIT_SSH_COMMAND="ssh -i /root/.ssh/goaltracker_deploy" \
  git clone -b claude/funny-feynman-4wjyug git@github.com:bimoool/producer.git /opt/goaltracker
git -C /opt/goaltracker config core.sshCommand "ssh -i /root/.ssh/goaltracker_deploy"
```

## 4. Секреты (`/opt/goaltracker/.env`, права 600, в git не попадает)

```bash
cd /opt/goaltracker
umask 077
{
  echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
  echo "BASIC_AUTH_USER=bim"
  echo "BASIC_AUTH_PASSWORD=$(openssl rand -base64 18)"
} > .env
chmod 600 .env
grep BASIC_AUTH_PASSWORD .env   # пароль для входа на сайт — сохраните в менеджер паролей
```

Токен бота — с Mac (файл не печатается на экран):
```bash
# на Mac:
scp ~/Downloads/envproducer root@192.241.141.47:/opt/goaltracker/envproducer
# на сервере:
cd /opt/goaltracker
TOKEN=$(grep -oE '[0-9]{6,}:[A-Za-z0-9_-]{30,}' envproducer | head -1)
[ -n "$TOKEN" ] && echo "TELEGRAM_BOT_TOKEN=$TOKEN" >> .env && echo "токен добавлен (длина ${#TOKEN})" || echo "токен не найден"
unset TOKEN; shred -u envproducer
```

Ваш Telegram user ID (число, не токен) — узнать у @userinfobot:
```bash
echo "TELEGRAM_ALLOWED_USER_IDS=123456789" >> .env   # замените на свой ID
```

## 5. Запуск

```bash
cd /opt/goaltracker
docker compose up -d --build            # db + migrate + web
curl -s http://127.0.0.1:3100/api/health   # {"ok":true,"db":true}
```

### 5a. Reverse proxy = nginx (отдельный файл, остальные сайты не трогаем)

```bash
cp deploy/nginx-producer.bimoool.com.conf /etc/nginx/sites-available/producer.bimoool.com
ln -s /etc/nginx/sites-available/producer.bimoool.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx      # если nginx -t ругается — НЕ перезагружать, прислать вывод
apt-get install -y certbot python3-certbot-nginx   # если certbot ещё нет
certbot --nginx -d producer.bimoool.com --redirect -m <ваш email> --agree-tos -n
```
Если на сервере используется `conf.d` вместо `sites-enabled` — положить файл в `/etc/nginx/conf.d/producer.bimoool.com.conf`.

### 5b. Reverse proxy = Caddy

Добавить в конец `/etc/caddy/Caddyfile` (сертификат Caddy получит сам):
```
producer.bimoool.com {
    reverse_proxy 127.0.0.1:3100
}
```
`caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy`

## 6. Проверка

```bash
curl -sI https://producer.bimoool.com | head -1            # HTTP/2 401 — сайт закрыт паролем
curl -s -u "bim:<пароль>" -o /dev/null -w "%{http_code}\n" https://producer.bimoool.com/   # 200
```

## 7. Telegram-бот

```bash
cd /opt/goaltracker
docker compose --profile bot up -d --build bot
docker compose logs --tail=20 bot     # ожидается: bot started, allowlist size: 1
```
В Telegram: `/start`, `/today`, `/goals`, `/report`, «Завтра написать клиенту по YouTube».

## Обновление

```bash
cd /opt/goaltracker && git pull && docker compose --profile bot up -d --build
```

## Резервные копии (ежедневно, 7 дней)

```bash
mkdir -p /opt/goaltracker-backups
( crontab -l 2>/dev/null; echo '15 3 * * * cd /opt/goaltracker && docker compose exec -T db pg_dump -U goal goaltracker | gzip > /opt/goaltracker-backups/goal-$(date +\%F).sql.gz && find /opt/goaltracker-backups -name "*.sql.gz" -mtime +7 -delete' ) | crontab -
```

## Переезд на Supabase (позже)

Миграции — обычный SQL (`drizzle/*.sql`). Достаточно указать `DATABASE_URL` из
Supabase (Project Settings → Database → Connection string, режим Session) и выполнить
`docker compose run --rm migrate`. Данные переносятся `pg_dump | psql`.
