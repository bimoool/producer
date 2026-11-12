#!/usr/bin/env bash
# Post-browser read-only invariants; resume only the previously running bot.
set -euo pipefail
umask 077
backup_dir=${1:?backup directory required}
case "$backup_dir" in /opt/goaltracker-backups/weekly-reports-*) ;; *) exit 1;; esac
[ -f "$backup_dir/state.env" ]
# Generated locally by the reviewed release script with safe shell quoting only.
source "$backup_dir/state.env"
cd /opt/goaltracker
psql_db() { docker exec -e PGOPTIONS="-c timezone=UTC" "$PRODUCTION_DB_CONTAINER" psql -U goal -d goaltracker -X -v ON_ERROR_STOP=1 -qAt -c "$1" </dev/null; }
psql_db "$(cat "$backup_dir/immutable-history.sql")" > "$backup_dir/immutable-history.post-smoke"
psql_db "$(cat "$backup_dir/finance.sql")" > "$backup_dir/finance.post-smoke"
cmp "$backup_dir/immutable-history.before" "$backup_dir/immutable-history.post-smoke"
cmp "$backup_dir/finance.before" "$backup_dir/finance.post-smoke"
[ "$(psql_db "select count(*) from weekly_reports where coalesce(declaration_id,'00000000-0000-4000-8000-000000000001'::uuid) = '00000000-0000-4000-8000-000000000001'::uuid and coalesce(report_date,period_end) = '2026-11-13'")" = 1 ]
[ "$(git rev-parse HEAD)" = 5963019e10bd8a24f6cf0e74978e40a732b6dbf8 ]
[ "$(curl -fsS --max-time 15 http://127.0.0.1:3100/api/health)" = '{"ok":true,"db":true}' ]
# main.ts registers commands and starts polling; it does not send reports on boot.
if [ "$BOT_WAS_RUNNING" = 1 ]; then
  "${release_compose[@]}" --profile bot up -d --no-deps --no-build bot
  bot_id=$("${release_compose[@]}" --profile bot ps -q bot)
  [ -n "$bot_id" ]
  [ "$(docker inspect --format '{{.State.Running}}' "$bot_id")" = true ]
  [ "$(docker inspect --format '{{.Image}}' "$bot_id")" = "$RELEASE_TOOLS_IMAGE" ]
fi
printf '%s\n' 'PRODUCER_POST_SMOKE_HISTORY_AND_FINANCE_UNCHANGED=1' 'PRODUCER_REPORT_2026_11_13_UNIQUE=1' "PRODUCER_PREVIOUS_BOT_STATE_RESTORED=$BOT_WAS_RUNNING" 'PRODUCER_DEPLOYED_AND_VERIFIED=5963019'
