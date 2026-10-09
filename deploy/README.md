# Деплой Goal Tracker → https://producer.bimoool.com

Сервер 192.241.141.47: на хосте работает Caddy (порты 80/443, автоматический HTTPS).
Приложение — Docker Compose-проект `goaltracker` (Postgres + веб + бот), веб слушает
только `127.0.0.1:3100`. В Caddyfile добавляется один новый блок сайта; существующие
блоки и чужие контейнеры не трогаются.

Все команды — на Mac. Для краткости:

```bash
S="ssh -i ~/.ssh/vps_deploy -o IdentitiesOnly=yes root@192.241.141.47"
```

1. Код на сервер:
   ```bash
   $S 'git clone -b claude/funny-feynman-4wjyug https://github.com/bimoool/producer.git /opt/goaltracker || git -C /opt/goaltracker pull --ff-only'
   ```
2. Токен бота → `/opt/goaltracker/.env` (600), без вывода на экран:
   ```bash
   grep -oE '[0-9]{6,}:[A-Za-z0-9_-]{30,}' ~/Downloads/envproducer.txt | head -1 | $S 'umask 077; f=/opt/goaltracker/.env; touch $f; chmod 600 $f; read -r T; [ -n "$T" ] || { echo "токен не найден"; exit 1; }; sed -i "/^TELEGRAM_BOT_TOKEN=/d" $f; printf "TELEGRAM_BOT_TOKEN=%s\n" "$T" >> $f; echo "токен сохранён"'
   ```
   Telegram user ID (число от @userinfobot, не токен):
   ```bash
   $S 'f=/opt/goaltracker/.env; sed -i "/^TELEGRAM_ALLOWED_USER_IDS=/d" $f; echo "TELEGRAM_ALLOWED_USER_IDS=ВАШ_ID" >> $f'
   ```
3. Сборка и запуск (образы собираются по одному; 5–15 минут на 2 ГБ RAM):
   ```bash
   $S 'bash /opt/goaltracker/deploy/install.sh'
   ```
4. Домен в Caddy (резервная копия Caddyfile → добавление блока → `caddy validate` →
   `systemctl reload caddy`; при ошибке валидации Caddyfile восстанавливается, reload не делается):
   ```bash
   $S 'bash /opt/goaltracker/deploy/install.sh --caddy'
   ```
5. Проверка: `bash deploy/verify.sh` (из локальной копии репозитория) и браузер на телефоне.

Пароль входа на сайт (логин `bim`) генерируется на шаге 3 и хранится только в
`/opt/goaltracker/.env`. Посмотреть: `$S 'grep ^BASIC_AUTH_PASSWORD= /opt/goaltracker/.env'`.

## Обновление

```bash
$S 'cd /opt/goaltracker && git pull --ff-only && bash deploy/install.sh'
```
Данные в томе `goaltracker_pgdata`; миграции применяются один раз — без дублей.

## Откат Caddy

```bash
$S 'ls /etc/caddy/Caddyfile.bak.*'      # выбрать копию
$S 'cp -p /etc/caddy/Caddyfile.bak.<время> /etc/caddy/Caddyfile && caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy'
```

## Резервные копии БД (ежедневно, 7 дней)

```bash
$S 'mkdir -p /opt/goaltracker-backups && ( crontab -l 2>/dev/null | grep -v goaltracker-backups;
  echo "15 3 * * * cd /opt/goaltracker && docker compose exec -T db pg_dump -U goal goaltracker | gzip > /opt/goaltracker-backups/goal-\$(date +\%F).sql.gz && find /opt/goaltracker-backups -name \"*.sql.gz\" -mtime +7 -delete" ) | crontab -'
```
