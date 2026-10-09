#!/usr/bin/env bash
# Полный деплой на сервере (веб-консоль DigitalOcean или SSH), из /opt/goaltracker:
#   git pull --ff-only && bash deploy/go.sh
# Если в .env нет TELEGRAM_BOT_TOKEN — спросит его скрытым вводом (на экран не выводится).
# Порядок: .env → приложение (127.0.0.1:3100) → Caddy (сайт) → бот. Ошибка бота сайт не блокирует.
set -euo pipefail
cd /opt/goaltracker

umask 077
touch .env
chmod 600 .env

if ! grep -q '^TELEGRAM_BOT_TOKEN=.' .env; then
  if [ -t 0 ]; then
    read -r -s -p "Вставьте токен Telegram-бота (ввод скрыт) и нажмите Enter: " T
    echo
    if [[ "$T" =~ ^[0-9]{6,}:[A-Za-z0-9_-]{30,}$ ]]; then
      sed -i '/^TELEGRAM_BOT_TOKEN=/d' .env
      printf 'TELEGRAM_BOT_TOKEN=%s\n' "$T" >> .env
      echo "токен сохранён в .env (права 600)"
    else
      echo "это не похоже на токен бота — пропускаю; сайт запустится, вход будет закрыт"
    fi
    unset T
  else
    echo "нет TELEGRAM_BOT_TOKEN в .env — вход будет закрыт"
  fi
fi

bash deploy/install.sh </dev/null
bash deploy/install.sh --caddy </dev/null
