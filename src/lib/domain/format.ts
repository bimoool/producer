import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { TIMEZONE } from "./dates";

export function formatInTimeZone(d: Date, pattern = "dd.MM HH:mm"): string {
  return format(new TZDate(d, TIMEZONE), pattern);
}
