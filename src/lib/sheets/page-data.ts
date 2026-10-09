import { after } from "next/server";
import { getSnapshotState, syncWorkspaceSheet, type SnapshotState } from "./sync";

/**
 * Данные таблицы для страницы проекта. Вызывать ТОЛЬКО после workspacePage().
 * Нет снимка — загружаем сразу; снимок устарел — показываем его и обновляем в фоне.
 */
export async function loadSheetState(ws: { id: string; sheetId: string | null }): Promise<SnapshotState> {
  let state = await getSnapshotState(ws);
  if (!state.configured || !ws.sheetId) return state;
  if (!state.data) {
    await syncWorkspaceSheet(ws);
    state = await getSnapshotState(ws);
  } else if (state.stale) {
    after(() => syncWorkspaceSheet(ws).catch(() => undefined));
  }
  return state;
}
