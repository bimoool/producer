#!/usr/bin/env bash
# Резервная копия БД Goal Tracker / Producer OS перед миграцией + её проверка.
# Работает ТОЛЬКО с контейнером db проекта compose "goaltracker"; другие контейнеры не трогает.
#   bash deploy/backup.sh            — копия + проверка (используется в install.sh)
# Проверка: gzip целый, дамп завершён, восстановление во временную БД
# goaltracker_restore_check в том же контейнере, сверка числа строк, удаление временной БД.
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/goaltracker}
BACKUP_DIR=${BACKUP_DIR:-/opt/goaltracker-backups}
DB=goaltracker
CHECK_DB=goaltracker_restore_check

# Команды к Postgres. BACKUP_LOCAL=1 — локальные pg_dump/psql (только для тестов).
if [ "${BACKUP_LOCAL:-}" = 1 ]; then
  pgdump() { pg_dump "$LOCAL_URL_BASE/$DB" --no-owner; }
  psqlc() { local db=$1; shift; psql "$LOCAL_URL_BASE/$db" -v ON_ERROR_STOP=1 -q "$@"; }
  db_running() { psql "$LOCAL_URL_BASE/$DB" -c 'select 1' >/dev/null 2>&1; }
else
  cd "$APP_DIR"
  pgdump() { docker compose exec -T db pg_dump -U goal -d "$DB" --no-owner; }
  psqlc() { local db=$1; shift; docker compose exec -T db psql -U goal -d "$db" -v ON_ERROR_STOP=1 -q "$@"; }
  db_running() { docker compose ps --status running db 2>/dev/null | grep -q db; }
fi

if ! db_running; then
  echo "БД ещё не запущена — первая установка, резервная копия не нужна"
  exit 0
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
FILE="$BACKUP_DIR/pre-migrate-$(date +%Y%m%d-%H%M%S).sql.gz"
umask 077

echo "Резервная копия → $FILE"
pgdump | gzip -9 > "$FILE"

gzip -t "$FILE" || { echo "!!! архив повреждён"; exit 1; }
gunzip -c "$FILE" | tail -n 5 | grep -q "PostgreSQL database dump complete" || { echo "!!! дамп неполный"; exit 1; }

COUNT_SQL="select string_agg(t || '=' || n, ' ' order by t) from (
  select 'declaration_items' t, count(*) n from declaration_items union all
  select 'tasks', count(*) from tasks union all
  select 'goals', count(*) from goals union all
  select 'deals', count(*) from deals union all
  select 'weekly_reports', count(*) from weekly_reports union all
  select 'progress_updates', count(*) from progress_updates union all
  select 'activity_log', count(*) from activity_log) s"

echo "Проверка восстановлением во временную БД $CHECK_DB"
psqlc postgres -c "drop database if exists $CHECK_DB" -c "create database $CHECK_DB"
cleanup() { psqlc postgres -c "drop database if exists $CHECK_DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT
gunzip -c "$FILE" | psqlc "$CHECK_DB" >/dev/null
ORIG=$(psqlc "$DB" -At -c "$COUNT_SQL")
COPY=$(psqlc "$CHECK_DB" -At -c "$COUNT_SQL")
if [ "$ORIG" != "$COPY" ]; then
  echo "!!! копия не совпадает с базой"
  echo "база:  $ORIG"
  echo "копия: $COPY"
  exit 1
fi
echo "Копия проверена: $COPY"
echo "Размер: $(du -h "$FILE" | cut -f1). Восстановление: gunzip -c $FILE | docker compose exec -T db psql -U goal -d $DB"
