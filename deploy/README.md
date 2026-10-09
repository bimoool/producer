# Деплой Goal Tracker → https://producer.bimoool.com

Схема: Docker Compose (Postgres + веб + бот) на сервере 192.241.141.47.
Веб слушает только `127.0.0.1:3100`; наружу его отдаёт существующий nginx
с сертификатом Let's Encrypt от существующего certbot. Для домена добавляется
один новый файл nginx — конфиги других сайтов не меняются.

Все команды — в Терминале на Mac. Пароли и ключи никуда пересылать не нужно.

## 0. DNS

У регистратора bimoool.com: A-запись `producer` → `192.241.141.47`.
Проверка на Mac: `dig +short producer.bimoool.com` → `192.241.141.47`.

## 1. Осмотр сервера (только чтение)

```bash
curl -fsSL https://raw.githubusercontent.com/bimoool/producer/claude/funny-feynman-4wjyug/deploy/inspect-server.sh \
  | ssh root@192.241.141.47 'bash -s' | tee ~/goaltracker-inspect.txt
```

Скрипт ничего не меняет и не выводит секреты. Если в выводе есть
«найден: nginx», «certbot» и порт 3100 свободен — можно переходить к шагу 2.
Иначе пришлите `~/goaltracker-inspect.txt` в чат.

## 2. Код на сервер

```bash
ssh root@192.241.141.47 'command -v docker || curl -fsSL https://get.docker.com | sh'
ssh root@192.241.141.47 'git clone -b claude/funny-feynman-4wjyug https://github.com/bimoool/producer.git /opt/goaltracker \
  || git -C /opt/goaltracker pull'
```

Если репозиторий уже приватный — см. «Приватный репозиторий» внизу.

## 3. Токен бота и ваш Telegram ID → `/opt/goaltracker/.env` на сервере

Токен идёт из файла прямо в `.env` через SSH: не показывается на экране,
не попадает в историю команд и в git.

```bash
ssh root@192.241.141.47 'mkdir -p /opt/goaltracker && touch /opt/goaltracker/.env && chmod 600 /opt/goaltracker/.env'
grep -oE '[0-9]{6,}:[A-Za-z0-9_-]{30,}' ~/Downloads/envproducer | head -1 | ssh root@192.241.141.47 \
  'read -r T; [ -n "$T" ] || { echo "токен не найден"; exit 1; }; f=/opt/goaltracker/.env;
   sed -i "/^TELEGRAM_BOT_TOKEN=/d" $f; printf "TELEGRAM_BOT_TOKEN=%s\n" "$T" >> $f; echo "токен сохранён (длина ${#T})"'
```

Telegram user ID — число от @userinfobot (это не токен):
```bash
ssh root@192.241.141.47 'sed -i "/^TELEGRAM_ALLOWED_USER_IDS=/d" /opt/goaltracker/.env; echo "TELEGRAM_ALLOWED_USER_IDS=ВАШ_ID" >> /opt/goaltracker/.env'
```

## 4. Запуск приложения

```bash
ssh -t root@192.241.141.47 'bash /opt/goaltracker/deploy/install.sh'
```

Скрипт создаст недостающие пароли в `.env` (покажет пароль для входа на сайт
один раз — сохраните его), соберёт контейнеры, применит миграции и проверит
`/api/health`. Повторный запуск безопасен: `.env` не перезаписывается,
данные не дублируются (каждая миграция выполняется один раз).

## 5. Домен и HTTPS

```bash
ssh -t root@192.241.141.47 'bash /opt/goaltracker/deploy/install.sh --nginx'
```

Что делает: кладёт отдельный файл `producer.bimoool.com` в nginx, проверяет
`nginx -t` (при ошибке убирает файл и **не** перезагружает nginx), делает
`reload` и выпускает сертификат существующим certbot (`certbot --nginx`,
с редиректом на https). Продление — тем же механизмом, что у остальных сайтов.
Скрипт останавливается, если домен уже описан в другом конфиге, nginx не
запущен или нет certbot.

## 6. Проверка

```bash
curl -fsSL https://raw.githubusercontent.com/bimoool/producer/claude/funny-feynman-4wjyug/deploy/verify.sh -o /tmp/verify.sh
bash /tmp/verify.sh
```

Проверяет: редирект на https, сертификат, базу, 401 без пароля на всех
личных страницах, вход, декларацию, прогресс 2/3, первый отчёт, финансы,
заголовки безопасности. Пароль спрашивается скрыто.

Затем — с телефона открыть https://producer.bimoool.com.

Сохранность при перезапуске:
```bash
ssh root@192.241.141.47 'cd /opt/goaltracker && docker compose restart && sleep 8 && curl -s 127.0.0.1:3100/api/health &&
  docker compose exec -T db psql -U goal -d goaltracker -c "select position, current_value, status from declaration_items order by 1"'
```

## Обновление приложения

```bash
ssh -t root@192.241.141.47 'cd /opt/goaltracker && git pull && bash deploy/install.sh'
```

Данные живут в docker-томе `goaltracker_pgdata` и при обновлении не трогаются.

## Защита

- Basic Auth работает только за HTTPS (http → https редирект от certbot, HSTS).
- Перебор пароля: 10 неверных попыток с IP (или 50 со всех IP) за 15 минут →
  429 на 15 минут; плюс `limit_req` в nginx.
- Без `BASIC_AUTH_*` приложение не пускает никого.
- Postgres не публикует порт наружу; веб — только на 127.0.0.1.
- В логах приложения и nginx нет паролей и токена.

## Резервные копии (ежедневно, хранить 7 дней)

```bash
ssh root@192.241.141.47 'mkdir -p /opt/goaltracker-backups && ( crontab -l 2>/dev/null | grep -v goaltracker-backups;
  echo "15 3 * * * cd /opt/goaltracker && docker compose exec -T db pg_dump -U goal goaltracker | gzip > /opt/goaltracker-backups/goal-\$(date +\%F).sql.gz && find /opt/goaltracker-backups -name \"*.sql.gz\" -mtime +7 -delete" ) | crontab -'
```

## Приватный репозиторий

После перевода в Private серверу нужен ключ только на чтение:
```bash
ssh root@192.241.141.47 'ssh-keygen -t ed25519 -N "" -f /root/.ssh/goaltracker_deploy -C goaltracker && cat /root/.ssh/goaltracker_deploy.pub'
# GitHub → bimoool/producer → Settings → Deploy keys → Add (без Allow write access) → вставить ключ
ssh root@192.241.141.47 'cd /opt/goaltracker && git remote set-url origin git@github.com:bimoool/producer.git &&
  git config core.sshCommand "ssh -i /root/.ssh/goaltracker_deploy -o StrictHostKeyChecking=accept-new" && git pull'
```
Скрипты из шагов 1 и 6 тогда берите из локальной копии репозитория.

## Переезд на Supabase (позже)

Указать в `.env` `DATABASE_URL` из Supabase и выполнить `docker compose run --rm migrate`;
данные переносятся через `pg_dump | psql`.
