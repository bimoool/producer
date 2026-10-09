import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { todayISO } from "@/lib/domain/dates";
import { defaultDeps, loadServiceAccount, readTabs, SheetsError, type SheetsDeps } from "./google";
import { parseSnapshot, TABS, type TabKey, type VeraSnapshot } from "./vera-template";

const { workspaceSheetSnapshots: snapshots } = schema;

/** Данные считаются устаревшими через 6 часов — при открытии раздела обновятся в фоне. */
export const STALE_MS = 6 * 60 * 60 * 1000;
/** Не чаще одного обращения к Google на проект в 30 секунд. */
export const MIN_INTERVAL_MS = 30 * 1000;

export type SnapshotState = {
  configured: boolean;
  spreadsheetId: string | null;
  data: VeraSnapshot | null;
  syncedAt: Date | null;
  lastAttemptAt: Date | null;
  lastError: string | null;
  stale: boolean;
};

type WorkspaceRef = { id: string; sheetId: string | null };

export async function getSnapshotState(ws: WorkspaceRef, now = Date.now()): Promise<SnapshotState> {
  const [row] = await getDb().select().from(snapshots).where(eq(snapshots.workspaceId, ws.id)).limit(1);
  // Снимок от другой таблицы (ссылку поменяли) не показываем как текущий.
  const same = row && row.spreadsheetId === ws.sheetId;
  const syncedAt = same ? row.syncedAt : null;
  return {
    configured: !!loadServiceAccount(),
    spreadsheetId: ws.sheetId,
    data: same ? ((row.data as VeraSnapshot | null) ?? null) : null,
    syncedAt,
    lastAttemptAt: same ? row.lastAttemptAt : null,
    lastError: same ? row.lastError : null,
    stale: !syncedAt || now - syncedAt.getTime() > STALE_MS,
  };
}

const inFlight = new Map<string, Promise<SyncResult>>();

export type SyncResult = { ok: true; warnings: string[] } | { ok: false; error: string; throttled?: boolean };

/**
 * Синхронизация проекта с его Google-таблицей. Только чтение из Google.
 * Ошибка не стирает прежние данные. Параллельные вызовы объединяются.
 */
export function syncWorkspaceSheet(ws: WorkspaceRef, deps?: SheetsDeps, now = Date.now()): Promise<SyncResult> {
  const running = inFlight.get(ws.id);
  if (running) return running;
  const p = doSync(ws, deps, now).finally(() => inFlight.delete(ws.id));
  inFlight.set(ws.id, p);
  return p;
}

async function doSync(ws: WorkspaceRef, deps: SheetsDeps | undefined, now: number): Promise<SyncResult> {
  if (!ws.sheetId) return { ok: false, error: "Таблица проекта не указана (Настройки проекта)" };
  const sa = loadServiceAccount();
  if (!sa && !deps) return { ok: false, error: "Интеграция с Google не настроена на сервере" };
  const db = getDb();
  const [prev] = await db.select().from(snapshots).where(eq(snapshots.workspaceId, ws.id)).limit(1);
  if (prev && prev.spreadsheetId === ws.sheetId && now - prev.lastAttemptAt.getTime() < MIN_INTERVAL_MS) {
    return { ok: false, error: "Данные только что обновлялись — подождите полминуты", throttled: true };
  }
  const attemptAt = new Date(now);
  // Отмечаем попытку сразу: защищает Google от частых запросов даже при долгом ответе.
  await db
    .insert(snapshots)
    .values({ workspaceId: ws.id, spreadsheetId: ws.sheetId, lastAttemptAt: attemptAt })
    .onConflictDoUpdate({
      target: snapshots.workspaceId,
      set:
        prev && prev.spreadsheetId !== ws.sheetId
          ? { spreadsheetId: ws.sheetId, lastAttemptAt: attemptAt, data: null, syncedAt: null, lastError: null, spreadsheetTitle: null }
          : { lastAttemptAt: attemptAt },
    });
  try {
    const d = deps ?? defaultDeps(sa!);
    const keys = Object.keys(TABS) as TabKey[];
    const { values, title } = await readTabs(ws.sheetId, keys.map((k) => TABS[k]), d, sa?.client_email ?? "сервисного аккаунта");
    const tabs: Partial<Record<TabKey, (typeof values)[string]>> = {};
    for (const k of keys) if (values[TABS[k]]) tabs[k] = values[TABS[k]];
    const data = parseSnapshot(tabs, Number(todayISO().slice(0, 4)));
    await db
      .update(snapshots)
      .set({ data, spreadsheetTitle: title, syncedAt: new Date(), lastError: null })
      .where(eq(snapshots.workspaceId, ws.id));
    return { ok: true, warnings: data.warnings };
  } catch (e) {
    const message = e instanceof SheetsError ? e.message : "Не удалось обработать данные таблицы";
    if (!(e instanceof SheetsError)) console.error("sheet sync failed:", e instanceof Error ? e.name : "unknown");
    await db.update(snapshots).set({ lastError: message }).where(eq(snapshots.workspaceId, ws.id));
    return { ok: false, error: message };
  }
}
