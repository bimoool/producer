import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { todayISO } from "@/lib/domain/dates";
import { reportDateSchema, reportFieldsSchema, reportPeriodFor, renderReport, type ReportFields, type ReportPeriod } from "@/lib/domain/report";
import { storedReportPeriod } from "@/lib/report-service";

const { declarations, weeklyReports } = schema;

/** Called only after owner authorization. No bot, delivery, or financial writes. */
export async function persistReport(input: {
  id?: string; period: ReportPeriod; fields: ReportFields; status: "draft" | "final";
}) {
  const fields = reportFieldsSchema.parse(input.fields);
  const status = z.enum(["draft", "final"]).parse(input.status);
  const db = getDb();
  return db.transaction(async (tx) => {
    if (input.id) {
      const id = z.uuid().parse(input.id);
      const [row] = await tx.select().from(weeklyReports).where(eq(weeklyReports.id, id)).for("update");
      if (!row) throw new Error("Отчёт не найден");
      if (row.status === "sent") throw new Error("Отправленный отчёт не изменяется");
      // Ignore client-supplied dates on edits: the stored snapshot is fixed.
      await tx.update(weeklyReports).set({ fields, content: renderReport(storedReportPeriod(row), fields), status })
        .where(eq(weeklyReports.id, id));
      return id;
    }
    const [decl] = await tx.select().from(declarations).orderBy(sql`${declarations.declaredOn} desc`).limit(1);
    if (!decl) throw new Error("Декларация не найдена");
    const reportDate = reportDateSchema.parse(input.period.reportDate);
    const cutoff = z.iso.date().parse(input.period.cutoffDate);
    if (cutoff > todayISO() || cutoff > reportDate) throw new Error("Дата среза не может быть в будущем");
    const period = reportPeriodFor(cutoff, decl.cycleStart, reportDate);
    if (period.weekNumber < 1 || period.weekNumber > 1000 ||
      input.period.weekNumber !== period.weekNumber || input.period.periodStart !== period.periodStart ||
      input.period.periodEnd !== period.periodEnd || input.period.coverageStart !== period.coverageStart ||
      input.period.coverageEnd !== period.coverageEnd) throw new Error("Некорректный период отчёта");
    const [created] = await tx.insert(weeklyReports).values({
      ...period, declarationId: decl.id, fields, content: renderReport(period, fields), status,
    }).onConflictDoNothing().returning({ id: weeklyReports.id });
    if (created) return created.id;
    // A concurrent INSERT waits for the winner. This next READ COMMITTED query
    // sees it, without touching its fields, timestamp, status, or cutoff.
    const [existing] = await tx.select({ id: weeklyReports.id }).from(weeklyReports).where(and(
      sql`coalesce(${weeklyReports.declarationId}, '00000000-0000-4000-8000-000000000001'::uuid) = ${decl.id}::uuid`,
      sql`coalesce(${weeklyReports.reportDate}, ${weeklyReports.periodEnd}) = ${reportDate}::date`,
    ));
    if (!existing) throw new Error("Не удалось сохранить отчёт; повторите попытку");
    return existing.id;
  });
}
