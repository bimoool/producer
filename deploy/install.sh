#!/usr/bin/env bash
# Установка/обновление Goal Tracker на сервере (от root):
#   bash /opt/goaltracker/deploy/install.sh           — приложение в Docker на 127.0.0.1:3100
#   bash /opt/goaltracker/deploy/install.sh --caddy   — добавить producer.bimoool.com в Caddyfile
# Идемпотентно: .env не перезаписывается, данные не дублируются,
# чужие контейнеры и сайты не трогаются (только проект compose "goaltracker").
set -euo pipefail

DOMAIN=producer.bimoool.com
APP_DIR=/opt/goaltracker
PORT=3100
CADDYFILE=/etc/caddy/Caddyfile

say() { printf '\n==> %s\n' "$1"; }
die() { printf '\n!!! %s\n' "$1" >&2; exit 1; }

cd "$APP_DIR" || die "нет $APP_DIR"

if [ "${1:-}" = "--caddy" ]; then
  say "Caddy: добавляю только сайт $DOMAIN"
  systemctl is-active --quiet caddy || die "caddy не запущен"
  curl -fs "http://127.0.0.1:$PORT/api/health" >/dev/null || die "приложение на 127.0.0.1:$PORT не отвечает — сначала install.sh без флагов"
  if grep -qE "^[[:space:]]*$DOMAIN([[:space:],{]|$)" "$CADDYFILE"; then
    echo "$DOMAIN уже есть в $CADDYFILE — ничего не меняю"
  else
    BACKUP="$CADDYFILE.bak.$(date +%Y%m%d-%H%M%S)"
    cp -p "$CADDYFILE" "$BACKUP"
    echo "резервная копия: $BACKUP"
    cat >> "$CADDYFILE" <<CADDY

# Goal Tracker (добавлено deploy/install.sh)
$DOMAIN {
	reverse_proxy 127.0.0.1:$PORT {
		# адрес клиента для защиты от перебора; заголовок клиента перезаписывается
		header_up X-Real-IP {remote_host}
	}
}
CADDY
    if ! caddy validate --config "$CADDYFILE" --adapter caddyfile >/tmp/caddy-validate.log 2>&1; then
      cp -p "$BACKUP" "$CADDYFILE"
      tail -5 /tmp/caddy-validate.log
      die "caddy validate не прошёл — Caddyfile восстановлен из копии, reload НЕ выполнялся"
    fi
    echo "caddy validate: OK"
  fi
  systemctl reload caddy
  say "Жду сертификат (до 60 с)"
  for i in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/login" || true)
    [ "$code" = 200 ] && break
    sleep 2
  done
  echo "https://$DOMAIN/login → HTTP $code (ожидается 200)"
  echo "https://$DOMAIN/ без входа → HTTP $(curl -s -o /dev/null -w '%{http_code}' -H 'Accept: text/html' "https://$DOMAIN/") (ожидается 303 на /login)"
  echo "health: $(curl -s "https://$DOMAIN/api/health")"
  exit 0
fi

say "Проверки"
command -v docker >/dev/null || die "docker не установлен"
docker compose version >/dev/null || die "нет docker compose plugin"
if ss -ltn "sport = :$PORT" | grep -q LISTEN && ! docker compose ps --status running web 2>/dev/null | grep -q web; then
  die "порт $PORT занят другим процессом"
fi

say "Секреты в .env (права 600): добавляю только отсутствующие"
umask 077
touch .env
chmod 600 .env
has() { grep -q "^$1=." .env; }
has POSTGRES_PASSWORD || echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)" >> .env
grep -q '^TELEGRAM_ALLOWED_USER_IDS=[0-9]' .env || { sed -i '/^TELEGRAM_ALLOWED_USER_IDS=/d' .env; echo "TELEGRAM_ALLOWED_USER_IDS=65107390" >> .env; }
# Basic Auth больше не используется: удаляем старые значения.
sed -i '/^BASIC_AUTH_USER=/d; /^BASIC_AUTH_PASSWORD=/d' .env
has TELEGRAM_BOT_TOKEN || echo "ВНИМАНИЕ: нет TELEGRAM_BOT_TOKEN — сайт запустится, но вход будет закрыт"

say "Ключ Google (только чтение таблиц)"
KEY_HOST=$(grep -E '^GOOGLE_SERVICE_ACCOUNT_FILE_HOST=' .env | cut -d= -f2- || true)
KEY_HOST=${KEY_HOST:-/etc/goaltracker/google-service-account.json}
KEY_UID=10001
sed -i '/^COMPOSE_FILE=/d' .env
if [ -f "$KEY_HOST" ]; then
  # Проверяем формат, не выводя содержимое (печатается только email сервисного аккаунта).
  KEY_EMAIL=$(python3 -I -c '
import json, sys
try:
    d = json.load(open(sys.argv[1]))
    assert isinstance(d.get("client_email"), str) and "PRIVATE KEY" in d.get("private_key", "")
    print(d["client_email"])
except Exception:
    sys.exit(1)
' "$KEY_HOST") || die "файл ключа $KEY_HOST повреждён или это не ключ сервисного аккаунта"
  if getent passwd "$KEY_UID" >/dev/null; then
    die "uid $KEY_UID занят пользователем $(getent passwd $KEY_UID | cut -d: -f1) — ключ не будет передан ему; нужна ручная проверка"
  fi
  # Владелец — отдельный uid контейнера web, права 400: на хосте ключ читает только root.
  chown "$KEY_UID:$KEY_UID" "$KEY_HOST"
  chmod 400 "$KEY_HOST"
  echo "COMPOSE_FILE=docker-compose.yml:docker-compose.google.yml" >> .env
  echo "ключ найден ($KEY_EMAIL), подключается в контейнер только для чтения"
else
  echo "файла ключа $KEY_HOST нет — сайт запустится, разделы проекта покажут «не настроено»"
fi

say "Сборка образов по одному (экономия памяти)"
export COMPOSE_PARALLEL_LIMIT=1
docker compose build migrate
docker compose build web
docker image prune -f --filter "label=com.docker.compose.project=goaltracker" >/dev/null 2>&1 || true

say "Резервная копия БД перед миграцией (с проверкой восстановлением)"
bash deploy/backup.sh || die "резервная копия не создана или не прошла проверку — миграции НЕ запускались"

say "Запуск (db → migrate → web)"
docker compose up -d db migrate web
for i in $(seq 1 40); do
  curl -fs "http://127.0.0.1:$PORT/api/health" >/dev/null && break
  sleep 3
done
curl -fs "http://127.0.0.1:$PORT/api/health" || die "приложение не отвечает: docker compose logs --tail=50 web migrate"
echo

if has TELEGRAM_BOT_TOKEN && grep -q '^TELEGRAM_ALLOWED_USER_IDS=[0-9]' .env; then
  say "Telegram-бот"
  # Бот не должен мешать сайту: ошибка здесь не прерывает установку.
  if docker compose --profile bot up -d bot; then
    sleep 5
    docker compose logs --tail=3 bot || true
  else
    echo "бот не запустился — сайт работает, бот можно поднять позже"
  fi
else
  echo "Бот не запущен: в .env нет TELEGRAM_BOT_TOKEN или TELEGRAM_ALLOWED_USER_IDS"
fi

if grep -q '^COMPOSE_FILE=.*docker-compose.google.yml' .env; then
  say "Проверка загрузки Google-таблиц (печатается только количество записей)"
  # Не прерывает установку: сайт уже работает, ошибка видна здесь и на странице проекта.
  docker compose --profile tools run --rm sheets-check || echo "!!! загрузка таблиц не удалась — см. сообщение выше"
fi

docker compose ps
say "Готово. Домен: bash deploy/install.sh --caddy"
