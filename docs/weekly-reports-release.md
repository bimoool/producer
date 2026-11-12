# Weekly reports: release and recovery

These are operator instructions for a separately authorized deployment. Preparing
this document does not authorize running it on production. The repair is not
live until deployment and authenticated verification succeed.

Scope: `/opt/goaltracker`, Compose project `goaltracker`, PostgreSQL 16. Preserve
`.env`, the Google key mount, existing Compose overrides, all database volumes,
Caddy and other applications. Do not run `deploy/go.sh`: it invokes Caddy setup.
Do not run `deploy/install.sh` for this focused update: it also edits `.env` and
starts the Telegram bot. Do not run `docker compose down`, volume removal,
system-wide prune, or database reset.

## Before the maintenance window

1. Obtain separate deployment authorization. Record the approved release commit,
   current server commit, current web/tools image IDs, Compose service names and
   whether the bot is running. Check the server checkout for local changes; stop
   if it differs from the reviewed base, rather than resetting it. Do not print
   `.env`, `docker compose config` or credential contents.
2. Fetch the approved branch and inspect its exact diff. If production advanced
   beyond the reviewed base, merge/review/test that divergence before deploying.
3. Build the new `migrate` and `web` images sequentially before downtime. Retain
   old images under unique rollback tags before building. Do not start a second
   production bot. Do not invoke any report sending endpoint.

Illustrative shell for the authorized operator (replace `RELEASE_SHA` with the
reviewed full SHA; do not run the placeholder):

```bash
set -euo pipefail
cd /opt/goaltracker
export COMPOSE_PARALLEL_LIMIT=1
release_stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_dir=/opt/goaltracker-backups/weekly-reports-$release_stamp
install -d -m 700 "$backup_dir"
umask 077
git rev-parse HEAD > "$backup_dir/previous-commit"
git status --porcelain
# Stop here if checkout changes exist.
docker compose -p goaltracker ps
old_web_id=$(docker compose -p goaltracker images -q web)
old_tools_id=$(docker compose -p goaltracker images -q migrate)
test -n "$old_web_id" && test -n "$old_tools_id"
docker tag "$old_web_id" "goaltracker-web:rollback-$release_stamp"
docker tag "$old_tools_id" "goaltracker-tools:rollback-$release_stamp"
git fetch origin fix/weekly-reports-current-week
# Inspect and verify RELEASE_SHA before checkout.
git checkout --detach RELEASE_SHA
docker compose -p goaltracker build migrate
docker compose -p goaltracker build web
```

Use the existing Compose configuration loaded from `.env`; preserve the Google
read-only mount and service UID. The Dockerfile skips build-time type checking,
so require successful CI/local typecheck separately. Keep package integrity and
TLS verification enabled during builds.

## Consistent backup and isolated migration rehearsal

Use a short maintenance window. Stop **only** this project's web and any running
bot, so writes cannot race the backup/count checks. Record bot state first; do
not start a bot that was stopped. Keep the database running.

```bash
docker compose -p goaltracker stop web
# Only if bot was running:
# docker compose -p goaltracker --profile bot stop bot
docker compose -p goaltracker exec -T db pg_dump -U goal -d goaltracker \
  --format=custom --no-owner > "$backup_dir/goaltracker.dump"
test -s "$backup_dir/goaltracker.dump"
sha256sum "$backup_dir/goaltracker.dump" > "$backup_dir/SHA256SUMS"
```

Capture original columns for **all** weekly reports, not just sent reports. This
query deliberately excludes newly added metadata, allowing exact comparison
before and after an additive migration without modifying historical records:

```bash
history_sql="select id, md5(jsonb_build_array(id, week_number, period_start,
period_end, status, fields, content, original_text, facts, sent_on,
extract(epoch from created_at), extract(epoch from updated_at))::text) from weekly_reports order by id"
docker compose -p goaltracker exec -T db psql -U goal -d goaltracker \
  -v ON_ERROR_STOP=1 -At -c "$history_sql" > "$backup_dir/history.before"
counts_sql="select 'deals',count(*) from deals union all
select 'weekly_reports',count(*) from weekly_reports union all
select 'tasks',count(*) from tasks union all
select 'declaration_items',count(*) from declaration_items order by 1"
docker compose -p goaltracker exec -T db psql -U goal -d goaltracker \
  -v ON_ERROR_STOP=1 -At -c "$counts_sql" > "$backup_dir/counts.before"
```

Restore the backup in an isolated PostgreSQL 16 container with its own temporary
volume and network; do not restore over the live database. The temporary
container has no published ports, no production network access and no secrets.
Use a unique name, refuse pre-existing resources, and delete only resources
created by this rehearsal. Database trust authentication is restricted to this
isolated rehearsal network.

```bash
rehearsal=goaltracker-release-check-$release_stamp
docker network create --internal "$rehearsal"
docker volume create "$rehearsal"
docker run -d --name "$rehearsal" --network "$rehearsal" \
  --mount "type=volume,src=$rehearsal,dst=/var/lib/postgresql/data" \
  -e POSTGRES_USER=goal -e POSTGRES_DB=goaltracker \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine
for attempt in $(seq 1 30); do
  if docker exec "$rehearsal" pg_isready -U goal -d goaltracker; then break; fi
  sleep 1
done
docker exec "$rehearsal" pg_isready -U goal -d goaltracker
docker exec -i "$rehearsal" pg_restore -U goal -d goaltracker \
  --no-owner --exit-on-error < "$backup_dir/goaltracker.dump"
docker exec "$rehearsal" psql -U goal -d goaltracker -v ON_ERROR_STOP=1 \
  -At -c "$history_sql" > "$backup_dir/history.restored"
cmp "$backup_dir/history.before" "$backup_dir/history.restored"
# Run the new image's migration twice against ONLY the restored copy.
for attempt in 1 2; do
  docker run --rm --network "$rehearsal" \
    -e "DATABASE_URL=postgres://goal@$rehearsal:5432/goaltracker" \
    goaltracker-tools:latest node_modules/.bin/tsx src/db/migrate.ts
done
docker exec "$rehearsal" psql -U goal -d goaltracker -v ON_ERROR_STOP=1 \
  -At -c "$history_sql" > "$backup_dir/history.migrated"
cmp "$backup_dir/history.before" "$backup_dir/history.migrated"
docker exec "$rehearsal" psql -U goal -d goaltracker -v ON_ERROR_STOP=1 \
  -At -c "$counts_sql" > "$backup_dir/counts.migrated"
cmp "$backup_dir/counts.before" "$backup_dir/counts.migrated"
```

Before migration, inspect the restored copy for duplicate `period_end` values and
confirm legacy reports belong to the original declaration
`00000000-0000-4000-8000-000000000001`. Legacy NULL declaration metadata is
resolved to that original cycle for identity only; stored periods and contents
are not rewritten. Stop and investigate if a different legacy cycle exists or
`select period_end, count(*) from weekly_reports group by period_end having count(*) > 1`
returns rows. Never delete or merge historical reports to force migration through.

Also inspect the actual 06.11 report on this copy by ID
`b62821db-b04b-4905-9f3a-8c9ad9e5d792`; confirm sent status, exact text and period
match the backup. Never seed a replacement if that ID is absent. Run the
report concurrency/guard integration tests on a **separate disposable test DB**,
not production or the retained restored baseline: tests create/drop databases
and deliberately exercise updates. Keep the backup until retention policy and
release observation permit removal. Clean up only the named rehearsal container,
volume and network after successful checks:

```bash
docker rm -f "$rehearsal"
docker volume rm "$rehearsal"
docker network rm "$rehearsal"
```

## Apply and verify

Only after restore, migration, repeatability and historical comparisons pass:

```bash
docker compose -p goaltracker run --rm --no-deps migrate
docker compose -p goaltracker exec -T db psql -U goal -d goaltracker \
  -v ON_ERROR_STOP=1 -At -c "$history_sql" > "$backup_dir/history.after"
cmp "$backup_dir/history.before" "$backup_dir/history.after"
docker compose -p goaltracker up -d --no-deps web
curl -fsS http://127.0.0.1:3100/api/health
bash deploy/verify.sh
```

Verify authenticated UI with the authorized account: `/reports` offers the
current Friday; choose 13.11.2026 explicitly, inspect coverage 09–13.11 and saved
cutoff, save draft, reopen and save final, and confirm the same ID and all fields
persist. Use a staging copy for calendar time travel; do not change the server
clock. Confirm 06.11 remains read-only and its fingerprint unchanged. Confirm
unknown state/money stay unknown, partial completion stays partial, financial
rows are unchanged, and no third-party sending occurs. Restore the bot only if
it was previously running, after checking its compatibility with the schema.
Record approved SHA, migration result, backup path, comparisons, HTTP checks and
manual UI results. Do not claim production verification from local tests.

## Rollback without discarding new data

If migration fails, leave web/bot stopped, retain backup and logs, and inspect
transaction/migration journal state before retrying. Never edit migration hashes,
mark a failed migration applied, or disable guards. Prefer a forward repair.

If the new web fails after migration, stop only this web and any running bot.
Take a **new** dump retaining writes made since deployment. Retain the additive
schema and all report records. Do not run a down migration, drop metadata/indexes,
or restore the pre-release dump over the live volume. Old code has the original
calendar bug and may not understand new uniqueness constraints: keep maintenance
mode until compatibility on the restored copy is verified. An image rollback
alone is not a guarantee that writes are safe.

After that compatibility check, re-tag the recorded old images to the original
`goaltracker-web:latest` / `goaltracker-tools:latest` tags and use
`docker compose -p goaltracker up -d --no-deps web` (no build or migrate).
Restore the old checkout only with a clean working tree. Do not run `go.sh` or
`install.sh` during rollback. Recheck health and historical fingerprints.
A disaster restore must go to a **new** database/volume, be verified first, and
include an explicit reconciliation plan for post-backup writes; switching the
live database requires a separately reviewed operator decision.


## Validation performed in the cloud workspace

Base: `5a038c073b850e3e9b487c608ac1bd10e2cbad00` on
`claude/producer-os-sheets`; no newer remote branch tip was found at inspection.
No production SSH, database or deployment operations were performed.

- Full Vitest run: 22 files, 178 tests passed, no failed or skipped tests, with
  PostgreSQL enabled. Includes 12 concurrent SQL inserts and 8 concurrent real
  Server Action creates, fixed cutoff, saved-field preservation, sent guards,
  historical November 6 fixture preservation, permissions and other sections.
- `npm run typecheck`, `npm run lint`, `npm run build`: passed.
- Local custom-format `pg_dump` restored successfully to a separate database;
  migrations applied twice successfully. Upgrade tests separately migrate a
  pre-upgrade fixture and compare every original historical report value.
- Chromium exercised the production standalone build against an isolated local
  database: current November 13 report, 09–13 coverage and November 12 cutoff,
  draft save, final save, same-ID reopening, explicit date selection and invalid
  Thursday rejection, historical sent read-only display, six other sections,
  desktop and mobile rendering. No browser errors or outbound browser requests;
  financial records and pre-existing historical rows remained unchanged.

The real November 6 production row and a production backup have not been read
or restored in this task. Their validation remains mandatory during the
separately authorized release rehearsal above. Local fixtures are not evidence
that the live production database has been inspected.
