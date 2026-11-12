#!/usr/bin/env bash
# Creates one short-lived owner session for the authorized release smoke test.
# Stdout is a credential: callers must capture/mask it, never tee it to logs.
set -euo pipefail
cd /opt/goaltracker
mapfile -t db_ids < <(docker ps -q --filter label=com.docker.compose.project=goaltracker --filter label=com.docker.compose.service=db)
[ "${#db_ids[@]}" = 1 ] || { echo 'Expected one project database' >&2; exit 1; }
token=$(openssl rand -hex 32)
hash=$(printf '%s' "$token" | sha256sum | cut -d ' ' -f 1)
login_hash="release-smoke-5963019-$(openssl rand -hex 12)"
created=$(docker exec -i "${db_ids[0]}" psql -U goal -d goaltracker -X -qAt -v ON_ERROR_STOP=1 <<SQL
INSERT INTO sessions(token_hash, telegram_id, login_hash, expires_at)
SELECT '$hash', telegram_id, '$login_hash', now() + interval '15 minutes'
FROM users WHERE is_owner AND disabled_at IS NULL ORDER BY created_at LIMIT 1
RETURNING id;
SQL
)
[ -n "$created" ] || { echo 'No active production owner; cannot smoke test' >&2; exit 1; }
printf '%s' "$token"
