#!/usr/bin/env bash
# Authorized Producer OS release only. Build images on the runner, not this VPS.
set -euo pipefail
umask 077
readonly app_dir=/opt/goaltracker
readonly release_sha=5963019e10bd8a24f6cf0e74978e40a732b6dbf8
readonly expected_current=${PRODUCER_EXPECTED_CURRENT:-5a038c073b850e3e9b487c608ac1bd10e2cbad00}
readonly old_report=b62821db-b04b-4905-9f3a-8c9ad9e5d792
readonly web_tag=goaltracker-web:release-5963019
readonly tools_tag=goaltracker-tools:release-5963019
[ "$(id -u)" = 0 ] || { echo 'Release requires the authorized VPS root account.' >&2; exit 1; }
cd "$app_dir"
export COMPOSE_PARALLEL_LIMIT=1
install -d -m 700 /opt/goaltracker-backups
exec 9>/opt/goaltracker-backups/weekly-reports-release.lock
flock -n 9 || { echo 'Another Producer release holds the lock.' >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo 'Tracked or untracked checkout changes: stop for review.' >&2; exit 1; }
current_sha=$(git rev-parse HEAD)
[ "$current_sha" = "$expected_current" ] || { echo "Unexpected checkout commit: $current_sha; release stopped." >&2; exit 1; }
# Read-only fetch, exact authorized revision, without resetting any local work.
GIT_TERMINAL_PROMPT=0 git fetch origin fix/weekly-reports-current-week
[ "$(git rev-parse FETCH_HEAD)" = "$release_sha" ] || { echo 'Release branch tip differs from authorized SHA.' >&2; exit 1; }
git merge-base --is-ancestor "$current_sha" "$release_sha" || { echo 'Production diverged from the reviewed release.' >&2; exit 1; }
web_image=$(docker image inspect --format '{{.Id}}' "$web_tag")
tools_image=$(docker image inspect --format '{{.Id}}' "$tools_tag")
for image in "$web_image" "$tools_image"; do
  [ "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")" = "$release_sha" ] || { echo 'Image release label mismatch.' >&2; exit 1; }
done
# Derive exact active files rather than dropping custom Google/secret mounts.
mapfile -t running_web < <(docker ps -q --filter label=com.docker.compose.project=goaltracker --filter label=com.docker.compose.service=web)
[ "${#running_web[@]}" = 1 ] || { echo 'Expected exactly one running Producer web container.' >&2; exit 1; }
old_web=${running_web[0]}
old_web_image=$(docker inspect --format '{{.Image}}' "$old_web")
config_files=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}' "$old_web")
[ -n "$config_files" ] && [ "$config_files" != '<no value>' ] || { echo 'Cannot establish active Compose configuration.' >&2; exit 1; }
IFS=, read -r -a active_files <<< "$config_files"
compose=(docker compose --project-directory "$app_dir" -p goaltracker)
for file in "${active_files[@]}"; do
  [ -f "$file" ] || { echo 'An active Compose configuration file is missing.' >&2; exit 1; }
  compose+=(-f "$file")
done
mapfile -t db_containers < <(docker ps -q --filter label=com.docker.compose.project=goaltracker --filter label=com.docker.compose.service=db)
[ "${#db_containers[@]}" = 1 ] || { echo 'Expected exactly one running Producer database container.' >&2; exit 1; }
production_db=${db_containers[0]}
[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$production_db")" = "$app_dir" ] || { echo 'Unexpected database working directory.' >&2; exit 1; }
postgres_image=$(docker inspect --format '{{.Image}}' "$production_db")
docker exec "$production_db" pg_isready -U goal -d goaltracker >/dev/null
[ "$(docker exec "$production_db" psql -U goal -d goaltracker -At -c 'show server_version_num')" -ge 160000 ] || { echo 'PostgreSQL 16 or newer required.' >&2; exit 1; }
[ "$(curl -fsS --max-time 15 http://127.0.0.1:3100/api/health)" = '{"ok":true,"db":true}' ] || { echo 'Production baseline health failed.' >&2; exit 1; }
mapfile -t old_bots < <(docker ps -q --filter label=com.docker.compose.project=goaltracker --filter label=com.docker.compose.service=bot)
[ "${#old_bots[@]}" -le 1 ] || { echo 'More than one Producer bot is running; stop for review.' >&2; exit 1; }
bot_was_running=0
if [ "${#old_bots[@]}" = 1 ]; then bot_was_running=1; fi
# Reserve space for the backup and restore copy before entering maintenance.
free_kb=$(df -Pk /opt/goaltracker-backups | awk 'NR==2 { print $4 }')
db_bytes=$(docker exec "$production_db" psql -U goal -d goaltracker -At -c 'select pg_database_size(current_database())')
[ "$free_kb" -gt "$((db_bytes / 1024 * 3 + 524288))" ] || { echo 'Insufficient disk for backup and rehearsal.' >&2; exit 1; }
release_stamp=$(date -u +%Y%m%dT%H%M%SZ)-$$
backup_dir=/opt/goaltracker-backups/weekly-reports-$release_stamp
install -d -m 700 "$backup_dir"
printf '%s\n' "$current_sha" > "$backup_dir/previous-commit"
printf '%s\n' "$old_web" > "$backup_dir/previous-web-container"
printf '%s\n' "$old_web_image" > "$backup_dir/previous-web-image"
printf '%s\n' "$bot_was_running" > "$backup_dir/bot-was-running"
printf '%s\n' "$config_files" > "$backup_dir/compose-files"
docker tag "$old_web_image" "goaltracker-web:rollback-$release_stamp"
if [ "$bot_was_running" = 1 ]; then
  docker inspect --format '{{.Image}}' "${old_bots[0]}" > "$backup_dir/previous-bot-image"
  docker tag "$(cat "$backup_dir/previous-bot-image")" "goaltracker-tools:rollback-$release_stamp"
fi
# The override preserves all active environment bindings, mounts, ports and limits.
override=$backup_dir/release.override.yml
cat > "$override" <<YAML
services:
  web:
    image: $web_image
  migrate:
    image: $tools_image
    command: ["node_modules/.bin/tsx", "src/db/migrate.ts"]
  bot:
    image: $tools_image
YAML
release_compose=("${compose[@]}" -f "$override")
printf '%s\n' "PRODUCER_BACKUP_DIR=$backup_dir"
maintenance_started=0
production_migration_started=0
release_web_started=0
rehearsal_created=0
network_created=0
volume_created=0
rehearsal=goaltracker-release-check-$release_stamp
cleanup_rehearsal() {
  if [ "$rehearsal_created" = 1 ]; then docker rm -f "$rehearsal" >/dev/null 2>&1 || true; fi
  if [ "$volume_created" = 1 ]; then docker volume rm "$rehearsal" >/dev/null 2>&1 || true; fi
  if [ "$network_created" = 1 ]; then docker network rm "$rehearsal" >/dev/null 2>&1 || true; fi
}
finish() {
  rc=$?
  trap - EXIT
  cleanup_rehearsal
  if [ "$rc" != 0 ]; then
    if [ "$production_migration_started" = 0 ] && [ "$maintenance_started" = 1 ]; then
      # The original containers were stopped, not removed, before rehearsal.
      docker start "$old_web" >/dev/null 2>&1 || true
      if [ "$bot_was_running" = 1 ]; then docker start "${old_bots[0]}" >/dev/null 2>&1 || true; fi
      echo 'RELEASE_STOPPED_BEFORE_PRODUCTION_MIGRATION: original services restarted.' >&2
    elif [ "$production_migration_started" = 1 ]; then
      # Never restore a stale dump or run old writers against the new schema.
      "${release_compose[@]}" stop web >/dev/null 2>&1 || true
      if [ "$bot_was_running" = 1 ]; then docker stop "${old_bots[0]}" >/dev/null 2>&1 || true; fi
      docker exec "$production_db" pg_dump -U goal -d goaltracker --format=custom --no-owner > "$backup_dir/post-failure.dump" 2>/dev/null || true
      echo 'RELEASE_STOPPED_AFTER_MIGRATION: writers stopped; retain database and backups for forward repair.' >&2
    fi
    echo "PRODUCER_FAILURE_BACKUP_DIR=$backup_dir" >&2
  fi
  exit "$rc"
}
trap finish EXIT
# Stop only the running containers belonging to this Compose project.
maintenance_started=1
docker stop --time 30 "$old_web" >/dev/null
if [ "$bot_was_running" = 1 ]; then docker stop --time 30 "${old_bots[0]}" >/dev/null; fi
psql_db() {
  local container=$1; shift
  if [ "$#" -gt 0 ]; then
    docker exec -e PGOPTIONS="-c timezone=UTC" "$container" psql -U goal -d goaltracker -v ON_ERROR_STOP=1 -qAt "$@" </dev/null
  else
    docker exec -i -e PGOPTIONS="-c timezone=UTC" "$container" psql -U goal -d goaltracker -v ON_ERROR_STOP=1 -qAt
  fi
}
history_sql="select id, md5(jsonb_build_array(id, week_number, period_start, period_end, status, fields, content, original_text, facts, sent_on, extract(epoch from created_at), extract(epoch from updated_at))::text) from weekly_reports order by id"
finance_sql="select id, md5(to_jsonb(d)::text) from deals d order by id"
immutable_history_sql="select id, md5(jsonb_build_array(id, week_number, period_start, period_end, status, fields, content, original_text, facts, sent_on, extract(epoch from created_at), extract(epoch from updated_at))::text) from weekly_reports where period_end < '2026-11-13' or status = 'sent' order by id"
printf '%s\n' "$history_sql" > "$backup_dir/history.sql"
printf '%s\n' "$finance_sql" > "$backup_dir/finance.sql"
printf '%s\n' "$immutable_history_sql" > "$backup_dir/immutable-history.sql"
# All values here are local paths, public commit IDs, image IDs or a boolean.
{
  printf 'BACKUP_DIR=%q\n' "$backup_dir"
  printf 'RELEASE_SHA=%q\n' "$release_sha"
  printf 'PREVIOUS_SHA=%q\n' "$current_sha"
  printf 'PRODUCTION_DB_CONTAINER=%q\n' "$production_db"
  printf 'OLD_WEB_CONTAINER=%q\n' "$old_web"
  printf 'RELEASE_WEB_IMAGE=%q\n' "$web_image"
  printf 'RELEASE_TOOLS_IMAGE=%q\n' "$tools_image"
  printf 'BOT_WAS_RUNNING=%q\n' "$bot_was_running"
  printf 'RELEASE_OVERRIDE=%q\n' "$override"
  declare -p compose release_compose
} > "$backup_dir/state.env"
snapshot() {
  local container=$1 suffix=$2
  psql_db "$container" -c "$history_sql" > "$backup_dir/history.$suffix"
  psql_db "$container" -c "$finance_sql" > "$backup_dir/finance.$suffix"
  psql_db "$container" -c "$immutable_history_sql" > "$backup_dir/immutable-history.$suffix"
  psql_db "$container" <<'SQL' > "$backup_dir/counts.$suffix"
SELECT format('select %L, count(*) from %I.%I;', schemaname || '.' || tablename, schemaname, tablename)
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
\gexec
SQL
}
# Refuse an absent/unexpected November 6 report instead of inventing a fixture.
[ "$(psql_db "$production_db" -c "select count(*) from weekly_reports where id = '$old_report' and status = 'sent' and period_start = '2026-10-31' and period_end = '2026-11-06'")" = 1 ] || { echo 'Historical November 6 report does not match expected identity/status/period.' >&2; exit 1; }
[ "$(psql_db "$production_db" -c "select count(*) from declarations where id = '00000000-0000-4000-8000-000000000001'")" = 1 ] || { echo 'Original declaration is missing.' >&2; exit 1; }
[ "$(psql_db "$production_db" -c 'select count(*) from (select period_end from weekly_reports group by period_end having count(*) > 1) duplicates')" = 0 ] || { echo 'Ambiguous legacy report dates; manual diagnosis required.' >&2; exit 1; }
# Multiple legacy declarations cannot safely be assigned by inference.
[ "$(psql_db "$production_db" -c 'select count(*) from declarations')" = 1 ] || { echo 'Multiple declarations require explicit legacy identity review.' >&2; exit 1; }
snapshot "$production_db" before
docker exec "$production_db" pg_dump -U goal -d goaltracker --format=custom --no-owner > "$backup_dir/goaltracker.dump"
test -s "$backup_dir/goaltracker.dump"
sha256sum "$backup_dir/goaltracker.dump" > "$backup_dir/SHA256SUMS"
# Dedicated internal network and fresh volume. Never attach to the production network.
for resource_type in container volume network; do
  if docker "$resource_type" inspect "$rehearsal" >/dev/null 2>&1; then
    echo 'Refusing a pre-existing rehearsal resource.' >&2
    exit 1
  fi
done
docker network create --internal "$rehearsal" >/dev/null
network_created=1
docker volume create "$rehearsal" >/dev/null
volume_created=1
docker run -d --name "$rehearsal" --network "$rehearsal" --memory 192m \
  --mount "type=volume,src=$rehearsal,dst=/var/lib/postgresql/data" \
  -e POSTGRES_USER=goal -e POSTGRES_DB=goaltracker -e POSTGRES_HOST_AUTH_METHOD=trust \
  "$postgres_image" postgres -c shared_buffers=16MB -c max_connections=10 >/dev/null
rehearsal_created=1
for attempt in {1..60}; do
  if docker exec "$rehearsal" pg_isready -U goal -d goaltracker >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$rehearsal" pg_isready -U goal -d goaltracker >/dev/null
docker exec -i "$rehearsal" pg_restore -U goal -d goaltracker --no-owner --exit-on-error < "$backup_dir/goaltracker.dump"
snapshot "$rehearsal" restored
for data in history immutable-history finance counts; do cmp "$backup_dir/$data.before" "$backup_dir/$data.restored"; done
echo 'PRODUCER_RESTORE_VERIFIED=1'
for attempt in 1 2; do
  docker run --rm --network "$rehearsal" --memory 192m \
    -e "DATABASE_URL=postgres://goal@$rehearsal:5432/goaltracker" \
    "$tools_image" node_modules/.bin/tsx src/db/migrate.ts
done
snapshot "$rehearsal" migrated
for data in history immutable-history finance counts; do cmp "$backup_dir/$data.before" "$backup_dir/$data.migrated"; done
[ "$(psql_db "$rehearsal" -c "select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'weekly_reports' and column_name in ('declaration_id','report_date','coverage_start','coverage_end','cutoff_date')")" = 5 ]
[ "$(psql_db "$rehearsal" -c "select count(*) from pg_index where indexrelid = 'weekly_reports_declaration_date_unique'::regclass and indisunique and indisvalid")" = 1 ]
# A rejected statement rolls back completely in its PL/pgSQL subtransaction.
psql_db "$rehearsal" <<SQL
DO \$guard\$
DECLARE message text;
BEGIN
  BEGIN
    UPDATE weekly_reports SET content = 'release guard probe' WHERE id = '$old_report';
    RAISE EXCEPTION 'REPORT_GUARD_FAILED';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS message = MESSAGE_TEXT;
    IF position('REPORT_SENT:' in message) <> 1 THEN RAISE; END IF;
  END;
END
\$guard\$;
SQL
snapshot "$rehearsal" guarded
for data in history immutable-history finance counts; do cmp "$backup_dir/$data.before" "$backup_dir/$data.guarded"; done
echo 'PRODUCER_REHEARSAL_MIGRATION_AND_HISTORY_VERIFIED=1'
# Release memory before starting the production migration/web.
cleanup_rehearsal
rehearsal_created=0
network_created=0
volume_created=0
# The restore rehearsal succeeded; only now alter the production schema/checkout.
git checkout --detach "$release_sha"
production_migration_started=1
"${release_compose[@]}" run --rm --no-deps -T migrate </dev/null
snapshot "$production_db" after
for data in history immutable-history finance counts; do cmp "$backup_dir/$data.before" "$backup_dir/$data.after"; done
echo 'PRODUCER_PRODUCTION_HISTORY_AND_FINANCE_UNCHANGED=1'
"${release_compose[@]}" up -d --no-deps --no-build web
release_web_started=1
for attempt in {1..60}; do
  if [ "$(curl -fsS --max-time 5 http://127.0.0.1:3100/api/health 2>/dev/null || true)" = '{"ok":true,"db":true}' ]; then break; fi
  sleep 1
done
[ "$(curl -fsS --max-time 10 http://127.0.0.1:3100/api/health)" = '{"ok":true,"db":true}' ]
new_web=$("${release_compose[@]}" ps -q web)
[ -n "$new_web" ]
[ "$(docker inspect --format '{{.Image}}' "$new_web")" = "$web_image" ]
printf '%s\n' "$new_web" > "$backup_dir/released-web-container"
printf 'RELEASED_WEB_CONTAINER=%q\n' "$new_web" >> "$backup_dir/state.env"
printf '%s\n' "$release_sha" > "$backup_dir/release-commit"
echo 'Web health verified. Bot remains stopped until authenticated browser smoke succeeds.'
printf '%s\n' "PRODUCER_WEB_CONTAINER=$new_web" "PRODUCER_BACKUP_DIR=$backup_dir" "PRODUCER_BOT_WAS_RUNNING=$bot_was_running" 'PRODUCER_RELEASE_WEB_HEALTH_OK=1'
