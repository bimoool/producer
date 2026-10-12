/**
 * Проверка загрузки Google Sheets на сервере (запускается из deploy/update.sh).
 * Синхронизирует проекты с указанной таблицей и печатает только количество
 * записей по разделам — без содержимого таблицы и без ключа.
 */
import { isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { loadServiceAccount } from "@/lib/sheets/google";
import { getSnapshotState, syncWorkspaceSheet } from "@/lib/sheets/sync";

async function main() {
  const sa = loadServiceAccount();
  if (!sa) {
    console.error("✗ ключ сервисного аккаунта не найден или некорректен (GOOGLE_SERVICE_ACCOUNT_FILE)");
    process.exit(1);
  }
  console.log(`ключ: ${sa.client_email}`);
  const rows = await getDb()
    .select({ id: schema.workspaces.id, slug: schema.workspaces.slug, sheetId: schema.workspaces.sheetId })
    .from(schema.workspaces)
    .where(isNotNull(schema.workspaces.sheetId));
  if (!rows.length) {
    console.error("✗ ни у одного проекта не указана таблица");
    process.exit(1);
  }
  let failed = false;
  for (const ws of rows) {
    const r = await syncWorkspaceSheet(ws);
    const s = await getSnapshotState(ws);
    if (!r.ok && !("throttled" in r && r.throttled)) {
      failed = true;
      console.error(`✗ ${ws.slug}: ${r.error}`);
      continue;
    }
    const d = s.data;
    if (!d) {
      failed = true;
      console.error(`✗ ${ws.slug}: данных нет`);
      continue;
    }
    console.log(
      `✓ ${ws.slug}: контент-план ${d.plan.length}, лаборатория ${d.lab.length}, reels ${d.reels.length}, ` +
        `драйверы ${d.drivers.length}, женская ${d.female.length}, гипотезы ${d.hypotheses.length}, ` +
        `дни ${d.daily.length}, цели ${d.goals.length}; синхронизация ${s.syncedAt?.toISOString()}`,
    );
    for (const w of d.warnings) console.log(`  ! ${w}`);
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("✗ проверка не удалась:", e instanceof Error ? e.name : "unknown");
  process.exit(1);
});
