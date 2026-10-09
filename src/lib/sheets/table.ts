import { headerKey, type Cell } from "./cells";

export type Rows = Cell[][];

/** Столбцы ищутся по названию заголовка (с синонимами), а не по позиции. */
export type ColumnSpec = Record<string, readonly string[]>;

export type Table<K extends string> = {
  rows: { get: (key: K) => Cell; rowNumber: number }[];
  missing: K[];
};

/**
 * Находит строку заголовков среди первых строк (над ней бывают объединённые
 * заголовки-разделы) и сопоставляет столбцы по названиям.
 * Возвращает null, если заголовок не найден.
 */
export function readTable<S extends ColumnSpec, K extends keyof S & string = keyof S & string>(
  values: Rows,
  spec: S,
  required: NoInfer<K>[],
): Table<K> | null {
  const keys = Object.keys(spec) as K[];
  for (let h = 0; h < Math.min(values.length, 8); h++) {
    const header = (values[h] ?? []).map(headerKey);
    const index = {} as Record<K, number>;
    for (const k of keys) index[k] = spec[k].map(headerKey).map((a) => header.indexOf(a)).find((i) => i >= 0) ?? -1;
    if (!required.every((k) => index[k] >= 0)) continue;
    const rows = values.slice(h + 1).map((r, i) => ({
      get: (k: K) => (index[k] >= 0 ? r[index[k]] : undefined),
      rowNumber: h + 2 + i,
    }));
    return { rows, missing: keys.filter((k) => index[k] < 0) };
  }
  return null;
}
