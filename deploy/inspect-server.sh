#!/usr/bin/env bash
# Только чтение: ничего не меняет на сервере. Секреты не выводит.
# Запуск на сервере: bash inspect-server.sh 2>&1 | tee /tmp/inspect.txt
set -u
section() { printf '\n===== %s =====\n' "$1"; }

section "OS / ресурсы"
uname -a; (cat /etc/os-release | head -3) 2>/dev/null; uptime; df -h / | tail -1; free -h | head -2

section "Кто слушает 80/443 и другие порты"
(ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | awk 'NR==1 || /:(80|443|3000|3100|5432|8080)\b/'

section "Reverse proxy"
for b in nginx caddy apache2 httpd traefik haproxy; do command -v "$b" >/dev/null && echo "найден: $b ($(command -v $b))"; done
systemctl is-active nginx caddy apache2 2>/dev/null | paste -sd' ' - | sed 's/^/systemd nginx caddy apache2: /'
command -v nginx >/dev/null && { nginx -v 2>&1; nginx -t 2>&1 | tail -2; }

section "Nginx: сайты (server_name и listen)"
if [ -d /etc/nginx ]; then
  grep -RhoE '^\s*(server_name|listen)\s+[^;]+' /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | sed 's/^\s*//' | sort | uniq -c
  ls -la /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null
  grep -Rl "producer.bimoool.com" /etc/nginx 2>/dev/null && echo "!!! producer.bimoool.com уже упоминается в nginx"
fi

section "Caddy"
[ -f /etc/caddy/Caddyfile ] && grep -vE '^\s*#' /etc/caddy/Caddyfile | grep -E '^\S.*\{' || echo "Caddyfile нет"

section "Docker"
if command -v docker >/dev/null; then docker --version; docker compose version 2>/dev/null; docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'; else echo "docker не установлен"; fi

section "Сертификаты Let's Encrypt"
if command -v certbot >/dev/null; then certbot --version 2>&1; certbot certificates 2>/dev/null | grep -E 'Certificate Name|Domains|Expiry'; else echo "certbot не установлен"; fi
ls /etc/letsencrypt/live 2>/dev/null

section "DNS producer.bimoool.com"
(getent hosts producer.bimoool.com || echo "не резолвится") ; echo "IP сервера: $(curl -s -4 --max-time 5 ifconfig.me || hostname -I)"

section "Firewall"
(ufw status 2>/dev/null | head -10) || true

section "Каталог приложения"
ls -la /opt/goaltracker 2>/dev/null || echo "/opt/goaltracker ещё нет"
