export type Progress =
  | { confirmed: false }
  | { confirmed: true; current: number; target: number; percent: number };

/** NULL в current_value означает «прогресс не подтверждён» — это не ноль. */
export function computeProgress(current: number | null | undefined, target: number | null | undefined): Progress {
  if (current === null || current === undefined) return { confirmed: false };
  if (!target || target <= 0) return { confirmed: true, current, target: target ?? 0, percent: 0 };
  const percent = Math.max(0, Math.min(100, Math.round((current / target) * 100)));
  return { confirmed: true, current, target, percent };
}

export function formatProgress(p: Progress, unit = ""): string {
  if (!p.confirmed) return "Прогресс не подтверждён";
  const u = unit ? ` ${unit}` : "";
  return p.target > 0 ? `${p.current} из ${p.target}${u} (${p.percent}%)` : `${p.current}${u}`;
}
