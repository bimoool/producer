-- Декларация: дата окончания задаётся один раз, затем неизменяема.
CREATE OR REPLACE FUNCTION guard_declaration() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.locked_at IS NOT NULL THEN
      RAISE EXCEPTION 'DECLARATION_LOCKED: зафиксированную декларацию нельзя удалить' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.locked_at IS NOT NULL AND (
       NEW.title IS DISTINCT FROM OLD.title
    OR NEW.declared_on IS DISTINCT FROM OLD.declared_on
    OR NEW.cycle_start IS DISTINCT FROM OLD.cycle_start
    OR NEW.price_of_word IS DISTINCT FROM OLD.price_of_word
    OR NEW.reward IS DISTINCT FROM OLD.reward
    OR NEW.financial_hypothesis IS DISTINCT FROM OLD.financial_hypothesis
    OR NEW.locked_at IS DISTINCT FROM OLD.locked_at
    OR (OLD.ends_on IS NOT NULL AND NEW.ends_on IS DISTINCT FROM OLD.ends_on)
  ) THEN
    RAISE EXCEPTION 'DECLARATION_LOCKED: зафиксированную декларацию нельзя изменить' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
-- Отправленный отчёт заморожен. Разрешено только один раз вставить точный текст (original_text), если его не было.
CREATE OR REPLACE FUNCTION guard_sent_report() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'sent' THEN
      RAISE EXCEPTION 'REPORT_SENT: отправленный отчёт нельзя удалить' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'sent' AND (
       NEW.status IS DISTINCT FROM OLD.status
    OR NEW.week_number IS DISTINCT FROM OLD.week_number
    OR NEW.period_start IS DISTINCT FROM OLD.period_start
    OR NEW.period_end IS DISTINCT FROM OLD.period_end
    OR NEW.fields IS DISTINCT FROM OLD.fields
    OR NEW.content IS DISTINCT FROM OLD.content
    OR NEW.facts IS DISTINCT FROM OLD.facts
    OR NEW.sent_on IS DISTINCT FROM OLD.sent_on
    OR (OLD.original_text IS NOT NULL AND NEW.original_text IS DISTINCT FROM OLD.original_text)
  ) THEN
    RAISE EXCEPTION 'REPORT_SENT: отправленный отчёт не изменяется' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER weekly_reports_guard BEFORE UPDATE OR DELETE ON weekly_reports
  FOR EACH ROW EXECUTE FUNCTION guard_sent_report();
--> statement-breakpoint
CREATE TRIGGER deals_touch BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER deals_log AFTER INSERT OR UPDATE OR DELETE ON deals FOR EACH ROW EXECUTE FUNCTION log_activity();
