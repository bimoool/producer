ALTER TABLE "weekly_reports" DROP CONSTRAINT "weekly_reports_period_unique";--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD COLUMN "declaration_id" uuid;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD COLUMN "report_date" date;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD COLUMN "coverage_start" date;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD COLUMN "coverage_end" date;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD COLUMN "cutoff_date" date;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_declaration_id_declarations_id_fk" FOREIGN KEY ("declaration_id") REFERENCES "public"."declarations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_reports_declaration_date_unique" ON "weekly_reports" USING btree (coalesce("declaration_id", '00000000-0000-4000-8000-000000000001'::uuid),coalesce("report_date", "period_end"));
--> statement-breakpoint
-- Old rows keep NULL metadata and every pre-existing value, including timestamps.
-- New reports must identify their declaration and capture an explicit fixed snapshot.
CREATE FUNCTION guard_report_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.declaration_id IS NULL OR NEW.report_date IS NULL
       OR NEW.coverage_start IS NULL OR NEW.coverage_end IS NULL OR NEW.cutoff_date IS NULL THEN
      RAISE EXCEPTION 'REPORT_METADATA: new reports require declaration, report date, coverage and cutoff' USING ERRCODE = '23514';
    END IF;
    IF extract(isodow FROM NEW.report_date) <> 5
       OR NEW.coverage_start > NEW.coverage_end OR NEW.coverage_end > NEW.report_date
       OR NEW.cutoff_date > NEW.report_date THEN
      RAISE EXCEPTION 'REPORT_METADATA: invalid reporting dates' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.declaration_id IS DISTINCT FROM OLD.declaration_id
     OR NEW.report_date IS DISTINCT FROM OLD.report_date
     OR NEW.coverage_start IS DISTINCT FROM OLD.coverage_start
     OR NEW.coverage_end IS DISTINCT FROM OLD.coverage_end
     OR NEW.cutoff_date IS DISTINCT FROM OLD.cutoff_date
     OR NEW.period_start IS DISTINCT FROM OLD.period_start
     OR NEW.period_end IS DISTINCT FROM OLD.period_end
     OR NEW.week_number IS DISTINCT FROM OLD.week_number THEN
    RAISE EXCEPTION 'REPORT_SNAPSHOT_FIXED: report identity and snapshot dates cannot change' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER weekly_reports_snapshot_guard BEFORE INSERT OR UPDATE ON weekly_reports
  FOR EACH ROW EXECUTE FUNCTION guard_report_snapshot();
--> statement-breakpoint
-- Protect every column of sent reports, including newly added metadata and future columns.
-- Preserve the existing narrowly scoped one-time import of exact original text.
CREATE OR REPLACE FUNCTION guard_sent_report() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'sent' THEN
      RAISE EXCEPTION 'REPORT_SENT: отправленный отчёт нельзя удалить' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'sent' AND (
    (to_jsonb(NEW) - 'original_text') IS DISTINCT FROM (to_jsonb(OLD) - 'original_text')
    OR OLD.original_text IS NOT NULL OR NEW.original_text IS NULL
  ) THEN
    RAISE EXCEPTION 'REPORT_SENT: отправленный отчёт не изменяется' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
