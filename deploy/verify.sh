#!/usr/bin/env bash
# Проверка развёрнутого сайта. Запускать на Mac: bash deploy/verify.sh
# Пароль спрашивается скрытно и никуда не записывается.
set -uo pipefail
D=${DOMAIN:-producer.bimoool.com}
ok() { printf '✓ %s\n' "$1"; }
bad() { printf '✗ %s\n' "$1"; FAIL=1; }
FAIL=0

code=$(curl -s -o /dev/null -w '%{http_code}' "http://$D/") ; [ "$code" = 301 ] || [ "$code" = 308 ] && ok "http → https редирект ($code)" || bad "http не перенаправляет на https (код $code)"
curl -s -o /dev/null "https://$D/api/health" && ok "сертификат HTTPS валиден" || bad "HTTPS/сертификат не работает"
h=$(curl -s "https://$D/api/health"); [ "$h" = '{"ok":true,"db":true}' ] && ok "база подключена ($h)" || bad "health: $h"
code=$(curl -s -o /dev/null -w '%{http_code}' "https://$D/"); [ "$code" = 401 ] && ok "без пароля — 401" || bad "без пароля код $code"
for p in /declaration /finance /reports /tasks; do
  c=$(curl -s -o /dev/null -w '%{http_code}' "https://$D$p"); [ "$c" = 401 ] || bad "$p без пароля отдаёт $c"
done
ok "личные страницы без пароля закрыты"

read -r -p "Логин: " U
read -r -s -p "Пароль: " P; echo
AUTH=$(printf '%s:%s' "$U" "$P" | base64)
unset P
get() { curl -s -H "Authorization: Basic $AUTH" "https://$D$1"; }
code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Basic $AUTH" "https://$D/"); [ "$code" = 200 ] && ok "вход по паролю — 200" || bad "вход по паролю: код $code"
get /declaration | grep -q "Провести 3 встречи по упаковке и запуску YouTube-канала." && ok "декларация отображается" || bad "декларация не найдена"
get / | grep -q "67" && ok "прогресс 2/3 (67%) на главной" || bad "нет прогресса 2/3"
get /reports | grep -q "Отправлен" && ok "первый отчёт в истории" || bad "нет первого отчёта"
get /finance | grep -q "124 050" && ok "финансы: 124 050 ₽" || bad "нет факта по УММАШ"
hdr=$(curl -sI -H "Authorization: Basic $AUTH" "https://$D/")
echo "$hdr" | grep -qi "strict-transport-security" && ok "HSTS" || bad "нет HSTS"
echo "$hdr" | grep -qi "x-frame-options: deny" && ok "X-Frame-Options" || bad "нет X-Frame-Options"
unset AUTH
[ $FAIL = 0 ] && echo "Все проверки пройдены." || { echo "Есть ошибки."; exit 1; }
