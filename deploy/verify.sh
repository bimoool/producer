#!/usr/bin/env bash
# Проверка развёрнутого сайта (можно запускать на сервере или любом компьютере).
set -uo pipefail
D=${DOMAIN:-producer.bimoool.com}
FAIL=0
ok() { printf '✓ %s\n' "$1"; }
bad() { printf '✗ %s\n' "$1"; FAIL=1; }

c=$(curl -s -o /dev/null -w '%{http_code}' "http://$D/"); [[ "$c" =~ ^30[178]$ ]] && ok "http → https ($c)" || bad "http не перенаправляет на https ($c)"
curl -fs -o /dev/null "https://$D/api/health" && ok "HTTPS-сертификат валиден" || bad "HTTPS не работает"
h=$(curl -s "https://$D/api/health"); [ "$h" = '{"ok":true,"db":true}' ] && ok "база подключена" || bad "health: $h"
c=$(curl -s -o /dev/null -w '%{http_code}' "https://$D/login"); [ "$c" = 200 ] && ok "страница входа открывается" || bad "/login: $c"
curl -s "https://$D/login" | grep -q 'Вход не настроен' && bad "на сервере не задан TELEGRAM_BOT_TOKEN"
for p in / /declaration /finance /reports /tasks; do
  c=$(curl -s -o /dev/null -w '%{http_code}' -H 'Accept: text/html' "https://$D$p"); [ "$c" = 303 ] || bad "$p без входа отдаёт $c"
done
c=$(curl -s -o /dev/null -w '%{http_code}' -X POST "https://$D/tasks"); [ "$c" = 401 ] && ok "приватные страницы и действия закрыты без входа" || bad "POST без входа: $c"
curl -sI "https://$D/login" | grep -qi strict-transport-security && ok "HSTS" || bad "нет HSTS"
[ $FAIL = 0 ] && echo "Все проверки пройдены. Откройте https://$D и войдите через Telegram." || exit 1
