#!/usr/bin/env bash
# Один запуск всего деплоя. Вызывается с Mac (см. deploy/README.md):
#   токен Telegram (если есть) приходит на stdin одной строкой и пишется в .env без вывода.
# Порядок: .env → приложение → Caddy (сайт) → бот. Ошибка бота сайт не блокирует.
set -euo pipefail
cd /opt/goaltracker

umask 077
touch .env
chmod 600 .env

T=""
read -r T || true
if [ -n "$T" ]; then
  sed -i '/^TELEGRAM_BOT_TOKEN=/d' .env
  printf 'TELEGRAM_BOT_TOKEN=%s\n' "$T" >> .env
  echo "токен Telegram сохранён в .env"
fi
unset T
grep -q '^TELEGRAM_ALLOWED_USER_IDS=' .env || echo 'TELEGRAM_ALLOWED_USER_IDS=65107390' >> .env

bash deploy/install.sh </dev/null
bash deploy/install.sh --caddy </dev/null
