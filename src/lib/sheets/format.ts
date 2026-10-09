import { formatRu } from "@/lib/domain/dates";

const int = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const dec = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat("ru-RU", { style: "percent", maximumFractionDigits: 1 });

const clean = (s: string) => s.replace(/ | /g, " ");
export const fmtInt = (n: number | null | undefined) => (n === null || n === undefined ? "—" : clean(int.format(n)));
export const fmtDec = (n: number | null | undefined) => (n === null || n === undefined ? "—" : clean(dec.format(n)));
export const fmtPct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : clean(pct.format(n)));
export const fmtDate = (iso: string | null | undefined) => (iso ? formatRu(iso) : "без даты");
export const fmtShortDate = (iso: string | null | undefined) => (iso ? formatRu(iso).slice(0, 5) : "—");
export function fmtChange(n: number | null): string {
  if (n === null) return "";
  return `${n > 0 ? "+" : ""}${clean(pct.format(n))}`;
}
