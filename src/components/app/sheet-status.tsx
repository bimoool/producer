import { ExternalLinkIcon, TriangleAlertIcon } from "lucide-react";
import { RefreshSheetButton } from "@/components/app/refresh-sheet-button";
import { Card, CardContent } from "@/components/ui/card";
import { formatInTimeZone } from "@/lib/domain/format";
import type { SnapshotState } from "@/lib/sheets/sync";

/** Источник данных: время последней синхронизации, ошибка, кнопка «Обновить данные». */
export function SheetStatus({
  state,
  workspaceId,
  sheetUrl,
  canManage,
  slug,
}: {
  state: SnapshotState;
  workspaceId: string;
  sheetUrl: string | null;
  canManage: boolean;
  slug: string;
}) {
  if (!state.spreadsheetId) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          Google-таблица проекта не указана.
          {canManage ? (
            <>
              {" "}
              <a className="underline" href={`/projects/${slug}/settings`}>
                Указать в настройках
              </a>
            </>
          ) : null}
        </CardContent>
      </Card>
    );
  }
  if (!state.configured) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          Подключение к Google ещё не настроено на сервере — данные таблицы появятся после настройки.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
        <span>
          {state.syncedAt ? <>Данные из таблицы от {formatInTimeZone(state.syncedAt, "dd.MM.yyyy HH:mm")}</> : "Данные ещё не загружены"}
        </span>
        <RefreshSheetButton workspaceId={workspaceId} />
        {sheetUrl ? (
          <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
            Таблица <ExternalLinkIcon className="size-3.5" />
          </a>
        ) : null}
      </div>
      {state.lastError ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            Не удалось обновить данные{state.lastAttemptAt ? ` (${formatInTimeZone(state.lastAttemptAt, "dd.MM HH:mm")})` : ""}: {state.lastError}
            {state.data ? " Показаны последние успешно полученные данные." : ""}
          </span>
        </div>
      ) : null}
      {canManage && state.data?.warnings.length ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Замечания к структуре таблицы ({state.data.warnings.length})</summary>
          <ul className="mt-1 list-disc pl-5">
            {state.data.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
