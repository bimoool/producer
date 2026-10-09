#!/usr/bin/env bash
# Установка/обновление Goal Tracker на сервере. Запускать на сервере от root:
#   bash /opt/goaltracker/deploy/install.sh            — приложение (Docker), без изменения nginx
#   bash /opt/goaltracker/deploy/install.sh --nginx    — плюс vhost producer.bimoool.com и сертификат
# Скрипт идемпотентен: повторный запуск не создаёт дублей данных и не трогает .env.
set -euo pipefail

DOMAIN=producer.bimoool.com
APP_DIR=/opt/goaltracker
PORT=3100
WITH_NGINX=0
[ "${1:-}" = "--nginx" ] && WITH_NGINX=1

say() { printf '\n==> %s\n' "$1"; }
die() { printf '\n!!! %s\n' "$1" >&2; exit 1; }

cd "$APP_DIR" || die "нет $APP_DIR — сначала git clone"

say "Проверки"
command -v docker >/dev/null || die "docker не установлен (curl -fsSL https://get.docker.com | sh)"
docker compose version >/dev/null || die "нет docker compose plugin"
if ss -ltn "sport = :$PORT" | grep -q LISTEN && ! docker compose ps --status running web 2>/dev/null | grep -q web; then
  die "порт 127.0.0.1:$PORT занят другим процессом — задайте WEB_PORT в .env и поправьте proxy_pass"
fi

say "Секреты в .env (права 600): добавляю только отсутствующие"
umask 077
touch .env
chmod 600 .env
has() { grep -q "^$1=." .env; }
has POSTGRES_PASSWORD || echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)" >> .env
has BASIC_AUTH_USER || echo "BASIC_AUTH_USER=bim" >> .env
if ! has BASIC_AUTH_PASSWORD; then
  echo "BASIC_AUTH_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-20)" >> .env
  echo "Создан пароль для входа на сайт (логин: $(grep '^BASIC_AUTH_USER=' .env | cut -d= -f2-)). Сохраните его в менеджер паролей:"
  grep '^BASIC_AUTH_PASSWORD=' .env | cut -d= -f2-
fi

say "Сборка и запуск (db → migrate → web)"
docker compose up -d --build
for i in $(seq 1 30); do
  curl -fs "http://127.0.0.1:$PORT/api/health" >/dev/null && break
  sleep 2
done
curl -fs "http://127.0.0.1:$PORT/api/health" || die "приложение не отвечает: docker compose logs --tail=50 web"
echo

if grep -q '^TELEGRAM_BOT_TOKEN=.' .env && grep -q '^TELEGRAM_ALLOWED_USER_IDS=[0-9]' .env; then
  say "Telegram-бот"
  docker compose --profile bot up -d --build bot
  sleep 5
  docker compose logs --tail=5 bot
else
  echo "Бот не запущен: в .env нет TELEGRAM_BOT_TOKEN или TELEGRAM_ALLOWED_USER_IDS"
fi

[ "$WITH_NGINX" = 1 ] || { say "Готово (nginx не трогал). Для домена: bash deploy/install.sh --nginx"; exit 0; }

say "nginx: только новый файл для $DOMAIN"
command -v nginx >/dev/null && systemctl is-active --quiet nginx || die "nginx не запущен — этот шаг рассчитан на nginx. Пришлите вывод inspect-server.sh"
if grep -RlsE "server_name[^;]*\b$DOMAIN\b" /etc/nginx --exclude="$DOMAIN" --exclude="$DOMAIN.conf" | grep -q .; then
  die "$DOMAIN уже описан в другом конфиге nginx — не трогаю, нужна ручная проверка"
fi
if [ -d /etc/nginx/sites-available ] && grep -qs "sites-enabled" /etc/nginx/nginx.conf; then
  DEST=/etc/nginx/sites-available/$DOMAIN
  install -m 644 deploy/nginx-producer.bimoool.com.conf "$DEST.new"
  [ -f "$DEST" ] && cp "$DEST" "$DEST.bak.$(date +%s)"
  mv "$DEST.new" "$DEST"
  ln -sf "$DEST" /etc/nginx/sites-enabled/$DOMAIN
else
  DEST=/etc/nginx/conf.d/$DOMAIN.conf
  [ -f "$DEST" ] && cp "$DEST" "/root/$DOMAIN.conf.bak.$(date +%s)"
  install -m 644 deploy/nginx-producer.bimoool.com.conf "$DEST"
fi
if ! nginx -t; then
  rm -f "/etc/nginx/sites-enabled/$DOMAIN" "/etc/nginx/conf.d/$DOMAIN.conf"
  die "nginx -t не прошёл — новый конфиг убран, nginx НЕ перезагружался"
fi
systemctl reload nginx

say "HTTPS через существующий certbot"
command -v certbot >/dev/null || die "certbot не найден — пришлите вывод inspect-server.sh, выберем способ"
getent hosts "$DOMAIN" >/dev/null || die "DNS для $DOMAIN не настроен (A → IP сервера)"
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  certbot --nginx -d "$DOMAIN" --redirect --non-interactive --keep-until-expiring
else
  certbot --nginx -d "$DOMAIN" --redirect --non-interactive --agree-tos --register-unsafely-without-email
fi
nginx -t && systemctl reload nginx

say "Проверка"
curl -sI "https://$DOMAIN" | head -1
echo "Ожидается 401 (сайт закрыт паролем). Откройте https://$DOMAIN в браузере."
